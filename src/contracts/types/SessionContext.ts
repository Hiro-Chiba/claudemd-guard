/**
 * One past action in an AI coding session, normalized across vendors.
 * Adapters convert their vendor-specific transcript events into this shape.
 */
export interface SessionEvent {
  kind: 'tool-call' | 'tool-result' | 'user-message' | 'assistant-message'
  toolName?: string
  toolInput?: Record<string, unknown>
  /** ISO 8601 timestamp if the adapter can supply one. */
  timestamp?: string
  /** Raw vendor payload for rules that want the original detail. */
  raw?: unknown
}

/**
 * Context built once per hook invocation and threaded through the
 * deterministic engine and AI validator. Rules and prompts can read
 * `history` to make context-aware decisions (TDD enforcement,
 * detecting drift, spotting repeated rule violations).
 */
export interface SessionContext {
  cwd: string
  projectRoot: string
  history: SessionEvent[]
}
