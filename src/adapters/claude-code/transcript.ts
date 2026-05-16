import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { SessionEvent } from '../../contracts/types/SessionContext'

/**
 * Encode a project path into the directory name Claude Code uses under
 * `~/.claude/projects/`. The convention: replace `/` with `-`, drop
 * trailing slash. e.g. `/Users/me/proj` -> `-Users-me-proj`.
 */
export function encodeProjectsPath(cwd: string): string {
  let trimmed = cwd
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1)
  }
  return trimmed.replace(/\//g, '-')
}

export interface ReadClaudeCodeTranscriptOptions {
  cwd: string
  /** Override $HOME for testing. Defaults to os.homedir(). */
  home?: string
  /** Max events to return. Returns the last `limit` events. */
  limit?: number
}

interface RawTranscriptLine {
  type?: string
  name?: string
  input?: Record<string, unknown>
  message?: unknown
  content?: unknown
  timestamp?: string
}

function classify(raw: RawTranscriptLine): SessionEvent | null {
  const t = raw.type
  if (t === 'tool_use') {
    return {
      kind: 'tool-call',
      toolName: typeof raw.name === 'string' ? raw.name : undefined,
      toolInput:
        raw.input && typeof raw.input === 'object'
          ? (raw.input as Record<string, unknown>)
          : undefined,
      timestamp: raw.timestamp,
      raw,
    }
  }
  if (t === 'tool_result') {
    return {
      kind: 'tool-result',
      timestamp: raw.timestamp,
      raw,
    }
  }
  if (t === 'user') {
    return { kind: 'user-message', timestamp: raw.timestamp, raw }
  }
  if (t === 'assistant') {
    return { kind: 'assistant-message', timestamp: raw.timestamp, raw }
  }
  return null
}

function pickMostRecentJsonl(dir: string): string | null {
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((name) => name.endsWith('.jsonl'))
  } catch {
    return null
  }
  if (entries.length === 0) return null
  let best: { name: string; mtime: number } | null = null
  for (const name of entries) {
    try {
      const m = statSync(join(dir, name)).mtimeMs
      if (!best || m > best.mtime) best = { name, mtime: m }
    } catch {
      // skip
    }
  }
  return best ? join(dir, best.name) : null
}

export async function readClaudeCodeTranscript(
  opts: ReadClaudeCodeTranscriptOptions
): Promise<SessionEvent[]> {
  const home = opts.home ?? homedir()
  const dir = join(home, '.claude', 'projects', encodeProjectsPath(opts.cwd))
  if (!existsSync(dir)) return []

  const file = pickMostRecentJsonl(dir)
  if (!file) return []

  let content: string
  try {
    content = readFileSync(file, 'utf-8')
  } catch {
    return []
  }

  const events: SessionEvent[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let raw: RawTranscriptLine
    try {
      raw = JSON.parse(trimmed) as RawTranscriptLine
    } catch {
      continue
    }
    const evt = classify(raw)
    if (evt) events.push(evt)
  }

  const limit = opts.limit ?? events.length
  return events.slice(-limit)
}
