import { describe, it, expect, vi } from 'vitest'
import { runDeterministicRules } from '../../src/deterministic/engine'
import { DeterministicRule } from '../../src/deterministic/types'

const allowRule: DeterministicRule = {
  id: 'always-allow',
  check: () => ({ kind: 'allow' }),
}

const blockRule = (id: string, reason: string): DeterministicRule => ({
  id,
  check: () => ({ kind: 'block', reason }),
})

describe('runDeterministicRules', () => {
  it('returns allow when the rule list is empty', () => {
    const verdict = runDeterministicRules('Bash', { command: 'ls' }, [])
    expect(verdict).toEqual({ kind: 'allow' })
  })

  it('returns allow when all rules allow', () => {
    const verdict = runDeterministicRules('Bash', { command: 'ls' }, [
      allowRule,
      allowRule,
    ])
    expect(verdict).toEqual({ kind: 'allow' })
  })

  it('returns the first block verdict encountered with the rule id', () => {
    const verdict = runDeterministicRules('Bash', { command: 'ls' }, [
      allowRule,
      blockRule('first-block', 'first reason'),
      blockRule('second-block', 'second reason'),
    ])
    expect(verdict).toEqual({
      kind: 'block',
      reason: 'first reason',
      ruleId: 'first-block',
    })
  })

  it('short-circuits: rules after the first block are not consulted', () => {
    const laterRule: DeterministicRule = {
      id: 'later-rule',
      check: vi.fn(() => ({ kind: 'allow' })),
    }
    runDeterministicRules('Bash', { command: 'ls' }, [
      blockRule('first', 'first'),
      laterRule,
    ])
    expect(laterRule.check).not.toHaveBeenCalled()
  })
})
