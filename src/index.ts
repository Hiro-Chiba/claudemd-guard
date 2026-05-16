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
export type { Adapter } from './adapters/Adapter'

// Core
export { collectRuleSources } from './collector/collectRuleSources'
export { validator } from './validation/validator'
export { processHookData } from './hooks/processHookData'
