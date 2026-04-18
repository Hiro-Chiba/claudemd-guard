#!/usr/bin/env node

import { realpathSync } from 'fs'
import { processHookData } from '../hooks/processHookData'
import { ValidationResult } from '../contracts/types/ValidationResult'
import {
  installHook,
  uninstallHook,
  resolveHookCommand,
  defaultSettingsPath,
} from './installer'

const HELP_TEXT = `claudemd-guard — AI-powered CLAUDE.md enforcer for Claude Code

Usage:
  claudemd-guard              Run as a PreToolUse hook (reads JSON from stdin)
  claudemd-guard install      Register the hook in ~/.claude/settings.json
  claudemd-guard uninstall    Remove the hook from ~/.claude/settings.json
  claudemd-guard --help       Show this help
  claudemd-guard --version    Show version

Environment:
  CLAUDEMD_GUARD_MODEL        Validation model (default: claude-sonnet-4-6)
  CLAUDEMD_GUARD_API_KEY      Use Anthropic API directly when set
  CLAUDEMD_GUARD_COOLDOWN     Cooldown in seconds between validations (default: 0)
  CLAUDEMD_GUARD_DISABLED     Set to "true" to disable the hook
  USE_SYSTEM_CLAUDE           Set to "true" to force PATH claude binary
`

export async function run(input: string): Promise<ValidationResult> {
  return processHookData(input)
}

function runHookMode(): void {
  let inputData = ''
  process.stdin.setEncoding('utf8')

  process.stdin.on('data', (chunk) => {
    inputData += chunk
  })

  process.stdin.on('end', async () => {
    try {
      const result = await run(inputData)
      console.log(JSON.stringify(result))
    } catch (error) {
      console.error('claudemd-guard error:', error)
    } finally {
      process.exit(0)
    }
  })
}

function runInstall(): void {
  const rawScriptPath = process.argv[1] ?? ''
  let effectivePath = ''
  try {
    if (rawScriptPath) {
      effectivePath = realpathSync(rawScriptPath)
    }
  } catch {
    effectivePath = ''
  }

  const hookCommand = resolveHookCommand(effectivePath)
  const settingsFile = defaultSettingsPath()

  installHook(hookCommand, settingsFile)

  console.log(`claudemd-guard installed.`)
  console.log(`  settings: ${settingsFile}`)
  console.log(`  command:  ${hookCommand}`)
  console.log(`Restart Claude Code to activate.`)
}

function runUninstall(): void {
  const settingsFile = defaultSettingsPath()
  uninstallHook(settingsFile)

  console.log(`claudemd-guard uninstalled.`)
  console.log(`  settings: ${settingsFile}`)
  console.log(`Restart Claude Code to deactivate.`)
}

function printVersion(): void {
  const pkg = require('../../package.json') as { version?: string }
  console.log(pkg.version ?? 'unknown')
}

function main(): void {
  const args = process.argv.slice(2)
  const subcommand = args[0]

  switch (subcommand) {
    case undefined:
      runHookMode()
      return
    case 'install':
      runInstall()
      return
    case 'uninstall':
      runUninstall()
      return
    case '--help':
    case '-h':
    case 'help':
      console.log(HELP_TEXT)
      return
    case '--version':
    case '-v':
      printVersion()
      return
    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error(HELP_TEXT)
      process.exit(1)
  }
}

if (require.main === module) {
  main()
}
