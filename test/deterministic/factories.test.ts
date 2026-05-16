import { describe, it, expect } from 'vitest'
import {
  forbidCommandPattern,
  forbidContentPattern,
  forbidFilePathPattern,
} from '../../src/deterministic/factories'

describe('forbidCommandPattern', () => {
  it('produces a rule with the given id and blocks matching Bash commands', () => {
    const rule = forbidCommandPattern({
      id: 'no-drop-table',
      match: /drop\s+table/i,
      reason: 'DROP TABLE is forbidden. Use a migration instead.',
    })
    expect(rule.id).toBe('no-drop-table')

    const verdict = rule.check('Bash', { command: 'DROP TABLE users;' })
    expect(verdict.kind).toBe('block')
    if (verdict.kind === 'block') {
      expect(verdict.reason).toMatch(/forbidden|migration/i)
    }
  })

  it('allows commands that do not match', () => {
    const rule = forbidCommandPattern({
      id: 'no-foo',
      match: /foo/,
      reason: 'no foo',
    })
    expect(rule.check('Bash', { command: 'echo bar' }).kind).toBe('allow')
  })

  it('does not fire on non-Bash tools', () => {
    const rule = forbidCommandPattern({
      id: 'no-foo',
      match: /foo/,
      reason: 'no foo',
    })
    expect(rule.check('Edit', { command: 'foo' }).kind).toBe('allow')
  })

  it('allows when command is missing or non-string', () => {
    const rule = forbidCommandPattern({
      id: 'no-foo',
      match: /foo/,
      reason: 'no foo',
    })
    expect(rule.check('Bash', {}).kind).toBe('allow')
    expect(rule.check('Bash', { command: 123 }).kind).toBe('allow')
  })
})

describe('forbidContentPattern', () => {
  it('blocks Write whose content matches', () => {
    const rule = forbidContentPattern({
      id: 'no-api-key',
      match: /sk-[A-Za-z0-9]{20,}/,
      reason: 'Hardcoded API key detected.',
    })
    const verdict = rule.check('Write', {
      file_path: '/p/x.ts',
      content: 'const key = "sk-abcdefghijklmnopqrstuv"',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks Edit whose new_string matches', () => {
    const rule = forbidContentPattern({
      id: 'no-api-key',
      match: /SECRET=/,
      reason: 'hardcoded secret',
    })
    const verdict = rule.check('Edit', {
      file_path: '/p/x.ts',
      old_string: 'a',
      new_string: 'SECRET=abc',
    })
    expect(verdict.kind).toBe('block')
  })

  it('allows when content does not match', () => {
    const rule = forbidContentPattern({
      id: 'no-foo',
      match: /foo/,
      reason: '',
    })
    expect(
      rule.check('Write', { file_path: '/p/x.ts', content: 'bar' }).kind
    ).toBe('allow')
  })

  it('ignores non-Write/Edit tools', () => {
    const rule = forbidContentPattern({
      id: 'no-foo',
      match: /foo/,
      reason: '',
    })
    expect(rule.check('Bash', { command: 'foo' }).kind).toBe('allow')
  })
})

describe('forbidFilePathPattern', () => {
  it('blocks Write/Edit on matching paths', () => {
    const rule = forbidFilePathPattern({
      id: 'no-prod-config',
      match: /production\.yml$/,
      reason: 'Do not edit production config directly.',
    })
    expect(
      rule.check('Write', { file_path: '/p/config/production.yml', content: '' })
        .kind
    ).toBe('block')
    expect(
      rule.check('Edit', {
        file_path: '/p/config/production.yml',
        old_string: 'a',
        new_string: 'b',
      }).kind
    ).toBe('block')
  })

  it('allows non-matching paths', () => {
    const rule = forbidFilePathPattern({
      id: 'no-prod-config',
      match: /production\.yml$/,
      reason: '',
    })
    expect(
      rule.check('Write', { file_path: '/p/config/dev.yml', content: '' }).kind
    ).toBe('allow')
  })

  it('ignores Bash', () => {
    const rule = forbidFilePathPattern({
      id: 'x',
      match: /./,
      reason: '',
    })
    expect(rule.check('Bash', { command: 'ls' }).kind).toBe('allow')
  })
})
