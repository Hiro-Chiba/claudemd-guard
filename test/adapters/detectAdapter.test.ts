import { describe, it, expect } from 'vitest'
import {
  detectAdapter,
  claudeCodeAdapter,
  cursorAdapter,
  geminiCliAdapter,
} from '../../src/adapters'

describe('detectAdapter', () => {
  it('routes a Claude Code PreToolUse payload to claudeCodeAdapter', () => {
    expect(
      detectAdapter({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      })
    ).toBe(claudeCodeAdapter)
  })

  it('routes a Gemini CLI BeforeTool payload to geminiCliAdapter', () => {
    expect(
      detectAdapter({
        hook_event_name: 'BeforeTool',
        tool_name: 'run_shell_command',
        tool_input: { command: 'ls' },
      })
    ).toBe(geminiCliAdapter)
  })

  it('routes a Cursor beforeShellExecution payload to cursorAdapter', () => {
    expect(
      detectAdapter({
        hook_event_name: 'beforeShellExecution',
        command: 'ls',
      })
    ).toBe(cursorAdapter)
  })

  it('falls back to claudeCodeAdapter on null', () => {
    expect(detectAdapter(null)).toBe(claudeCodeAdapter)
  })

  it('falls back to claudeCodeAdapter on payloads with no hook_event_name', () => {
    expect(detectAdapter({})).toBe(claudeCodeAdapter)
  })

  it('falls back to claudeCodeAdapter on unrecognized event names', () => {
    expect(
      detectAdapter({ hook_event_name: 'somethingCompletelyUnknown' })
    ).toBe(claudeCodeAdapter)
  })

  it('routes Cursor post-events (afterFileEdit) to cursorAdapter for correct response shape', () => {
    expect(
      detectAdapter({
        hook_event_name: 'afterFileEdit',
        file_path: '/p/a.ts',
      })
    ).toBe(cursorAdapter)
  })
})
