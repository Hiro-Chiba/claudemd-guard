import { describe, it, expect } from 'vitest'
import { cursorAdapter } from '../../../src/adapters/cursor/adapter'

describe('cursorAdapter', () => {
  describe('parseHook', () => {
    it('parses a beforeShellExecution event into a Bash Action', () => {
      const input = JSON.stringify({
        hook_event_name: 'beforeShellExecution',
        command: 'ls -la',
      })

      const parsed = cursorAdapter.parseHook(input)

      expect(parsed.kind).toBe('action')
      if (parsed.kind === 'action') {
        expect(parsed.action.toolName).toBe('Bash')
        expect(parsed.action.toolInput).toEqual({ command: 'ls -la' })
      }
    })

    it('parses a beforeReadFile event into a Read Action', () => {
      const input = JSON.stringify({
        hook_event_name: 'beforeReadFile',
        file_path: '/p/file.ts',
      })

      const parsed = cursorAdapter.parseHook(input)

      expect(parsed.kind).toBe('action')
      if (parsed.kind === 'action') {
        expect(parsed.action.toolName).toBe('Read')
        expect(parsed.action.toolInput).toEqual({ file_path: '/p/file.ts' })
      }
    })

    it('parses a beforeFileEdit event into an Edit Action', () => {
      const input = JSON.stringify({
        hook_event_name: 'beforeFileEdit',
        file_path: '/p/a.ts',
        new_content: 'updated',
      })

      const parsed = cursorAdapter.parseHook(input)

      expect(parsed.kind).toBe('action')
      if (parsed.kind === 'action') {
        expect(parsed.action.toolName).toBe('Edit')
        expect(parsed.action.toolInput).toMatchObject({
          file_path: '/p/a.ts',
        })
      }
    })

    it('skips afterFileEdit (post-event)', () => {
      const input = JSON.stringify({
        hook_event_name: 'afterFileEdit',
        file_path: '/p/a.ts',
      })

      const parsed = cursorAdapter.parseHook(input)

      expect(parsed.kind).toBe('skip')
    })

    it('skips invalid JSON', () => {
      const parsed = cursorAdapter.parseHook('not json')
      expect(parsed.kind).toBe('skip')
    })

    it('skips unknown hook_event_name', () => {
      const input = JSON.stringify({ hook_event_name: 'somethingElse' })
      const parsed = cursorAdapter.parseHook(input)
      expect(parsed.kind).toBe('skip')
    })
  })

  describe('formatResponse', () => {
    it('formats an allow result with permission: "allow"', () => {
      const formatted = cursorAdapter.formatResponse({
        decision: undefined,
        reason: 'ok',
      })
      const parsed = JSON.parse(formatted) as { permission?: string }
      expect(parsed.permission).toBe('allow')
    })

    it('formats a block result with permission: "deny" and the reason', () => {
      const formatted = cursorAdapter.formatResponse({
        decision: 'block',
        reason: 'no good',
      })
      const parsed = JSON.parse(formatted) as { permission?: string; userMessage?: string }
      expect(parsed.permission).toBe('deny')
      expect(parsed.userMessage).toBe('no good')
    })
  })

  it('exposes id "cursor"', () => {
    expect(cursorAdapter.id).toBe('cursor')
  })

  describe('matches', () => {
    it('matches the documented camelCase pre-events', () => {
      for (const event of [
        'beforeShellExecution',
        'beforeReadFile',
        'beforeFileEdit',
      ]) {
        expect(cursorAdapter.matches({ hook_event_name: event })).toBe(true)
      }
    })

    it('matches camelCase post-events (afterFileEdit) so formatting stays Cursor-shaped', () => {
      expect(
        cursorAdapter.matches({ hook_event_name: 'afterFileEdit' })
      ).toBe(true)
    })

    it('does not match Claude Code PascalCase events', () => {
      expect(cursorAdapter.matches({ hook_event_name: 'PreToolUse' })).toBe(
        false
      )
    })

    it('does not match Gemini CLI BeforeTool', () => {
      expect(cursorAdapter.matches({ hook_event_name: 'BeforeTool' })).toBe(
        false
      )
    })

    it('does not match non-object payloads', () => {
      expect(cursorAdapter.matches(null)).toBe(false)
      expect(cursorAdapter.matches([])).toBe(false)
    })
  })
})
