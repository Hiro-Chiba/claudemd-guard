import { join } from 'path'
import { tmpdir } from 'os'

export interface DaemonRequest {
  /** Adapter id (e.g. "claude-code", "cursor"). */
  adapter: string
  /** Raw hook payload (the vendor JSON the hook would have received). */
  payload: string
  /** Working directory the hook is firing from. */
  cwd: string
}

export interface DaemonResponse {
  /** Adapter-formatted stdout JSON the hook would have produced. */
  output: string
}

export interface DaemonErrorResponse {
  error: string
}

export function defaultSocketPath(): string {
  return join(tmpdir(), 'agent-gate.sock')
}
