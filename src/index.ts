// Config
export { Config } from './config/Config'
export type { ConfigOptions } from './config/Config'
export { defineConfig } from './config/defineConfig'
export type { AgentGatePluginConfig } from './config/defineConfig'
export type { AgentGateConfig } from './config/AgentGateConfig'
export { loadAgentGateConfig } from './config/AgentGateConfig'
export { loadPluginConfig } from './config/PluginConfigLoader'

// Types
export type { ValidationResult } from './contracts/types/ValidationResult'
export type { HookData } from './contracts/types/HookData'
export type { IModelClient } from './contracts/types/ModelClient'
export type { RuleSource, RuleSourceKind } from './contracts/types/RuleSource'
export type { Action, ParsedHook } from './contracts/types/Action'
export type {
  SessionContext,
  SessionEvent,
} from './contracts/types/SessionContext'

// Schemas
export { HookDataSchema } from './contracts/schemas/hookDataSchema'

// Deterministic rules
export type {
  DeterministicRule,
  RuleVerdict,
} from './deterministic/types'
export {
  forbidCommandPattern,
  forbidContentPattern,
  forbidFilePathPattern,
} from './deterministic/factories'
export {
  defaultDeterministicRules,
  buildDefaultDeterministicRules,
} from './deterministic/defaultRules'

// Adapters
export { claudeCodeAdapter } from './adapters/claude-code/adapter'
export { cursorAdapter } from './adapters/cursor/adapter'
export type { Adapter, ReadHistoryOptions } from './adapters/Adapter'

// Model clients (for users wiring up custom AI fallback chains)
export { CompositeModelClient } from './validation/models/CompositeModelClient'
export type { CompositeModelClientOptions } from './validation/models/CompositeModelClient'
export { AgentSdkClient } from './validation/models/AgentSdkClient'
export type {
  AgentSdkClientOptions,
  AgentSdkQueryFn,
} from './validation/models/AgentSdkClient'

// Doctor (CLAUDE.md linter)
export { lintRuleSources } from './doctor/lintRuleSources'
export { lintRuleSourcesWithAi } from './doctor/lintRuleSourcesWithAi'
export { formatFindings } from './doctor/formatFindings'
export type {
  Finding,
  FindingCode,
  Severity,
} from './doctor/findings'

// Cache
export { DecisionCache } from './cache/DecisionCache'
export type {
  CacheKey,
  DecisionCacheOptions,
} from './cache/DecisionCache'

// Daemon
export { DaemonServer } from './daemon/server'
export type { DaemonServerOptions, DaemonHandler } from './daemon/server'
export { sendToDaemon } from './daemon/client'
export type { SendToDaemonOptions } from './daemon/client'
export {
  defaultSocketPath as defaultDaemonSocketPath,
} from './daemon/protocol'
export type {
  DaemonRequest,
  DaemonResponse,
  DaemonErrorResponse,
} from './daemon/protocol'

// Observability
export { EventBus } from './observability/eventBus'
export { JsonlFileSink } from './observability/sinks/JsonlFileSink'
export type {
  PipelineEvent,
  RuleFiredEvent,
  AiRequestedEvent,
  AiCompletedEvent,
  VerdictDecidedEvent,
  PipelineErrorEvent,
  Sink,
} from './observability/sinks/Sink'

// Core
export { collectRuleSources } from './collector/collectRuleSources'
export { validator } from './validation/validator'
export { processHookData } from './hooks/processHookData'
