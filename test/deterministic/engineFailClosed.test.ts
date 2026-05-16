import { describe, it, expect } from 'vitest'
import { runDeterministicRules } from '../../src/deterministic/engine'
import { DeterministicRule } from '../../src/deterministic/types'

const throwingRule: DeterministicRule = {
  id: 'boom',
  check: () => {
    throw new Error('rule boom')
  },
}

const allowRule: DeterministicRule = {
  id: 'allow',
  check: () => ({ kind: 'allow' }),
}

describe('runDeterministicRules: onError option', () => {
  it('default behavior: a throwing rule is swallowed and the engine continues', () => {
    const out = runDeterministicRules('Bash', { command: 'ls' }, [
      throwingRule,
      allowRule,
    ])
    expect(out.kind).toBe('allow')
  })

  it('onError="allow" matches the default (forward compatibility)', () => {
    const out = runDeterministicRules(
      'Bash',
      { command: 'ls' },
      [throwingRule, allowRule],
      undefined,
      { onError: 'allow' }
    )
    expect(out.kind).toBe('allow')
  })

  it('onError="block" turns a thrown rule into a block verdict', () => {
    const out = runDeterministicRules(
      'Bash',
      { command: 'ls' },
      [throwingRule],
      undefined,
      { onError: 'block' }
    )
    expect(out.kind).toBe('block')
    if (out.kind === 'block') {
      expect(out.ruleId).toBe('boom')
      expect(out.reason).toMatch(/rule boom|failed/i)
    }
  })

  it('onError="block" returns the block as soon as the first throw happens', () => {
    let secondCalled = false
    const trackingRule: DeterministicRule = {
      id: 'tracking',
      check: () => {
        secondCalled = true
        return { kind: 'allow' }
      },
    }
    runDeterministicRules(
      'Bash',
      { command: 'ls' },
      [throwingRule, trackingRule],
      undefined,
      { onError: 'block' }
    )
    expect(secondCalled).toBe(false)
  })
})
