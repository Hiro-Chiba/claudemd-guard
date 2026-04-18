import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

export const DEFAULT_HOOK_MATCHER = 'Edit|Write|Bash'

export interface HookCommandEntry {
  type: string
  command: string
}

export interface HookMatcherEntry {
  matcher?: string
  hooks?: HookCommandEntry[]
}

export interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookMatcherEntry[]
    [key: string]: HookMatcherEntry[] | undefined
  }
  [key: string]: unknown
}

export function defaultSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json')
}

export function resolveHookCommand(resolvedScriptPath: string): string {
  if (!resolvedScriptPath) {
    return 'claudemd-guard'
  }
  return `node ${resolvedScriptPath}`
}

function readSettings(settingsFile: string): ClaudeSettings {
  if (!existsSync(settingsFile)) {
    return {}
  }
  const content = readFileSync(settingsFile, 'utf-8')
  if (content.trim() === '') {
    return {}
  }
  return JSON.parse(content) as ClaudeSettings
}

function writeSettings(settingsFile: string, settings: ClaudeSettings): void {
  mkdirSync(dirname(settingsFile), { recursive: true })
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n')
}

function isClaudemdGuardEntry(entry: HookMatcherEntry): boolean {
  return (entry.hooks ?? []).some(
    (h) => typeof h.command === 'string' && h.command.includes('claudemd-guard')
  )
}

export function installHook(
  hookCommand: string,
  settingsFile: string = defaultSettingsPath(),
  matcher: string = DEFAULT_HOOK_MATCHER
): ClaudeSettings {
  const settings = readSettings(settingsFile)

  if (!settings.hooks) settings.hooks = {}
  const preToolUse = settings.hooks.PreToolUse ?? []

  const filtered = preToolUse.filter((entry) => !isClaudemdGuardEntry(entry))

  filtered.push({
    matcher,
    hooks: [{ type: 'command', command: hookCommand }],
  })

  settings.hooks.PreToolUse = filtered

  writeSettings(settingsFile, settings)
  return settings
}

export function uninstallHook(
  settingsFile: string = defaultSettingsPath()
): ClaudeSettings {
  if (!existsSync(settingsFile)) {
    return {}
  }

  const settings = readSettings(settingsFile)

  if (settings.hooks?.PreToolUse) {
    const cleaned = settings.hooks.PreToolUse.filter(
      (entry) => !isClaudemdGuardEntry(entry)
    )

    if (cleaned.length === 0) {
      delete settings.hooks.PreToolUse
    } else {
      settings.hooks.PreToolUse = cleaned
    }

    if (settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks
    }
  }

  writeSettings(settingsFile, settings)
  return settings
}
