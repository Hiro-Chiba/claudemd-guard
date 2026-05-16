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
import {
  getAdapter,
  availableAdapterIds,
  DEFAULT_ADAPTER_ID,
} from '../adapters'
import { Adapter } from '../adapters/Adapter'

const HELP_TEXT = `agent-gate — runtime enforcer for AI coding agent rules

Usage:
  agent-gate                        Run as a hook (reads JSON from stdin)
  agent-gate --agent <id>           Use the named adapter (default: claude-code)
  agent-gate install                Register the hook in ~/.claude/settings.json
  agent-gate uninstall              Remove the hook from ~/.claude/settings.json
  agent-gate --help                 Show this help
  agent-gate --version              Show version

Adapters (use with --agent):
  ${availableAdapterIds().join(', ')}

Environment:
  AGENT_GATE_MODEL        Validation model (default: claude-sonnet-4-6)
  AGENT_GATE_API_KEY      Use Anthropic API directly when set
  AGENT_GATE_COOLDOWN     Cooldown in seconds between validations (default: 0)
  AGENT_GATE_DISABLED     Set to "true" to disable the hook
  USE_SYSTEM_CLAUDE       Set to "true" to force PATH claude binary
`

export async function run(
  input: string,
  adapter?: Adapter
): Promise<ValidationResult> {
  return processHookData(input, adapter ? { adapter } : undefined)
}

function runHookMode(adapter: Adapter): void {
  let inputData = ''
  process.stdin.setEncoding('utf8')

  process.stdin.on('data', (chunk) => {
    inputData += chunk
  })

  process.stdin.on('end', async () => {
    try {
      const result = await run(inputData, adapter)
      console.log(adapter.formatResponse(result))
    } catch (error) {
      console.error('agent-gate error:', error)
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

  console.log(`agent-gate installed.`)
  console.log(`  settings: ${settingsFile}`)
  console.log(`  command:  ${hookCommand}`)
  console.log(`Restart Claude Code to activate.`)
}

function runUninstall(): void {
  const settingsFile = defaultSettingsPath()
  uninstallHook(settingsFile)

  console.log(`agent-gate uninstalled.`)
  console.log(`  settings: ${settingsFile}`)
  console.log(`Restart Claude Code to deactivate.`)
}

function printVersion(): void {
  const pkg = require('../../package.json') as { version?: string }
  console.log(pkg.version ?? 'unknown')
}

interface ParsedArgs {
  positional: string[]
  agentId: string
  showHelp: boolean
  showVersion: boolean
}

export function parseArgs(args: string[]): ParsedArgs {
  let agentId = DEFAULT_ADAPTER_ID
  let showHelp = false
  let showVersion = false
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--agent') {
      const next = args[i + 1]
      if (next) {
        agentId = next
        i++
      }
      continue
    }
    if (a.startsWith('--agent=')) {
      agentId = a.slice('--agent='.length)
      continue
    }
    if (a === '--help' || a === '-h' || a === 'help') {
      showHelp = true
      continue
    }
    if (a === '--version' || a === '-v') {
      showVersion = true
      continue
    }
    positional.push(a)
  }

  return { positional, agentId, showHelp, showVersion }
}

function main(): void {
  const parsedArgs = parseArgs(process.argv.slice(2))

  if (parsedArgs.showHelp) {
    console.log(HELP_TEXT)
    return
  }
  if (parsedArgs.showVersion) {
    printVersion()
    return
  }

  const adapter = getAdapter(parsedArgs.agentId)
  if (!adapter) {
    console.error(
      `Unknown adapter: ${parsedArgs.agentId}. Available: ${availableAdapterIds().join(', ')}`
    )
    process.exit(1)
  }

  const subcommand = parsedArgs.positional[0]
  switch (subcommand) {
    case undefined:
      runHookMode(adapter)
      return
    case 'install':
      runInstall()
      return
    case 'uninstall':
      runUninstall()
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
