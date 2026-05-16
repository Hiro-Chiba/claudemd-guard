import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import {
  appendDecision,
  DecisionLogEntry,
} from '../../src/observability/decisionLogger'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-decision-logger')
const LOG_PATH = join(TEST_DIR, 'log.jsonl')

describe('appendDecision', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('appends a JSONL entry to the log file', () => {
    const entry: DecisionLogEntry = {
      timestamp: '2026-05-16T12:00:00.000Z',
      adapter: 'claude-code',
      toolName: 'Bash',
      decision: 'block',
      reason: 'rm -rf /',
      source: 'deterministic',
      ruleId: 'prevent-rm-rf-root',
    }
    appendDecision(entry, LOG_PATH)

    expect(existsSync(LOG_PATH)).toBe(true)
    const content = readFileSync(LOG_PATH, 'utf-8')
    expect(content.trim()).toBe(JSON.stringify(entry))
  })

  it('appends multiple entries as separate lines', () => {
    appendDecision(
      {
        timestamp: 't1',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'block',
        reason: 'r1',
        source: 'deterministic',
        ruleId: 'rule-a',
      },
      LOG_PATH
    )
    appendDecision(
      {
        timestamp: 't2',
        adapter: 'claude-code',
        toolName: 'Edit',
        decision: 'allow',
        reason: '',
        source: 'pass',
      },
      LOG_PATH
    )

    const lines = readFileSync(LOG_PATH, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(2)
    const parsed = lines.map((l) => JSON.parse(l) as DecisionLogEntry)
    expect(parsed[0].ruleId).toBe('rule-a')
    expect(parsed[1].decision).toBe('allow')
  })

  it('creates the parent directory if it does not exist', () => {
    const nested = join(TEST_DIR, 'deep', 'sub', 'log.jsonl')
    appendDecision(
      {
        timestamp: 't',
        adapter: 'claude-code',
        toolName: 'Bash',
        decision: 'allow',
        reason: '',
        source: 'pass',
      },
      nested
    )
    expect(existsSync(nested)).toBe(true)
  })
})
