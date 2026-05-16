import { readFileSync, existsSync } from 'fs'
import {
  DecisionLogEntry,
  DecisionSource,
} from './decisionLogger'

export interface Stats {
  total: number
  blocks: number
  allows: number
  byRuleId: Record<string, number>
  bySource: Record<DecisionSource, number>
  byAdapter: Record<string, number>
  byTool: Record<string, number>
}

function emptyStats(): Stats {
  return {
    total: 0,
    blocks: 0,
    allows: 0,
    byRuleId: {},
    bySource: { deterministic: 0, ai: 0, pass: 0 },
    byAdapter: {},
    byTool: {},
  }
}

function inc<K extends string>(m: Record<K, number>, k: K): void {
  m[k] = (m[k] ?? 0) + 1
}

export function aggregateStats(entries: DecisionLogEntry[]): Stats {
  const stats = emptyStats()
  for (const e of entries) {
    stats.total++
    if (e.decision === 'block') stats.blocks++
    else stats.allows++
    if (e.ruleId) inc(stats.byRuleId, e.ruleId)
    inc(stats.bySource, e.source)
    inc(stats.byAdapter, e.adapter)
    inc(stats.byTool, e.toolName)
  }
  return stats
}

export function readStats(logPath: string): Stats {
  if (!existsSync(logPath)) return emptyStats()
  const content = readFileSync(logPath, 'utf-8')
  const entries: DecisionLogEntry[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      entries.push(JSON.parse(trimmed) as DecisionLogEntry)
    } catch {
      // Skip malformed lines.
    }
  }
  return aggregateStats(entries)
}

function formatRecord(label: string, rec: Record<string, number>): string {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return `${label}: (none)`
  const rendered = entries.map(([k, v]) => `  ${k}: ${v}`).join('\n')
  return `${label}:\n${rendered}`
}

export function formatStats(stats: Stats): string {
  const blockPct =
    stats.total > 0 ? Math.round((stats.blocks / stats.total) * 100) : 0
  const lines = [
    `Total decisions: ${stats.total}`,
    `Blocks: ${stats.blocks} (${blockPct}%)`,
    `Allows: ${stats.allows}`,
    '',
    formatRecord('By source', stats.bySource as unknown as Record<string, number>),
    '',
    formatRecord('By adapter', stats.byAdapter),
    '',
    formatRecord('By tool', stats.byTool),
    '',
    formatRecord('By rule id (deterministic)', stats.byRuleId),
  ]
  return lines.join('\n')
}
