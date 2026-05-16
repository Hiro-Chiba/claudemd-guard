import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'

const CONFIG_FILENAME = '.agent-gate.json'
const ENV_DISABLED_RULES = 'AGENT_GATE_DISABLED_RULES'

export interface AgentGateConfig {
  disabledRules: string[]
  protectedBranches?: string[]
  extraSecretPathPrefixes?: string[]
}

interface RawConfig {
  disabled_rules?: string[]
  protected_branches?: string[]
  extra_secret_paths?: string[]
}

function findConfigFile(cwd: string): string | null {
  let dir = cwd
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function readRawConfig(path: string): RawConfig {
  try {
    const content = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(content) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as RawConfig
    }
    return {}
  } catch {
    return {}
  }
}

function disabledFromEnv(): string[] {
  const raw = process.env[ENV_DISABLED_RULES]
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function loadAgentGateConfig(cwd: string): AgentGateConfig {
  const configPath = findConfigFile(cwd)
  const raw = configPath ? readRawConfig(configPath) : {}

  const fromFile = Array.isArray(raw.disabled_rules) ? raw.disabled_rules : []
  const fromEnv = disabledFromEnv()
  const combined = new Set<string>([...fromFile, ...fromEnv])

  return {
    disabledRules: Array.from(combined),
    protectedBranches: Array.isArray(raw.protected_branches)
      ? raw.protected_branches
      : undefined,
    extraSecretPathPrefixes: Array.isArray(raw.extra_secret_paths)
      ? raw.extra_secret_paths
      : undefined,
  }
}
