import { AgentGatePluginConfig } from './defineConfig'
import { loadPluginConfig } from './PluginConfigLoader'

/**
 * The resolved configuration that the hook pipeline consumes.
 *
 * This is the same shape as AgentGatePluginConfig; both names exist
 * so callers can pick the more descriptive one for their context.
 */
export type AgentGateConfig = AgentGatePluginConfig

const ENV_DISABLED_RULES = 'AGENT_GATE_DISABLED_RULES'

function disabledFromEnv(): string[] {
  const raw = process.env[ENV_DISABLED_RULES]
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Resolves the effective AgentGateConfig for the given cwd.
 *
 * Reads `.agent-gate.config.{ts,mts,mjs,cjs,js}` (preferred) or the
 * legacy `.agent-gate.json`, walking upward from cwd. Merges the
 * AGENT_GATE_DISABLED_RULES env var into disabledRules so command-line
 * users can disable rules without touching the config file.
 */
export function loadAgentGateConfig(cwd: string): AgentGateConfig {
  const fromFile = loadPluginConfig(cwd)
  const fromEnv = disabledFromEnv()
  const combinedDisabled = new Set<string>([
    ...(fromFile.disabledRules ?? []),
    ...fromEnv,
  ])
  return {
    ...fromFile,
    disabledRules: Array.from(combinedDisabled),
  }
}
