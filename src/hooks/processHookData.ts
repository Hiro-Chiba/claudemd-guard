import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import { ValidationResult } from '../contracts/types/ValidationResult'
import { RuleSource } from '../contracts/types/RuleSource'
import { IModelClient } from '../contracts/types/ModelClient'
import { collectRuleSources } from '../collector/collectRuleSources'
import { validator } from '../validation/validator'
import { Config } from '../config/Config'
import { ClaudeCli } from '../validation/models/ClaudeCli'
import { AnthropicApi } from '../validation/models/AnthropicApi'
import { CompositeModelClient } from '../validation/models/CompositeModelClient'
import { AgentSdkClient } from '../validation/models/AgentSdkClient'
import { DeterministicRule } from '../deterministic/types'
import { runDeterministicRules } from '../deterministic/engine'
import { buildDefaultDeterministicRules } from '../deterministic/defaultRules'
import { Adapter } from '../adapters/Adapter'
import { claudeCodeAdapter } from '../adapters/claude-code/adapter'
import {
  AgentGateConfig,
  loadAgentGateConfig,
} from '../config/AgentGateConfig'
import {
  defaultLogPath,
  isLoggingEnabled,
  DecisionSource,
} from '../observability/decisionLogger'
import { DecisionCache } from '../cache/DecisionCache'
import { EventBus } from '../observability/eventBus'
import { JsonlFileSink } from '../observability/sinks/JsonlFileSink'
import { PipelineEvent } from '../observability/sinks/Sink'
import {
  SessionContext,
  SessionEvent,
} from '../contracts/types/SessionContext'

const PASS: ValidationResult = { decision: undefined, reason: '' }
const COOLDOWN_DIR_NAME = 'agent-gate'

export interface CooldownStore {
  getLastTime(key: string): number
  setLastTime(key: string, time: number): void
}

class FileCooldownStore implements CooldownStore {
  private readonly dir: string

  constructor() {
    this.dir = join(tmpdir(), COOLDOWN_DIR_NAME)
    mkdirSync(this.dir, { recursive: true })
  }

  private stampPath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex')
    return join(this.dir, hash)
  }

  getLastTime(key: string): number {
    try {
      return parseInt(readFileSync(this.stampPath(key), 'utf-8'), 10) || 0
    } catch {
      return 0
    }
  }

  setLastTime(key: string, time: number): void {
    writeFileSync(this.stampPath(key), String(time))
  }
}

export interface ProcessHookDataDeps {
  config?: Config
  agentGateConfig?: AgentGateConfig
  collectFn?: (cwd: string) => RuleSource[]
  validatorFn?: typeof validator
  getModelClient?: (config: Config) => IModelClient
  cooldownStore?: CooldownStore
  cwd?: string
  deterministicRules?: DeterministicRule[]
  adapter?: Adapter
  /**
   * Pre-configured event bus. When omitted, a default bus is built
   * and a JsonlFileSink is auto-subscribed iff AGENT_GATE_LOG=1 (or
   * `logging.enabled` is true).
   */
  eventBus?: EventBus
  /** Override logging behavior. When provided, replaces env detection. */
  logging?: { enabled: boolean; path?: string }
  /**
   * Optional in-process decision cache. Most useful in daemon mode where
   * the cache survives across hook invocations and short-circuits the
   * entire pipeline on a hit.
   */
  cache?: DecisionCache
}

function resolveEventBus(deps: ProcessHookDataDeps | undefined): EventBus {
  if (deps?.eventBus) return deps.eventBus
  const bus = new EventBus()
  const enabled = deps?.logging ? deps.logging.enabled : isLoggingEnabled()
  if (enabled) {
    const path = deps?.logging?.path ?? defaultLogPath()
    bus.subscribe(new JsonlFileSink(path))
  }
  return bus
}

