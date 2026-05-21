import { readFileSync, writeFileSync, writeSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import { ValidationResult } from '../contracts/types/ValidationResult'
import { RuleSource } from '../contracts/types/RuleSource'
import { IModelClient } from '../contracts/types/ModelClient'
import { collectRuleSources } from '../collector/collectRuleSources'
import { findProjectRoot } from '../config/findProjectRoot'
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
const WARNINGS_DIR_NAME = 'agent-gate-warnings'

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

export interface NoConfigWarner {
  warn(cwd: string): void
}

export interface WarningStamp {
  getLastTime(key: string): number
  setLastTime(key: string, time: number): void
}

class FileWarningStamp implements WarningStamp {
  private readonly dir: string

  constructor() {
    this.dir = join(tmpdir(), WARNINGS_DIR_NAME)
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
    try {
      mkdirSync(this.dir, { recursive: true })
      writeFileSync(this.stampPath(key), String(time))
    } catch {
      // best-effort: never let the warner break the hook
    }
  }
}

export interface DefaultNoConfigWarnerOptions {
  throttleMs?: number
  now?: () => number
  writeStderr?: (msg: string) => void
  stamp?: WarningStamp
  isSilenced?: () => boolean
}

export class DefaultNoConfigWarner implements NoConfigWarner {
  private readonly throttleMs: number
  private readonly now: () => number
  private readonly writeStderr: (msg: string) => void
  private readonly stamp: WarningStamp
  private readonly isSilenced: () => boolean

  constructor(opts: DefaultNoConfigWarnerOptions = {}) {
    this.throttleMs = opts.throttleMs ?? defaultThrottleMsFromEnv()
    this.now = opts.now ?? Date.now
    this.writeStderr = opts.writeStderr ?? defaultWriteStderr
    this.stamp = opts.stamp ?? new FileWarningStamp()
    this.isSilenced = opts.isSilenced ?? defaultIsSilenced
  }

  warn(cwd: string): void {
    if (this.isSilenced()) return
    try {
      const now = this.now()
      const last = this.stamp.getLastTime(cwd)
      // last === 0 means "never warned" — always emit.
      // `now < last` guards against backward clock jumps (NTP, dual-boot)
      // that would otherwise suppress the warning indefinitely.
      if (last > 0 && now >= last && now - last < this.throttleMs) return
      this.stamp.setLastTime(cwd, now)
      this.writeStderr(buildNoConfigWarningMessage(cwd))
    } catch {
      // never let the warner break the hook pipeline
    }
  }
}

function defaultThrottleMsFromEnv(): number {
  const raw = process.env.AGENT_GATE_NO_CONFIG_WARNING_TTL_SEC
  if (raw === undefined || raw === '') return 60 * 60 * 1000
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 0) return 60 * 60 * 1000
  return parsed * 1000
}

// Use synchronous fd-level write so the message reliably reaches the
// terminal before `process.exit()` runs. `process.stderr.write()` is
// async on non-TTY pipes (the normal Claude Code hook environment) and
// its buffer can be dropped on immediate exit.
function defaultWriteStderr(msg: string): void {
  try {
    writeSync(2, msg)
  } catch {
    // best-effort: ignore EAGAIN / EBADF / etc.
  }
}

function defaultIsSilenced(): boolean {
  const v = process.env.AGENT_GATE_NO_CONFIG_WARNING
  return v === '1' || v === 'true'
}

function buildNoConfigWarningMessage(cwd: string): string {
  return (
    `agent-gate: no .agent-gate.config.* found in ${cwd} or its ancestors.\n` +
    `  The hook is installed but inactive. Add .agent-gate.config.ts at your project root.\n` +
    `  Docs: https://github.com/Hiro-Chiba/agent-gate#config\n` +
    `  Silence: set AGENT_GATE_NO_CONFIG_WARNING=1\n`
  )
}

const NOOP_NO_CONFIG_WARNER: NoConfigWarner = { warn: () => {} }

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
  /**
   * Emits a "no .agent-gate.config.* found" warning when strict opt-in
   * triggers a silent skip. Defaults to a no-op so library callers and
   * tests are not surprised by stderr writes. The CLI entry
   * (`runHookMode` / `runDaemon`) injects a `DefaultNoConfigWarner` so
   * end users see the warning in their terminal.
   */
  noConfigWarner?: NoConfigWarner
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

  // Stable project identifier used as the key for project-scoped state
  // (cache, cooldown, no-config warning throttle, sessionContext). Falls
  // back to cwd when no marker is found so synthetic paths in tests and
  // ad-hoc directories still work.
  const projectRoot = findProjectRoot(cwd) ?? cwd

  // Cache lookup: if a recent verdict for the exact same (adapter, tool,
  // input, projectRoot) is still valid, return it without re-running.
  if (deps?.cache) {
    const cached = deps.cache.get({
      adapter: adapter.id,
      toolName,
      toolInput,
      projectRoot,
    })
    if (cached) return cached
  }

  const agentGateConfig = deps?.agentGateConfig ?? loadAgentGateConfig(cwd)

  // Strict Opt-in: skip everything if no config file was found.
  if (agentGateConfig.found !== true) {
    const warner = deps?.noConfigWarner ?? NOOP_NO_CONFIG_WARNER
    warner.warn(projectRoot)
    return PASS
  }

  // Build SessionContext. `cwd` keeps the actual working directory the
  // adapter received (used for transcript discovery in readHistory).
  // `projectRoot` is the stable identifier resolved above.
  let history: SessionEvent[] = []
  if (typeof adapter.readHistory === 'function') {
    try {
      history = await adapter.readHistory({
        cwd,
        limit: 20,
        transcriptPath: parsed.action.transcriptPath,
        metadata: parsed.action.metadata,
      })
    } catch {
      history = []
    }
  }
  const sessionContext: SessionContext = {
    cwd,
    projectRoot,
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
        { adapter: adapter.id, toolName, toolInput, projectRoot },
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
    const lastTime = cooldownStore.getLastTime(projectRoot)
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
        { adapter: adapter.id, toolName, toolInput, projectRoot },
        PASS
      )
    }
    return PASS
  }

  // Get model client
  const getClient =
    deps?.getModelClient ?? ((c: Config) => createModelClient(c))
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
    cooldownStore.setLastTime(projectRoot, Math.floor(Date.now() / 1000))
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
      { adapter: adapter.id, toolName, toolInput, projectRoot },
      result
    )
  }

  return result
}

function createModelClient(config: Config): IModelClient {
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
  clients.push(new ClaudeCli(config))
  if (clients.length === 1) {
    return clients[0]
  }
  return new CompositeModelClient(clients)
}
