#!/usr/bin/env node

import { realpathSync } from 'fs'
import {
  processHookData,
  DefaultNoConfigWarner,
} from '../hooks/processHookData'
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
  detectAdapter,
  claudeCodeAdapter,
} from '../adapters'
import { Adapter } from '../adapters/Adapter'
import { DaemonServer } from '../daemon/server'
import { sendToDaemon } from '../daemon/client'
import { defaultSocketPath } from '../daemon/protocol'
import { DecisionCache } from '../cache/DecisionCache'

const HELP_TEXT = `agent-gate — runtime enforcer for AI coding agent rules

Usage:
  agent-gate                        Run as a hook (reads JSON from stdin; auto-detects vendor)
  agent-gate --agent <id>           Force a specific adapter (override auto-detect)
  agent-gate install                Register the hook in ~/.claude/settings.json
  agent-gate uninstall              Remove the hook from ~/.claude/settings.json
  agent-gate daemon                 Start the long-lived daemon (Unix socket)
  agent-gate --help                 Show this help
  agent-gate --version              Show version

Adapters (auto-detected from the stdin payload; use --agent to force):
  ${availableAdapterIds().join(', ')}

Environment:
  AGENT_GATE_DISABLED                    Set to "true" to skip all checks
  AGENT_GATE_DISABLED_RULES              Comma-separated rule ids to skip
  AGENT_GATE_NO_CONFIG_WARNING           Set to "1" to silence the stderr warning when no .agent-gate.config.* is found
  AGENT_GATE_NO_CONFIG_WARNING_TTL_SEC   Throttle window for the above warning in seconds (default 3600)
  AGENT_GATE_MODEL                       Validation model (default: claude-sonnet-4-6)
  AGENT_GATE_API_KEY                     Use Anthropic API directly instead of the claude CLI
  AGENT_GATE_USE_SDK                     Set to "1" to prefer the Anthropic agent SDK over API/CLI
  USE_SYSTEM_CLAUDE                      Set to "true" to force the PATH claude binary
  AGENT_GATE_REASON_LANG                 AI reason language: auto (default) / en / ja / etc.
  AGENT_GATE_ON_ERROR                    Set to "block" to fail-closed on rule or model errors (default "allow")
  AGENT_GATE_COOLDOWN                    Cooldown in seconds between AI validations (default 0)
  AGENT_GATE_LOG                         Set to "1" to write decisions to ~/.agent-gate/log.jsonl
  AGENT_GATE_DAEMON                      Set to "1" to route hook calls through the daemon
  AGENT_GATE_SOCKET_PATH                 Daemon socket path (default: $TMPDIR/agent-gate.sock)
  AGENT_GATE_CACHE_TTL_SEC               Daemon decision cache TTL in seconds (default 60)
  AGENT_GATE_CACHE_SIZE                  Daemon decision cache max entries (default 256)
`

export async function run(
  input: string,
  adapter?: Adapter
): Promise<ValidationResult> {
  return processHookData(input, {
    ...(adapter ? { adapter } : {}),
    noConfigWarner: new DefaultNoConfigWarner(),
  })
}

function detectAdapterFromJson(input: string): Adapter {
  let raw: unknown = null
  try {
    raw = JSON.parse(input)
  } catch {
    // leave raw as null; detectAdapter falls back to claudeCodeAdapter
  }
  return detectAdapter(raw)
}

function runHookMode(explicitAdapter?: Adapter): void {
  let inputData = ''
  process.stdin.setEncoding('utf8')

  process.stdin.on('data', (chunk) => {
    inputData += chunk
  })

  process.stdin.on('end', async () => {
    const adapter = explicitAdapter ?? detectAdapterFromJson(inputData)
    try {
      if (process.env.AGENT_GATE_DAEMON === '1') {
        const socketPath =
          process.env.AGENT_GATE_SOCKET_PATH ?? defaultSocketPath()
        const resp = await sendToDaemon(
          { adapter: adapter.id, payload: inputData, cwd: process.cwd() },
          { socketPath, timeoutMs: 2000 }
        )
        if (resp !== null) {
          console.log(resp.output)
          process.exit(0)
        }
        // Daemon unreachable: fall through to direct mode.
      }
      const result = await run(inputData, adapter)
      console.log(adapter.formatResponse(result))
    } catch (error) {
      console.error('agent-gate error:', error)
      // Fail-open: emit a valid allow response so the agent can continue
      console.log(
        adapter.formatResponse({
          decision: undefined,
          reason: `Internal agent-gate error: ${error instanceof Error ? error.message : String(error)}`,
        })
      )
    } finally {
      process.exit(0)
    }
  })
}

