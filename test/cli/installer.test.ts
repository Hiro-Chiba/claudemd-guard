import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'fs'
import { join } from 'path'
import {
  installHook,
  uninstallHook,
  resolveHookCommand,
  DEFAULT_HOOK_MATCHER,
} from '../../src/cli/installer'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-installer')
const SETTINGS_FILE = join(TEST_DIR, 'settings.json')

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('resolveHookCommand', () => {
  it('returns node <abs path> when a resolved path is given', () => {
    const result = resolveHookCommand('/opt/claudegate/dist/cli/claudegate.js')
    expect(result).toBe('node /opt/claudegate/dist/cli/claudegate.js')
  })

  it('returns node <abs path> for any non-empty resolved path (realpath of bin symlink)', () => {
    const result = resolveHookCommand(
      '/usr/local/lib/node_modules/claudegate/dist/cli/claudegate.js'
    )
    expect(result).toBe(
      'node /usr/local/lib/node_modules/claudegate/dist/cli/claudegate.js'
    )
  })

  it('falls back to plain "claudegate" when path is empty (realpath failure)', () => {
    const result = resolveHookCommand('')
    expect(result).toBe('claudegate')
  })
})

describe('installHook', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('creates settings.json with PreToolUse hook when file does not exist', () => {
    installHook('claudegate', SETTINGS_FILE)

    expect(existsSync(SETTINGS_FILE)).toBe(true)
    const settings = readJson(SETTINGS_FILE) as {
      hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> }
    }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.PreToolUse[0].matcher).toBe(DEFAULT_HOOK_MATCHER)
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('claudegate')
  })

  it('preserves other settings when adding hook', () => {
    writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({
        theme: 'dark',
        permissions: { allow: ['Bash(ls:*)'] },
      })
    )

    installHook('claudegate', SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as {
      theme: string
      permissions: { allow: string[] }
      hooks: { PreToolUse: unknown[] }
    }
    expect(settings.theme).toBe('dark')
    expect(settings.permissions.allow).toEqual(['Bash(ls:*)'])
    expect(settings.hooks.PreToolUse).toHaveLength(1)
  })

  it('replaces existing claudegate entry instead of duplicating', () => {
    installHook('node /old/path/claudegate.js', SETTINGS_FILE)
    installHook('claudegate', SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as {
      hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('claudegate')
  })

  it('preserves unrelated PreToolUse hooks', () => {
    writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Edit',
              hooks: [{ type: 'command', command: 'other-hook' }],
            },
          ],
        },
      })
    )

    installHook('claudegate', SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as {
      hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(settings.hooks.PreToolUse).toHaveLength(2)
    const commands = settings.hooks.PreToolUse.map((e) => e.hooks[0].command)
    expect(commands).toContain('other-hook')
    expect(commands).toContain('claudegate')
  })

  it('handles empty settings.json content', () => {
    writeFileSync(SETTINGS_FILE, '')
    installHook('claudegate', SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as {
      hooks: { PreToolUse: unknown[] }
    }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
  })
})

describe('uninstallHook', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('is a no-op when settings.json does not exist', () => {
    uninstallHook(SETTINGS_FILE)
    expect(existsSync(SETTINGS_FILE)).toBe(false)
  })

  it('removes the claudegate hook entry', () => {
    installHook('claudegate', SETTINGS_FILE)
    uninstallHook(SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as { hooks?: unknown }
    expect(settings.hooks).toBeUndefined()
  })

  it('preserves unrelated hooks and deletes empty PreToolUse array', () => {
    writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({
        theme: 'dark',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Edit|Write|Bash',
              hooks: [{ type: 'command', command: 'claudegate' }],
            },
            {
              matcher: 'Edit',
              hooks: [{ type: 'command', command: 'other-hook' }],
            },
          ],
        },
      })
    )

    uninstallHook(SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE) as {
      theme: string
      hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(settings.theme).toBe('dark')
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('other-hook')
  })

  it('deletes hooks key entirely when all entries were claudegate', () => {
    installHook('claudegate', SETTINGS_FILE)
    uninstallHook(SETTINGS_FILE)

    const settings = readJson(SETTINGS_FILE)
    expect(settings).toEqual({})
  })
})
