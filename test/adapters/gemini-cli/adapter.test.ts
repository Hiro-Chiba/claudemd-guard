import { describe, it, expect, vi } from 'vitest'
import { geminiCliAdapter } from '../../../src/adapters/gemini-cli/adapter'
import * as fs from 'fs'

vi.mock('fs')

describe('geminiCliAdapter', () => {
  const sampleInput = {
    hook_event_name: 'BeforeTool',
    tool_name: 'run_shell_command',
    tool_input: { command: 'ls -la' },
    cwd: '/path/to/project',
    transcript_path: '/path/to/transcript.json'
  }

  describe('parseHook', () => {
    it('should parse valid Gemini CLI hook data', () => {
      const result = geminiCliAdapter.parseHook(JSON.stringify(sampleInput))
      if (result.kind !== 'action') throw new Error('Expected action')
      
      expect(result.action.toolName).toBe('run_shell_command')
      expect(result.action.toolInput).toEqual({ command: 'ls -la' })
      expect(result.action.transcriptPath).toBe('/path/to/transcript.json')
    })

    it('should skip if hook_event_name is not BeforeTool', () => {
      const input = { ...sampleInput, hook_event_name: 'AfterTool' }
      const result = geminiCliAdapter.parseHook(JSON.stringify(input))
      expect(result.kind).toBe('skip')
    })

    it('should skip on invalid JSON', () => {
      const result = geminiCliAdapter.parseHook('invalid')
      expect(result.kind).toBe('skip')
    })
  })

  describe('formatResponse', () => {
    it('should format block decision as Gemini CLI expects', () => {
      const response = geminiCliAdapter.formatResponse({
        decision: 'block',
        reason: 'forbidden command'
      })
      expect(JSON.parse(response)).toEqual({
        decision: 'block',
        reason: 'forbidden command'
      })
    })

    it('should format allow decision as Gemini CLI expects', () => {
      const response = geminiCliAdapter.formatResponse({
        decision: undefined,
        reason: 'all good'
      })
      expect(JSON.parse(response)).toEqual({
        decision: 'allow',
        reason: 'all good'
      })
    })
  })

  describe('readHistory', () => {
    it('should return empty array if no transcriptPath', async () => {
      const history = await geminiCliAdapter.readHistory({ cwd: '/test' })
      expect(history).toEqual([])
    })

    it('should return empty array if transcriptPath is an empty string (Gemini CLI stub)', async () => {
      // Per https://github.com/google-gemini/gemini-cli/issues/14715 the
      // hook currently passes an empty string for transcript_path.
      const history = await geminiCliAdapter.readHistory({
        cwd: '/test',
        transcriptPath: '',
      })
      expect(history).toEqual([])
    })

    it('should parse legacy JSON-array transcript (role-based)', async () => {
      const transcript = [
        { role: 'user', content: 'hello' },
        {
          role: 'model',
          content: 'thinking',
          tool_calls: [{
            id: '1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"a.txt"}' }
          }]
        },
        { role: 'tool', tool_call_id: '1', content: 'file content' }
      ]

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(transcript))

      const history = await geminiCliAdapter.readHistory({
        cwd: '/test',
        transcriptPath: '/test/transcript.json'
      })

      expect(history).toHaveLength(3)
      expect(history[0].kind).toBe('user-message')
      expect(history[1].kind).toBe('tool-call')
      expect(history[1].toolName).toBe('read_file')
      expect(history[2].kind).toBe('tool-result')
    })

    it('should return [] when JSON parses to a non-array (defensive guard)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ not: 'an array' })
      )

      const history = await geminiCliAdapter.readHistory({
        cwd: '/test',
        transcriptPath: '/test/transcript.json',
      })

      expect(history).toEqual([])
    })

    it('should parse JSONL transcript with type-based schema (future Gemini format)', async () => {
      // Per https://github.com/google-gemini/gemini-cli/issues/14715 and
      // https://github.com/google-gemini/gemini-cli/issues/15292 the
      // upcoming format is JSONL with `type` fields and `content` arrays.
      const lines = [
        '{"type":"session_metadata","sessionId":"abc","startTime":"2026-01-01"}',
        '{"type":"user","id":"m1","content":[{"text":"hello"}]}',
        '{"type":"gemini","id":"m2","content":[{"text":"hi"}]}',
        '{"type":"gemini","id":"m3","content":[{"toolCall":{"name":"read_file","args":{"path":"a.txt"}}}]}',
        '{"type":"tool_result","id":"m4","toolCallId":"tc-1","content":[{"text":"file body"}]}',
      ].join('\n')

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(lines)

      const history = await geminiCliAdapter.readHistory({
        cwd: '/test',
        transcriptPath: '/test/transcript.jsonl',
      })

      // session_metadata is skipped; the rest become events
      expect(history).toHaveLength(4)
      expect(history[0].kind).toBe('user-message')
      expect(history[1].kind).toBe('assistant-message')
      expect(history[2].kind).toBe('tool-call')
      expect(history[2].toolName).toBe('read_file')
      expect(history[3].kind).toBe('tool-result')
    })

    it('should ignore malformed JSONL lines instead of failing the whole transcript', async () => {
      const lines = [
        '{"type":"user","id":"m1","content":[{"text":"hello"}]}',
        'this is not json',
        '{"type":"gemini","id":"m2","content":[{"text":"hi"}]}',
      ].join('\n')

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(lines)

      const history = await geminiCliAdapter.readHistory({
        cwd: '/test',
        transcriptPath: '/test/transcript.jsonl',
      })

      expect(history).toHaveLength(2)
      expect(history[0].kind).toBe('user-message')
      expect(history[1].kind).toBe('assistant-message')
    })
  })
})
