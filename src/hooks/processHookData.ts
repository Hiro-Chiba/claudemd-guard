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
  appendDecision,
  defaultLogPath,
  isLoggingEnabled,
  DecisionLogEntry,
  DecisionSource,
} from '../observability/decisionLogger'

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
  /** Override logging behavior. When provided, replaces env detection. */
  logging?: { enabled: boolean; path?: string }
}

function maybeLog(
  deps: ProcessHookDataDeps | undefined,
  entry: Omit<DecisionLogEntry, 'timestamp'>
): void {
  const enabled = deps?.logging
    ? deps.logging.enabled
    : isLoggingEnabled()
  if (!enabled) return
  const path = deps?.logging?.path ?? defaultLogPath()
  const full: DecisionLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  }
  try {
    appendDecision(full, path)
  } catch {
    // Logging failures must never block the hook pipeline.
  }
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
  const parsed = adapter.parseHook(input)
  if (parsed.kind === 'skip') {
    return PASS
  }
  const { toolName, toolInput } = parsed.action

  // Resolve cwd early so the agent-gate config can be loaded relative to it.
  const cwd = deps?.cwd ?? process.cwd()
  const agentGateConfig = deps?.agentGateConfig ?? loadAgentGateConfig(cwd)

  // Deterministic rules: a fast, cheap safety baseline that runs before
  // any cooldown or AI check.
  const deterministicRules =
    deps?.deterministicRules ??
    buildDefaultDeterministicRules(agentGateConfig)
  const ruleVerdict = runDeterministicRules(
    toolName,
    toolInput,
    deterministicRules
  )
  if (ruleVerdict.kind === 'block') {
    maybeLog(deps, {
      adapter: adapter.id,
      toolName,
      decision: 'block',
      reason: ruleVerdict.reason,
      source: 'deterministic',
      ruleId: ruleVerdict.ruleId,
    })
    return { decision: 'block', reason: ruleVerdict.reason }
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
    return PASS
  }

  // Get model client
  const getClient =
    deps?.getModelClient ?? ((c: Config) => createModelClient(c, cwd))
  const modelClient = getClient(config)

  // Validate
  const validate = deps?.validatorFn ?? validator
  const result = await validate(rules, toolName, toolInput, modelClient)

  // Update cooldown timestamp AFTER successful validation
  if (cooldownStore) {
    cooldownStore.setLastTime(cwd, Math.floor(Date.now() / 1000))
  }

  const source: DecisionSource = 'ai'
  maybeLog(deps, {
    adapter: adapter.id,
    toolName,
    decision: result.decision === 'block' ? 'block' : 'allow',
    reason: result.reason,
    source,
  })

  return result
}

function createModelClient(config: Config, cwd: string): IModelClient {
  if (config.useApi) {
    return new AnthropicApi(config)
  }
  return new ClaudeCli(config, cwd)
}
