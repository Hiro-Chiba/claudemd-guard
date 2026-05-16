import { SessionContext } from '../contracts/types/SessionContext'

export type RuleVerdict =
  | { kind: 'allow' }
  | { kind: 'block'; reason: string }

export interface DeterministicRule {
  id: string
  /**
   * Decide whether to block this tool operation.
   *
   * @param toolName - normalized tool name (e.g. "Bash", "Edit", "Write").
   * @param toolInput - normalized tool input fields.
   * @param ctx - optional session context with history and project paths.
   *   Existing rules ignore this argument; new rules can read it.
   */
  check(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx?: SessionContext
  ): RuleVerdict
}
