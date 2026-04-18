import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Config } from '../../../src/config/Config'

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}))

import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { ClaudeCli } from '../../../src/validation/models/ClaudeCli'

const mockedExecFileSync = vi.mocked(execFileSync)
const mockedExistsSync = vi.mocked(existsSync)
const mockedMkdirSync = vi.mocked(mkdirSync)

function makeSuccessResponse(text: string): string {
  return JSON.stringify({ result: text })
}

describe('ClaudeCli', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedExecFileSync.mockReturnValue(makeSuccessResponse('ok'))
    mockedExistsSync.mockReturnValue(true)
  })

  describe('getClaudeBinary (via ask)', () => {
    it('uses PATH claude when useSystemClaude=true', async () => {
      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('hello')

      const [binary] = mockedExecFileSync.mock.calls[0]
      expect(binary).toBe('claude')
    })

    it('uses ~/.claude/local/claude when local binary exists and useSystemClaude=false', async () => {
      mockedExistsSync.mockImplementation((p) => {
        const path = typeof p === 'string' ? p : p.toString()
        if (path.endsWith('.claude/local/claude')) return true
        return true
      })

      const config = new Config({ useSystemClaude: false, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('hello')

      const [binary] = mockedExecFileSync.mock.calls[0]
      expect(binary).toBe('/home/testuser/.claude/local/claude')
    })

    it('falls back to PATH claude when local binary does not exist', async () => {
      mockedExistsSync.mockImplementation((p) => {
        const path = typeof p === 'string' ? p : p.toString()
        if (path.endsWith('.claude/local/claude')) return false
        return true
      })

      const config = new Config({ useSystemClaude: false, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('hello')

      const [binary] = mockedExecFileSync.mock.calls[0]
      expect(binary).toBe('claude')
    })
  })

  describe('ask argument construction', () => {
    it('passes model from config', async () => {
      const config = new Config({ model: 'claude-opus-4-7', useSystemClaude: true })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('prompt body')

      const [, args] = mockedExecFileSync.mock.calls[0]
      expect(args).toContain('--model')
      const modelIndex = (args as string[]).indexOf('--model')
      expect((args as string[])[modelIndex + 1]).toBe('claude-opus-4-7')
    })

    it('includes stdin marker, output-format json, max-turns 1, disallowed tools, strict-mcp-config', async () => {
      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('prompt')

      const [, args] = mockedExecFileSync.mock.calls[0]
      const argArray = args as string[]
      expect(argArray[0]).toBe('-')
      expect(argArray).toContain('--output-format')
      expect(argArray[argArray.indexOf('--output-format') + 1]).toBe('json')
      expect(argArray).toContain('--max-turns')
      expect(argArray[argArray.indexOf('--max-turns') + 1]).toBe('1')
      expect(argArray).toContain('--disallowed-tools')
      expect(argArray).toContain('--strict-mcp-config')
    })

    it('prepends SYSTEM_PROMPT to user prompt and passes via stdin input', async () => {
      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('USER_PROMPT_BODY')

      const [, , options] = mockedExecFileSync.mock.calls[0]
      const input = (options as { input: string }).input
      expect(input).toContain('USER_PROMPT_BODY')
      expect(input).toContain('CLAUDE.md enforcer')
    })

    it('sets cwd to <projectCwd>/.claude', async () => {
      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/my/project')

      await cli.ask('prompt')

      const [, , options] = mockedExecFileSync.mock.calls[0]
      expect((options as { cwd: string }).cwd).toBe('/my/project/.claude')
    })
  })

  describe('.claude directory handling', () => {
    it('creates .claude directory when missing', async () => {
      mockedExistsSync.mockImplementation((p) => {
        const path = typeof p === 'string' ? p : p.toString()
        if (path.endsWith('/.claude')) return false
        return true
      })

      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('prompt')

      expect(mockedMkdirSync).toHaveBeenCalledWith('/project/.claude', {
        recursive: true,
      })
    })

    it('does not create .claude directory when it already exists', async () => {
      mockedExistsSync.mockReturnValue(true)

      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      await cli.ask('prompt')

      expect(mockedMkdirSync).not.toHaveBeenCalled()
    })
  })

  describe('response parsing', () => {
    it('returns the result field from JSON output', async () => {
      mockedExecFileSync.mockReturnValue(
        makeSuccessResponse('{"decision": "block", "reason": "stop"}')
      )

      const config = new Config({ useSystemClaude: true, model: 'claude-sonnet-4-6' })
      const cli = new ClaudeCli(config, '/project')

      const result = await cli.ask('prompt')

      expect(result).toBe('{"decision": "block", "reason": "stop"}')
    })
  })
})