async function runDaemon(): Promise<void> {
  const socketPath =
    process.env.AGENT_GATE_SOCKET_PATH ?? defaultSocketPath()

  // Shared decision cache lives for the lifetime of the daemon, so every
  // hook invocation benefits from prior verdicts.
  const ttlSec = parseInt(
    process.env.AGENT_GATE_CACHE_TTL_SEC ?? '60',
    10
  )
  const maxEntries = parseInt(
    process.env.AGENT_GATE_CACHE_SIZE ?? '256',
    10
  )
  const cache = new DecisionCache({
    ttlSec: Number.isNaN(ttlSec) ? 60 : ttlSec,
    maxEntries: Number.isNaN(maxEntries) ? 256 : maxEntries,
  })
  const noConfigWarner = new DefaultNoConfigWarner()

  const server = new DaemonServer({
    socketPath,
    handler: async (req) => {
      const adapter = getAdapter(req.adapter)
      if (!adapter) {
        return {
          output: JSON.stringify({
            error: `unknown adapter: ${req.adapter}`,
          }),
        }
      }
      const result = await processHookData(req.payload, {
        adapter,
        cwd: req.cwd,
        cache,
        noConfigWarner,
      })
      return { output: adapter.formatResponse(result) }
    },
  })
  await server.start()
  console.log(`agent-gate daemon listening on ${socketPath}`)
  const shutdown = async (): Promise<void> => {
    await server.stop()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
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
  /** Explicit adapter id from --agent. `undefined` means auto-detect. */
  agentId: string | undefined
  showHelp: boolean
  showVersion: boolean
}

export function parseArgs(args: string[]): ParsedArgs {
  let agentId: string | undefined = undefined
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
  const args = process.argv.slice(2)
  const parsedArgs = parseArgs(args)

  // A heuristic to detect if we are running in "hook mode" (no positional subcommands).
  // Positional subcommands are 'install', 'uninstall', 'daemon'.
  const isHookMode = parsedArgs.positional.length === 0

  try {
    if (parsedArgs.showHelp) {
      console.log(HELP_TEXT)
      return
    }
    if (parsedArgs.showVersion) {
      printVersion()
      return
    }

    // When --agent is omitted the adapter is auto-detected from the
    // stdin payload inside runHookMode. When provided, we resolve the
    // explicit override here so unknown ids fail fast.
    let explicitAdapter: Adapter | undefined = undefined
    if (parsedArgs.agentId !== undefined) {
      explicitAdapter = getAdapter(parsedArgs.agentId)
      if (!explicitAdapter) {
        if (isHookMode) {
          console.log(
            JSON.stringify({
              decision: 'allow',
              reason: `Unknown adapter: ${parsedArgs.agentId}`,
            })
          )
          process.exit(0)
        }
        console.error(
          `Unknown adapter: ${parsedArgs.agentId}. Available: ${availableAdapterIds().join(', ')}`
        )
        process.exit(1)
      }
    }

    const subcommand = parsedArgs.positional[0]
    switch (subcommand) {
      case undefined:
        runHookMode(explicitAdapter)
        return
      case 'install':
        runInstall()
        return
      case 'uninstall':
        runUninstall()
        return
      case 'daemon':
        void runDaemon()
        return
      default:
        console.error(`Unknown subcommand: ${subcommand}`)
        console.error(HELP_TEXT)
        process.exit(1)
    }
  } catch (error) {
    if (isHookMode) {
      handleHookError(error, parsedArgs.agentId)
      return
    }
    throw error
  }
}

/**
 * Ensures that hook mode always exits cleanly with a valid response,
 * even if a fatal crash occurs during startup.
 */
function handleHookError(error: unknown, agentId: string | undefined): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error('Fatal agent-gate error:', error)

  // Try the explicit adapter when one was specified; otherwise fall back
  // to Claude Code's formatter which most vendors tolerate as allow.
  const adapter =
    agentId !== undefined ? getAdapter(agentId) : claudeCodeAdapter
  if (adapter) {
    console.log(
      adapter.formatResponse({
        decision: undefined,
        reason: `Fatal error: ${message}`,
      })
    )
  } else {
    console.log(
      JSON.stringify({ decision: 'allow', reason: `Fatal error: ${message}` })
    )
  }
  process.exit(0)
}

if (require.main === module) {
  main()
}
