import { describe, it, expect } from 'vitest'
import { preventRmRfRoot } from '../../../src/deterministic/rules/preventRmRfRoot'

describe('preventRmRfRoot', () => {
  it('blocks Bash with `rm -rf /`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf /' })
    expect(verdict.kind).toBe('block')
    if (verdict.kind === 'block') {
      expect(verdict.reason).toMatch(/rm.*-rf|root|catastrophic/i)
    }
  })

  it('allows Bash with `rm -rf ./build`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf ./build' })
    expect(verdict.kind).toBe('allow')
  })

  it('blocks `rm -rf $HOME`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf $HOME' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `rm -rf ~`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf ~' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `rm -rf ~/`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf ~/' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `rm -rf /etc`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf /etc' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `rm -rf /usr`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -rf /usr' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks reversed flag `rm -fr /`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -fr /' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks uppercase flag `rm -Rf /`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm -Rf /' })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `sudo rm -rf /`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'sudo rm -rf /' })
    expect(verdict.kind).toBe('block')
  })

  it('allows non-rm Bash command `ls /`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'ls /' })
    expect(verdict.kind).toBe('allow')
  })

  it('allows non-recursive `rm /tmp/foo`', () => {
    const verdict = preventRmRfRoot.check('Bash', { command: 'rm /tmp/foo' })
    expect(verdict.kind).toBe('allow')
  })

  it('allows non-Bash tools regardless of input', () => {
    const verdict = preventRmRfRoot.check('Edit', { command: 'rm -rf /' })
    expect(verdict.kind).toBe('allow')
  })
})
