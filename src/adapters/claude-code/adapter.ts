import { Adapter, ReadHistoryOptions } from '../Adapter'
import { ParsedHook } from '../../contracts/types/Action'
import { ValidationResult } from '../../contracts/types/ValidationResult'
import { HookDataSchema } from '../../contracts/schemas/hookDataSchema'
import { SessionEvent } from '../../contracts/types/SessionContext'
import { readClaudeCodeTranscript } from './transcript'

const HOOK_EVENT_PRE_TOOL_USE = 'PreToolUse'

// Claude Code event names besides Pre*/Post* prefixes that we still
// want to claim as ours during auto-detection so response formatting is
// vendor-correct even when no action is produced.
const CLAUDE_CODE_EVENT_NAMES = new Set([
  'Notification',
  'Stop',
  'SubagentStop',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
])

export const claudeCodeAdapter: Adapter = {
  id: 'claude-code',

  matches(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) return false
    const event = (raw as Record<string, unknown>)['hook_event_name']
    if (typeof event !== 'string') return false
    // PreToolUse, PostToolUse, PreCompact, etc.
    if (/^(Pre|Post)[A-Z]/.test(event)) return true
    return CLAUDE_CODE_EVENT_NAMES.has(event)
  },

  parseHook(stdinJson: string): ParsedHook {
    let raw: unknown
    try {
      raw = JSON.parse(stdinJson)
    } catch {
      return { kind: 'skip', reason: 'invalid JSON' }
    }

    const parsed = HookDataSchema.safeParse(raw)
    if (!parsed.success) {
      return { kind: 'skip', reason: 'unrecognized hook payload' }
    }

    const data = parsed.data
    if (data.hook_event_name !== HOOK_EVENT_PRE_TOOL_USE) {
      return { kind: 'skip', reason: `not a PreToolUse event: ${data.hook_event_name}` }
    }

    const toolName = data.tool_name
    const toolInput = data.tool_input
    if (!toolName || !toolInput) {
      return { kind: 'skip', reason: 'missing tool_name or tool_input' }
    }

    return {
      kind: 'action',
      action: { toolName, toolInput },
    }
  },

  formatResponse(result: ValidationResult): string {
    if (result.decision === 'block') {
      return JSON.stringify({ decision: 'block', reason: result.reason })
    }
    // Allow case: Claude Code expects no `decision` key (or null) for allow.
    return JSON.stringify({ reason: result.reason })
  },

  async readHistory(opts: ReadHistoryOptions): Promise<SessionEvent[]> {
    return readClaudeCodeTranscript({ cwd: opts.cwd, limit: opts.limit })
  },
}
