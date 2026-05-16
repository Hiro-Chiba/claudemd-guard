import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  encodeProjectsPath,
  readClaudeCodeTranscript,
} from '../../../src/adapters/claude-code/transcript'

const ROOT = join(__dirname, '..', '..', '..', 'tmp', 'test-claude-transcript')

function freshHome(name: string): string {
  const dir = join(ROOT, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('encodeProjectsPath', () => {
  it('replaces / with - and prepends a leading -', () => {
    expect(encodeProjectsPath('/Users/me/project')).toBe('-Users-me-project')
  })

  it('handles trailing slash', () => {
    expect(encodeProjectsPath('/Users/me/project/')).toBe('-Users-me-project')
  })
})

describe('readClaudeCodeTranscript', () => {
  beforeEach(() => {
    mkdirSync(ROOT, { recursive: true })
  })
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('returns an empty array when no transcript directory exists', async () => {
    const home = freshHome('no-dir')
    const events = await readClaudeCodeTranscript({
      cwd: '/some/random/project',
      home,
    })
    expect(events).toEqual([])
  })

  it('reads the most recent jsonl in the encoded project directory', async () => {
    const home = freshHome('basic')
    const cwd = '/Users/test/proj'
    const encoded = encodeProjectsPath(cwd)
    const dir = join(home, '.claude', 'projects', encoded)
    mkdirSync(dir, { recursive: true })

    // Two transcripts; the second is more recent
    writeFileSync(
      join(dir, 'old.jsonl'),
      JSON.stringify({ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }) +
        '\n'
    )
    // Sleep one millisecond so mtimes differ deterministically.
    await new Promise((r) => setTimeout(r, 5))
    writeFileSync(
      join(dir, 'new.jsonl'),
      JSON.stringify({
        type: 'tool_use',
        name: 'Edit',
        input: { file_path: '/a' },
      }) +
        '\n' +
        JSON.stringify({
          type: 'tool_use',
          name: 'Write',
          input: { file_path: '/b' },
        }) +
        '\n'
    )

    const events = await readClaudeCodeTranscript({ cwd, home })
    expect(events.map((e) => e.toolName)).toEqual(['Edit', 'Write'])
  })

  it('honors the limit option (returns last N events)', async () => {
    const home = freshHome('limit')
    const cwd = '/p'
    const encoded = encodeProjectsPath(cwd)
    const dir = join(home, '.claude', 'projects', encoded)
    mkdirSync(dir, { recursive: true })
    const lines = ['a', 'b', 'c', 'd', 'e']
      .map((cmd) =>
        JSON.stringify({ type: 'tool_use', name: 'Bash', input: { command: cmd } })
      )
      .join('\n')
    writeFileSync(join(dir, 't.jsonl'), lines + '\n')

    const events = await readClaudeCodeTranscript({ cwd, home, limit: 2 })
    expect(events.map((e) => e.toolInput?.command)).toEqual(['d', 'e'])
  })

  it('skips malformed lines without throwing', async () => {
    const home = freshHome('malformed')
    const cwd = '/p'
    const dir = join(home, '.claude', 'projects', encodeProjectsPath(cwd))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 't.jsonl'),
      'not json\n' +
        JSON.stringify({ type: 'tool_use', name: 'Bash', input: { command: 'ok' } }) +
        '\n'
    )

    const events = await readClaudeCodeTranscript({ cwd, home })
    expect(events).toHaveLength(1)
    expect(events[0].toolInput?.command).toBe('ok')
  })

  it('classifies non-tool_use entries as user/assistant messages', async () => {
    const home = freshHome('classify')
    const cwd = '/p'
    const dir = join(home, '.claude', 'projects', encodeProjectsPath(cwd))
    mkdirSync(dir, { recursive: true })
    const lines = [
      { type: 'user', message: 'hi' },
      { type: 'assistant', message: 'hello' },
      { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_result', content: 'output' },
    ]
      .map((l) => JSON.stringify(l))
      .join('\n')
    writeFileSync(join(dir, 't.jsonl'), lines + '\n')

    const events = await readClaudeCodeTranscript({ cwd, home })
    expect(events.map((e) => e.kind)).toEqual([
      'user-message',
      'assistant-message',
      'tool-call',
      'tool-result',
    ])
  })
})
