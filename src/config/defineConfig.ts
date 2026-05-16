import { DeterministicRule } from '../deterministic/types'

/**
 * Shape of the object exported by `.agent-gate.config.{ts,js,mjs}`.
 *
 * All fields are optional. The plugin loader resolves precedence with
 * existing `.agent-gate.json` (the richer config file wins on conflict).
 */
export interface AgentGatePluginConfig {
  /** Rule ids that should not run. Merged with AGENT_GATE_DISABLED_RULES. */
  disabledRules?: string[]
  /** Override the protected branch list used by prevent-force-push-main. */
  protectedBranches?: string[]
  /** Additional path substrings treated as secret targets. */
  extraSecretPathPrefixes?: string[]
  /** User-defined deterministic rules appended after the built-ins. */
  customRules?: DeterministicRule[]
}

/**
 * Identity helper that gives TypeScript users autocomplete and type
 * checking inside `.agent-gate.config.ts`. Has no runtime behavior.
 */
export function defineConfig(
  config: AgentGatePluginConfig
): AgentGatePluginConfig {
  return config
}
