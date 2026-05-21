import { describe, it, expect } from 'vitest'
import { claudeCodeAdapter } from '../../../src/adapters/claude-code/adapter'

describe('claudeCodeAdapter', () => {
  describe('parseHook', () => {
    it('parses a PreToolUse Bash event into an Action', () => {
      const input = JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
      })

      const parsed = claudeCodeAdapter.parseHook(input)

      expect(parsed.kind).toBe('action')
      if (parsed.kind === 'action') {
        expect(parsed.action.toolName).toBe('Bash')
        expect(parsed.action.toolInput).toEqual({ command: 'ls -la' })
      }
    })

    it('skips PostToolUse events', () => {
      const input = JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      })

      const parsed = claudeCodeAdapter.parseHook(input)

      expect(parsed.kind).toBe('skip')
    })

    it('skips invalid JSON', () => {
      const parsed = claudeCodeAdapter.parseHook('not json')
      expect(parsed.kind).toBe('skip')
    })

    it('skips when tool_name is missing', () => {
      const input = JSON.stringify({ hook_event_name: 'PreToolUse' })
      const parsed = claudeCodeAdapter.parseHook(input)
      expect(parsed.kind).toBe('skip')
    })
  })

  describe('formatResponse', () => {
    it('formats an allow result as a JSON object with no decision', () => {
      const formatted = claudeCodeAdapter.formatResponse({
        decision: undefined,
        reason: 'ok',
      })
      const parsed = JSON.parse(formatted) as { decision?: string; reason?: string }
      expect(parsed.decision).toBeUndefined()
    })

    it('formats a block result with decision: "block" and the reason', () => {
      const formatted = claudeCodeAdapter.formatResponse({
        decision: 'block',
        reason: 'because',
      })
      const parsed = JSON.parse(formatted) as { decision: string; reason: string }
      expect(parsed.decision).toBe('block')
      expect(parsed.reason).toBe('because')
    })
  })

  it('exposes id "claude-code"', () => {
    expect(claudeCodeAdapter.id).toBe('claude-code')
  })

  describe('matches', () => {
    it('matches PreToolUse', () => {
      expect(
        claudeCodeAdapter.matches({ hook_event_name: 'PreToolUse' })
      ).toBe(true)
    })

    it('matches PostToolUse', () => {
      expect(
        claudeCodeAdapter.matches({ hook_event_name: 'PostToolUse' })
      ).toBe(true)
    })

    it('matches non-prefix events like Notification, Stop, UserPromptSubmit', () => {
      for (const event of [
        'Notification',
        'Stop',
        'SubagentStop',
        'UserPromptSubmit',
        'SessionStart',
        'SessionEnd',
      ]) {
        expect(claudeCodeAdapter.matches({ hook_event_name: event })).toBe(
          true
        )
      }
    })

    it('does not match Gemini CLI BeforeTool', () => {
      expect(
        claudeCodeAdapter.matches({ hook_event_name: 'BeforeTool' })
      ).toBe(false)
    })

    it('does not match Cursor camelCase events', () => {
      expect(
        claudeCodeAdapter.matches({
          hook_event_name: 'beforeShellExecution',
        })
      ).toBe(false)
    })

    it('does not match non-object payloads', () => {
      expect(claudeCodeAdapter.matches(null)).toBe(false)
      expect(claudeCodeAdapter.matches('string')).toBe(false)
      expect(claudeCodeAdapter.matches(42)).toBe(false)
    })

    it('does not match when hook_event_name is missing', () => {
      expect(claudeCodeAdapter.matches({})).toBe(false)
    })
  })
})
