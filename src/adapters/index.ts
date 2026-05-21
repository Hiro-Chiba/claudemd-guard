import { Adapter } from './Adapter'
import { claudeCodeAdapter } from './claude-code/adapter'
import { cursorAdapter } from './cursor/adapter'
import { geminiCliAdapter } from './gemini-cli/adapter'

export const DEFAULT_ADAPTER_ID = 'claude-code'

const ADAPTER_REGISTRY: Record<string, Adapter> = {
  'claude-code': claudeCodeAdapter,
  cursor: cursorAdapter,
  'gemini-cli': geminiCliAdapter,
}

// Probed in order. Vendors have disjoint hook_event_name namespaces
// (Pre*/Post* for Claude Code, Before*/After* for Gemini CLI, camelCase
// before*/after* for Cursor), so first-match-wins is unambiguous in
// practice.
const DETECTION_ORDER: Adapter[] = [
  cursorAdapter,
  geminiCliAdapter,
  claudeCodeAdapter,
]

export function getAdapter(id: string): Adapter | undefined {
  return ADAPTER_REGISTRY[id]
}

export function availableAdapterIds(): string[] {
  return Object.keys(ADAPTER_REGISTRY).sort()
}

/**
 * Pick the adapter whose `matches` accepts the already-parsed payload.
 * Falls back to the Claude Code adapter when nothing matches so that
 * malformed or unrecognized payloads still produce a valid (allow)
 * response shape.
 */
export function detectAdapter(rawPayload: unknown): Adapter {
  for (const adapter of DETECTION_ORDER) {
    if (adapter.matches(rawPayload)) return adapter
  }
  return claudeCodeAdapter
}

export { Adapter, claudeCodeAdapter, cursorAdapter, geminiCliAdapter }
