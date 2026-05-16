import { mkdirSync, appendFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

export type DecisionSource = 'deterministic' | 'ai' | 'pass'

export interface DecisionLogEntry {
  timestamp: string
  adapter: string
  toolName: string
  decision: 'block' | 'allow'
  reason: string
  source: DecisionSource
  /** Rule id when the decision came from the deterministic engine. */
  ruleId?: string
}

const DEFAULT_LOG_DIR = '.agent-gate'
const DEFAULT_LOG_FILENAME = 'log.jsonl'

export function defaultLogPath(): string {
  return join(homedir(), DEFAULT_LOG_DIR, DEFAULT_LOG_FILENAME)
}

export function appendDecision(
  entry: DecisionLogEntry,
  logPath: string = defaultLogPath()
): void {
  mkdirSync(dirname(logPath), { recursive: true })
  appendFileSync(logPath, JSON.stringify(entry) + '\n')
}

export function isLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AGENT_GATE_LOG === '1' || env.AGENT_GATE_LOG === 'true'
}
