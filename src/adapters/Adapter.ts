import { ParsedHook } from '../contracts/types/Action'
import { ValidationResult } from '../contracts/types/ValidationResult'
import { SessionEvent } from '../contracts/types/SessionContext'

export interface ReadHistoryOptions {
  cwd: string
  /** Max events to return. Adapters should honor this; default is impl-defined. */
  limit?: number
  /** Path to the transcript file if provided by the adapter's parseHook. */
  transcriptPath?: string
  /** Extra metadata if provided by the adapter's parseHook. */
  metadata?: Record<string, unknown>
}

/**
 * An Adapter bridges a specific AI coding tool's hook API to agent-gate's
 * normalized pipeline. Each adapter:
 *   1. parses the vendor's stdin JSON into a ParsedHook,
 *   2. formats agent-gate's ValidationResult into the vendor's expected
 *      stdout JSON,
 *   3. optionally reads the vendor's transcript file to provide
 *      SessionContext.history to rules and the AI prompt.
 */
export interface Adapter {
  /** Identifier used for CLI dispatch and logging. */
  readonly id: string

  /**
   * Returns true iff the parsed stdin payload (already JSON.parse'd, so
   * `unknown`) is recognizably from this vendor. Used by auto-detection
   * to route an incoming hook payload to the right adapter without
   * requiring `--agent <id>`. Must work for both action and post-event
   * payloads so response formatting stays vendor-correct even when no
   * action is produced.
   */
  matches(rawPayload: unknown): boolean

  /** Parse stdin JSON into a normalized ParsedHook. */
  parseHook(stdinJson: string): ParsedHook

  /** Format a ValidationResult into the vendor-specific stdout JSON. */
  formatResponse(result: ValidationResult): string

  /**
   * Read recent session events from the vendor's transcript. Optional;
   * an adapter that cannot read history should omit this method or
   * return an empty array.
   */
  readHistory?(opts: ReadHistoryOptions): Promise<SessionEvent[]>
}
