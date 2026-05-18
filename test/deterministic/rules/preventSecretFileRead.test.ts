import { describe, it, expect } from 'vitest'
import { preventSecretFileRead } from '../../../src/deterministic/rules/preventSecretFileRead'

describe('preventSecretFileRead', () => {
  it('blocks read_file for .env', () => {
    const verdict = preventSecretFileRead.check('read_file', {
      file_path: '.env',
    })
    expect(verdict.kind).toBe('block')
    if (verdict.kind === 'block') {
      expect(verdict.reason).toMatch(/refusing to read.*secret.*\.env/i)
    }
  })

  it('blocks read_many_files containing .env', () => {
    const verdict = preventSecretFileRead.check('read_many_files', {
      file_paths: ['src/main.ts', '.env.local'],
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks read_file for .ssh/id_rsa', () => {
    const verdict = preventSecretFileRead.check('read_file', {
      file_path: '/Users/user/.ssh/id_rsa',
    })
    expect(verdict.kind).toBe('block')
  })

  it('allows read_file for regular files', () => {
    const verdict = preventSecretFileRead.check('read_file', {
      file_path: 'src/index.ts',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows non-read tools', () => {
    const verdict = preventSecretFileRead.check('list_directory', {
      dir_path: '.',
    })
    expect(verdict.kind).toBe('allow')
  })
})
