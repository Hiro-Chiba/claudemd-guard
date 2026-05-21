import { Adapter } from '../Adapter'
import { ParsedHook } from '../../contracts/types/Action'
import { ValidationResult } from '../../contracts/types/ValidationResult'

/**
 * Cursor 1.7 hook adapter.
 *
 * Cursor exposes pre-execution hooks (beforeShellExecution, beforeReadFile,
 * beforeFileEdit) and post-event hooks (afterFileEdit). agent-gate is a
 * prevention tool, so it only handles the "before" hooks; "after" payloads
 * are skipped because the operation already happened.
 *
 * The payload schema below is the best-effort shape based on Cursor's
 * public docs as of early 2026. Field names may need adjustment as
 * Cursor's hook API matures.
 */

const PRE_HOOK_EVENTS = new Set([
  'beforeShellExecution',
  'beforeReadFile',
  'beforeFileEdit',
])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export const cursorAdapter: Adapter = {
  id: 'cursor',

  matches(raw: unknown): boolean {
    if (!isObject(raw)) return false
    const event = raw['hook_event_name']
    // Cursor uses camelCase names like beforeShellExecution, afterFileEdit.
    return typeof event === 'string' && /^(before|after)[A-Z]/.test(event)
  },

  parseHook(stdinJson: string): ParsedHook {
    let raw: unknown
    try {
      raw = JSON.parse(stdinJson)
    } catch {
      return { kind: 'skip', reason: 'invalid JSON' }
    }
    if (!isObject(raw)) {
      return { kind: 'skip', reason: 'payload is not an object' }
    }

    const event = raw['hook_event_name']
    if (typeof event !== 'string' || !PRE_HOOK_EVENTS.has(event)) {
      return { kind: 'skip', reason: `not a pre-hook event: ${String(event)}` }
    }

    switch (event) {
      case 'beforeShellExecution': {
        const command = raw['command']
        if (typeof command !== 'string') {
          return { kind: 'skip', reason: 'missing command' }
        }
        return {
          kind: 'action',
          action: { toolName: 'Bash', toolInput: { command } },
        }
      }
      case 'beforeReadFile': {
        const filePath = raw['file_path']
        if (typeof filePath !== 'string') {
          return { kind: 'skip', reason: 'missing file_path' }
        }
        return {
          kind: 'action',
          action: { toolName: 'Read', toolInput: { file_path: filePath } },
        }
      }
      case 'beforeFileEdit': {
        const filePath = raw['file_path']
        if (typeof filePath !== 'string') {
          return { kind: 'skip', reason: 'missing file_path' }
        }
        const toolInput: Record<string, unknown> = { file_path: filePath }
        if (typeof raw['new_content'] === 'string') {
          toolInput.new_content = raw['new_content']
        }
        return {
          kind: 'action',
          action: { toolName: 'Edit', toolInput },
        }
      }
      default:
        return { kind: 'skip', reason: 'unrecognized event' }
    }
  },

  formatResponse(result: ValidationResult): string {
    if (result.decision === 'block') {
      return JSON.stringify({
        permission: 'deny',
        userMessage: result.reason,
      })
    }
    return JSON.stringify({ permission: 'allow' })
  },
}
