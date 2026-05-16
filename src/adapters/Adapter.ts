import { ParsedHook } from '../contracts/types/Action'
import { ValidationResult } from '../contracts/types/ValidationResult'

/**
 * An Adapter bridges a specific AI coding tool's hook API to agent-gate's
 * normalized pipeline. Each adapter:
 *   1. parses the vendor's stdin JSON into a ParsedHook,
 *   2. formats agent-gate's ValidationResult into the vendor's expected
 *      stdout JSON.
 */
export interface Adapter {
  /** Identifier used for CLI dispatch and logging. */
  readonly id: string

  /** Parse stdin JSON into a normalized ParsedHook. */
  parseHook(stdinJson: string): ParsedHook

  /** Format a ValidationResult into the vendor-specific stdout JSON. */
  formatResponse(result: ValidationResult): string
}
