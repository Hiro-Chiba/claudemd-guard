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
import { readStats, formatStats } from '../observability/stats'
import { suggestRules, formatSuggestions } from '../observability/suggest'
import { defaultLogPath } from '../observability/decisionLogger'
import { defaultDeterministicRules } from '../deterministic/defaultRules'
import { collectRuleSources } from '../collector/collectRuleSources'
import { lintRuleSources } from '../doctor/lintRuleSources'
import { lintRuleSourcesWithAi } from '../doctor/lintRuleSourcesWithAi'
import { formatFindings } from '../doctor/formatFindings'
import { Config } from '../config/Config'
import { AnthropicApi } from '../validation/models/AnthropicApi'
import { ClaudeCli } from '../validation/models/ClaudeCli'
import { DaemonServer } from '../daemon/server'
import { sendToDaemon } from '../daemon/client'
import { defaultSocketPath } from '../daemon/protocol'
import { DecisionCache } from '../cache/DecisionCache'

const HELP_TEXT = `agent-gate — runtime enforcer for AI coding agent rules

Usage:
  agent-gate                        Run as a hook (reads JSON from stdin)
  agent-gate --agent <id>           Use the named adapter (default: claude-code)
  agent-gate install                Register the hook in ~/.claude/settings.json
  agent-gate uninstall              Remove the hook from ~/.claude/settings.json
  agent-gate stats                  Summarize decisions from the log file
  agent-gate suggest                Surface rule candidates and stale rules from the decision log
  agent-gate lint [--ai]            Audit CLAUDE.md / AGENTS.md / etc. for AI-friendliness
                                    (--ai adds AI-driven contradiction / ambiguity / missing-imperative checks)
  agent-gate daemon                 Start the long-lived daemon (Unix socket)
  agent-gate --help                 Show this help
  agent-gate --version              Show version

Adapters (use with --agent):
  ${availableAdapterIds().join(', ')}

Environment:
  AGENT_GATE_MODEL              Validation model (default: claude-sonnet-4-6)
  AGENT_GATE_API_KEY            Use Anthropic API directly when set
  AGENT_GATE_COOLDOWN           Cooldown in seconds between AI validations
  AGENT_GATE_DISABLED           Set to "true" to disable the whole tool
  AGENT_GATE_DISABLED_RULES     Comma-separated rule ids to disable
  AGENT_GATE_LOG                Set to "1" to write decisions to ~/.agent-gate/log.jsonl
  AGENT_GATE_DAEMON             Set to "1" to route hook calls through the daemon
  AGENT_GATE_SOCKET_PATH        Daemon socket path (default: $TMPDIR/agent-gate.sock)
  USE_SYSTEM_CLAUDE             Set to "true" to force PATH claude binary
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
  agentId: string
  showHelp: boolean
  showVersion: boolean
  ai: boolean
}

export function parseArgs(args: string[]): ParsedArgs {
  let agentId = DEFAULT_ADAPTER_ID
  let showHelp = false
  let showVersion = false
  let ai = false
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
    if (a === '--ai') {
      ai = true
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

  return { positional, agentId, showHelp, showVersion, ai }
}

function main(): void {
  try {
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
      // In hook mode, we MUST provide a valid JSON response even if the adapter is unknown
      const subcommand = parsedArgs.positional[0]
      if (subcommand === undefined) {
        console.log(JSON.stringify({ decision: 'allow', reason: `Unknown adapter: ${parsedArgs.agentId}` }))
        process.exit(0)
      }
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
      case 'stats':
        runStats()
        return
      case 'suggest':
        runSuggest()
        return
      case 'lint':
        void runLint(parsedArgs.ai)
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
    // Ultimate safety net: if we are likely in hook mode (no subcommand), 
    // always emit allow and exit 0.
    if (process.argv.slice(2).every(arg => arg.startsWith('-'))) {
      console.error('Fatal agent-gate error:', error)
      console.log(JSON.stringify({ decision: 'allow', reason: `Fatal error: ${error instanceof Error ? error.message : String(error)}` }))
      process.exit(0)
    }
    throw error
  }
}

function runStats(): void {
  const stats = readStats(defaultLogPath())
  console.log(formatStats(stats))
}

function runSuggest(): void {
  const windowDays = parseInt(
    process.env.AGENT_GATE_SUGGEST_WINDOW_DAYS ?? '7',
    10
  )
  const minPatternCount = parseInt(
    process.env.AGENT_GATE_SUGGEST_MIN_COUNT ?? '3',
    10
  )
  const knownRuleIds = defaultDeterministicRules.map((r) => r.id)
  const suggestions = suggestRules(defaultLogPath(), {
    windowDays: Number.isNaN(windowDays) ? 7 : windowDays,
    minPatternCount: Number.isNaN(minPatternCount) ? 3 : minPatternCount,
    knownRuleIds,
  })
  console.log(formatSuggestions(suggestions))
}

async function runLint(useAi: boolean): Promise<void> {
  const cwd = process.cwd()
  const sources = collectRuleSources(cwd)
  if (sources.length === 0) {
    console.log(
      'No instruction files found (looked for CLAUDE.md, AGENTS.md, .cursorrules, .cursor/rules/*.mdc, .clinerules/*.md, .windsurf/rules/*.md, .github/copilot-instructions.md, CONVENTIONS.md).'
    )
    return
  }
  const findings = lintRuleSources(sources)

  if (useAi) {
    const config = new Config()
    const client = config.useApi
      ? new AnthropicApi(config)
      : new ClaudeCli(config, cwd)
    const aiFindings = await lintRuleSourcesWithAi(sources, client)
    findings.push(...aiFindings)
  }

  console.log(formatFindings(findings))
  const hasError = findings.some((f) => f.severity === 'error')
  if (hasError) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}
