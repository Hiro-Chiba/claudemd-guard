import { existsSync, readFileSync } from 'fs'
import { Adapter, ReadHistoryOptions } from '../Adapter'
import { ParsedHook } from '../../contracts/types/Action'
import { ValidationResult } from '../../contracts/types/ValidationResult'
import { HookDataSchema } from '../../contracts/schemas/hookDataSchema'
import { SessionEvent } from '../../contracts/types/SessionContext'

const HOOK_EVENT_BEFORE_TOOL = 'BeforeTool'

export const geminiCliAdapter: Adapter = {
  id: 'gemini-cli',

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
    if (data.hook_event_name !== HOOK_EVENT_BEFORE_TOOL) {
      return { kind: 'skip', reason: `not a ${HOOK_EVENT_BEFORE_TOOL} event: ${data.hook_event_name}` }
    }

    const toolName = data.tool_name
    const toolInput = data.tool_input
    if (!toolName || !toolInput) {
      return { kind: 'skip', reason: 'missing tool_name or tool_input' }
    }

    return {
      kind: 'action',
      action: {
        toolName,
        toolInput,
        transcriptPath: data.transcript_path,
      },
    }
  },

  formatResponse(result: ValidationResult): string {
    return JSON.stringify({
      decision: result.decision === 'block' ? 'block' : 'allow',
      reason: result.reason,
    })
  },

  async readHistory(opts: ReadHistoryOptions): Promise<SessionEvent[]> {
    if (!opts.transcriptPath || !existsSync(opts.transcriptPath)) {
      return []
    }

    let content: string
    try {
      content = readFileSync(opts.transcriptPath, 'utf-8')
    } catch {
      return []
    }

    const messages = parseTranscript(content)
    const events: SessionEvent[] = []
    for (const msg of messages) {
      for (const evt of classifyMessage(msg)) {
        events.push(evt)
      }
    }

    const limit = opts.limit ?? events.length
    return events.slice(-limit)
  },
}

/**
 * Parse a transcript file into a list of message objects.
 *
 * Gemini CLI's transcript format is in flux (see
 * https://github.com/google-gemini/gemini-cli/issues/14715 and
 * https://github.com/google-gemini/gemini-cli/issues/15292). To be robust:
 *   - If the file looks like a JSON array (starts with `[`), parse it whole.
 *   - Otherwise treat it as JSONL: parse line by line, skipping malformed lines.
 */
function parseTranscript(content: string): unknown[] {
  const trimmed = content.trimStart()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(content) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  const out: unknown[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t))
    } catch {
      // Tolerate a single malformed line instead of throwing the whole file away.
    }
  }
  return out
}

function classifyMessage(raw: unknown): SessionEvent[] {
  if (!raw || typeof raw !== 'object') return []
  const m = raw as Record<string, unknown>
  if (typeof m.type === 'string') return classifyByType(m)
  if (typeof m.role === 'string') return classifyByRole(m)
  return []
}

/**
 * Gemini CLI's planned JSONL schema uses a `type` field
 * (https://github.com/google-gemini/gemini-cli/issues/15292).
 */
function classifyByType(m: Record<string, unknown>): SessionEvent[] {
  const t = m.type
  if (t === 'session_metadata' || t === 'message_update') return []
  if (t === 'user') return [{ kind: 'user-message', raw: m }]
  if (t === 'gemini' || t === 'assistant' || t === 'model') {
    const calls = extractTypeBasedToolCalls(m)
    if (calls.length > 0) return calls
    return [{ kind: 'assistant-message', raw: m }]
  }
  if (t === 'tool' || t === 'tool_result') {
    return [{ kind: 'tool-result', raw: m }]
  }
  return []
}

function extractTypeBasedToolCalls(m: Record<string, unknown>): SessionEvent[] {
  const content = m.content
  if (!Array.isArray(content)) return []
  const out: SessionEvent[] = []
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const tc = (part as Record<string, unknown>).toolCall
    if (!tc || typeof tc !== 'object') continue
    const tcObj = tc as Record<string, unknown>
    const args = tcObj.args
    out.push({
      kind: 'tool-call',
      toolName: typeof tcObj.name === 'string' ? tcObj.name : undefined,
      toolInput:
        args && typeof args === 'object'
          ? (args as Record<string, unknown>)
          : undefined,
      raw: m,
    })
  }
  return out
}

/**
 * Legacy / OpenAI-style schema with a `role` field and `tool_calls` array.
 * Kept for backward compatibility with non-stock transcript formats.
 */
function classifyByRole(m: Record<string, unknown>): SessionEvent[] {
  const role = m.role
  if (role === 'user') return [{ kind: 'user-message', raw: m }]
  if (role === 'model' || role === 'assistant') {
    const calls = extractRoleBasedToolCalls(m)
    if (calls.length > 0) return calls
    return [{ kind: 'assistant-message', raw: m }]
  }
  if (role === 'tool') return [{ kind: 'tool-result', raw: m }]
  return []
}

function extractRoleBasedToolCalls(m: Record<string, unknown>): SessionEvent[] {
  const calls = m.tool_calls
  if (!Array.isArray(calls)) return []
  const out: SessionEvent[] = []
  for (const c of calls) {
    if (!c || typeof c !== 'object') continue
    const tc = c as Record<string, unknown>
    const fn = tc.function as Record<string, unknown> | undefined
    let toolInput: Record<string, unknown> | undefined
    if (fn && typeof fn.arguments === 'string') {
      try {
        toolInput = JSON.parse(fn.arguments) as Record<string, unknown>
      } catch {
        // ignore unparseable arguments
      }
    }
    out.push({
      kind: 'tool-call',
      toolName: fn && typeof fn.name === 'string' ? fn.name : undefined,
      toolInput,
      raw: m,
    })
  }
  return out
}
