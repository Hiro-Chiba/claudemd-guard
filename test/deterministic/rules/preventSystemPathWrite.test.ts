import { describe, it, expect } from 'vitest'
import { preventSystemPathWrite } from '../../../src/deterministic/rules/preventSystemPathWrite'

describe('preventSystemPathWrite', () => {
  it('blocks Write to /etc/hosts', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/etc/hosts',
      content: '',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks Edit to /usr/local/bin/something', () => {
    const verdict = preventSystemPathWrite.check('Edit', {
      file_path: '/usr/local/bin/something',
      old_string: 'a',
      new_string: 'b',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks Write to /System/Library/foo (macOS)', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/System/Library/foo',
      content: '',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks Write to /Library/LaunchDaemons/foo.plist', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/Library/LaunchDaemons/foo.plist',
      content: '',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks Write to /var/log/foo (system log)', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/var/log/foo',
      content: '',
    })
    expect(verdict.kind).toBe('block')
  })

  it('allows Write to /Users/me/project/file.ts', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/Users/me/project/file.ts',
      content: '',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows Write to /home/me/project/file.ts', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: '/home/me/project/file.ts',
      content: '',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows Write to a relative path', () => {
    const verdict = preventSystemPathWrite.check('Write', {
      file_path: 'src/index.ts',
      content: '',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows Bash regardless of input', () => {
    const verdict = preventSystemPathWrite.check('Bash', {
      command: 'echo X > /etc/hosts',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows when file_path is missing', () => {
    const verdict = preventSystemPathWrite.check('Write', { content: '' })
    expect(verdict.kind).toBe('allow')
  })
})
