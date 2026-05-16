import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  aggregateStats,
  formatStats,
  readStats,
} from '../../src/observability/stats'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-stats')
const LOG_PATH = join(TEST_DIR, 'log.jsonl')

describe('aggregateStats', () => {
  it('counts decisions, sources, and per-rule firings', () => {
    const stats = aggregateStats([
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'block',
        reason: '',
        source: 'deterministic',
        ruleId: 'prevent-rm-rf-root',
      },
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'block',
        reason: '',
        source: 'deterministic',
        ruleId: 'prevent-rm-rf-root',
      },
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Edit',
        decision: 'allow',
        reason: '',
        source: 'ai',
      },
      {
        timestamp: 't',
        adapter: 'cursor',
        toolName: 'Bash',
        decision: 'block',
        reason: '',
        source: 'ai',
      },
    ])

    expect(stats.total).toBe(4)
    expect(stats.blocks).toBe(3)
    expect(stats.allows).toBe(1)
    expect(stats.byRuleId['prevent-rm-rf-root']).toBe(2)
    expect(stats.bySource.deterministic).toBe(2)
    expect(stats.bySource.ai).toBe(2)
    expect(stats.byAdapter['claude-code']).toBe(3)
    expect(stats.byAdapter.cursor).toBe(1)
  })

  it('returns zeroed structure for an empty input', () => {
    const stats = aggregateStats([])
    expect(stats.total).toBe(0)
    expect(stats.blocks).toBe(0)
    expect(stats.allows).toBe(0)
    expect(stats.byRuleId).toEqual({})
  })
})

describe('readStats / formatStats integration', () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }))
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

  it('reads a JSONL log and renders a human-readable summary', () => {
    const entries = [
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'block',
        reason: '',
        source: 'deterministic',
        ruleId: 'prevent-force-push-main',
      },
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'allow',
        reason: '',
        source: 'ai',
      },
    ]
    writeFileSync(
      LOG_PATH,
      entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
    )

    const stats = readStats(LOG_PATH)
    expect(stats.total).toBe(2)

    const text = formatStats(stats)
    expect(text).toContain('2')
    expect(text).toContain('prevent-force-push-main')
  })

  it('readStats returns zeroed structure when the log file does not exist', () => {
    const stats = readStats(join(TEST_DIR, 'nope.jsonl'))
    expect(stats.total).toBe(0)
  })

  it('readStats skips malformed lines without throwing', () => {
    writeFileSync(
      LOG_PATH,
      `{"timestamp":"t","adapter":"claude-code","toolName":"Bash","decision":"block","reason":"","source":"ai"}\nthis is not json\n`
    )
    const stats = readStats(LOG_PATH)
    expect(stats.total).toBe(1)
  })
})