export async function processHookData(
  input: string,
  deps?: ProcessHookDataDeps
): Promise<ValidationResult> {
  const config = deps?.config ?? new Config()

  if (config.disabled) {
    return PASS
  }

  const adapter = deps?.adapter ?? claudeCodeAdapter
  const bus = resolveEventBus(deps)
  const parsed = adapter.parseHook(input)
  if (parsed.kind === 'skip') {
    return PASS
  }
  const { toolName, toolInput } = parsed.action

  // Resolve cwd early so the agent-gate config can be loaded relative to it.
  const cwd = deps?.cwd ?? process.cwd()

  // Cache lookup: if a recent verdict for the exact same (adapter, tool,
  // input, cwd) is still valid, return it without re-running the pipeline.
  if (deps?.cache) {
    const cached = deps.cache.get({
      adapter: adapter.id,
      toolName,
      toolInput,
      cwd,
    })
    if (cached) return cached
  }

  const agentGateConfig = deps?.agentGateConfig ?? loadAgentGateConfig(cwd)

  // Build SessionContext (history from adapter, projectRoot defaults to cwd
  // for v1; future work can detect the actual project root).
  let history: SessionEvent[] = []
  if (typeof adapter.readHistory === 'function') {
    try {
      history = await adapter.readHistory({ cwd, limit: 20 })
    } catch {
      history = []
    }
  }
  const sessionContext: SessionContext = {
    cwd,
    projectRoot: cwd,
    history,
  }

  // Deterministic rules: a fast, cheap safety baseline that runs before
  // any cooldown or AI check.
  const deterministicRules =
    deps?.deterministicRules ??
    buildDefaultDeterministicRules(agentGateConfig)
  const ruleVerdict = runDeterministicRules(
    toolName,
    toolInput,
    deterministicRules,
    sessionContext,
    { onError: config.onError }
  )
  if (ruleVerdict.kind === 'block') {
    bus.emit({
      type: 'rule.fired',
      adapter: adapter.id,
      toolName,
      ruleId: ruleVerdict.ruleId,
      decision: 'block',
      reason: ruleVerdict.reason,
    })
    bus.emit({
      type: 'verdict.decided',
      adapter: adapter.id,
      toolName,
      decision: 'block',
      reason: ruleVerdict.reason,
      source: 'deterministic',
      ruleId: ruleVerdict.ruleId,
    })
    const verdict: ValidationResult = {
      decision: 'block',
      reason: ruleVerdict.reason,
    }
    if (deps?.cache) {
      deps.cache.set(
        { adapter: adapter.id, toolName, toolInput, cwd },
        verdict
      )
    }
    return verdict
  }

  // Cooldown check (file-based, persists across process invocations)
  const cooldownStore =
    config.cooldown > 0
      ? deps?.cooldownStore ?? new FileCooldownStore()
      : undefined

  if (cooldownStore && config.cooldown > 0) {
    const now = Math.floor(Date.now() / 1000)
    const lastTime = cooldownStore.getLastTime(cwd)
    if (now - lastTime < config.cooldown) {
      return PASS
    }
  }

  // Collect rule sources (CLAUDE.md, AGENTS.md, .cursorrules, ...)
  const collect = deps?.collectFn ?? collectRuleSources
  const rules = collect(cwd)

  if (rules.length === 0) {
    if (deps?.cache) {
      deps.cache.set(
        { adapter: adapter.id, toolName, toolInput, cwd },
        PASS
      )
    }
    return PASS
  }

  // Get model client
  const getClient =
    deps?.getModelClient ?? ((c: Config) => createModelClient(c, cwd))
  const modelClient = getClient(config)

  // Validate
  const validate = deps?.validatorFn ?? validator
  bus.emit({
    type: 'ai.requested',
    adapter: adapter.id,
    toolName,
    rulesCount: rules.length,
  })
  const aiStart = Date.now()
  const result = await validate(rules, toolName, toolInput, modelClient, {
    onError: config.onError,
  })
  const aiLatency = Date.now() - aiStart

  // Update cooldown timestamp AFTER successful validation
  if (cooldownStore) {
    cooldownStore.setLastTime(cwd, Math.floor(Date.now() / 1000))
  }

  const decision: 'block' | 'allow' =
    result.decision === 'block' ? 'block' : 'allow'
  const source: DecisionSource = 'ai'
  bus.emit({
    type: 'ai.completed',
    adapter: adapter.id,
    toolName,
    decision,
    reason: result.reason,
    latencyMs: aiLatency,
  })
  bus.emit({
    type: 'verdict.decided',
    adapter: adapter.id,
    toolName,
    decision,
    reason: result.reason,
    source,
  })
  if (deps?.cache) {
    deps.cache.set(
      { adapter: adapter.id, toolName, toolInput, cwd },
      result
    )
  }

  return result
}

function createModelClient(config: Config, cwd: string): IModelClient {
  // Build a fallback chain: the most-preferred client comes first.
  // The CompositeModelClient tries each in order; if one fails, the next
  // runs. The validator's outer try/catch fail-opens if every client has
  // failed.
  //
  // Order: AgentSdkClient (when AGENT_GATE_USE_SDK=1) -> AnthropicApi
  // (when an API key is set) -> ClaudeCli (always available as a fallback).
  // AgentSdkClient is preferred when enabled because it reuses the host
  // agent's existing Claude authentication, removing the need for a
  // separate API key.
  const clients: IModelClient[] = []
  if (config.useSdk) {
    clients.push(new AgentSdkClient({ config }))
  }
  if (config.useApi) {
    clients.push(new AnthropicApi(config))
  }
  clients.push(new ClaudeCli(config, cwd))
  if (clients.length === 1) {
    return clients[0]
  }
  return new CompositeModelClient(clients)
}
