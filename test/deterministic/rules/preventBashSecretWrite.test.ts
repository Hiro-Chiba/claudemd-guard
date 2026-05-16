import { describe, it, expect } from 'vitest'
import { preventBashSecretWrite } from '../../../src/deterministic/rules/preventBashSecretWrite'

describe('preventBashSecretWrite', () => {
  it('blocks `echo X > .env`', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo API_KEY=foo > .env',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks `echo X >> .env.local`', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo X >> .env.local',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks redirect to .ssh/id_rsa', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'cat keyfile > ~/.ssh/id_rsa',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks redirect to .aws/credentials', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo "[default]" > ~/.aws/credentials',
    })
    expect(verdict.kind).toBe('block')
  })

  it('blocks tee writing to .env', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo X | tee .env',
    })
    expect(verdict.kind).toBe('block')
  })

  it('allows redirect to a non-secret file', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo hello > /tmp/out.txt',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows reading from .env (`cat .env`)', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'cat .env',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows writing to .env.example (template)', () => {
    const verdict = preventBashSecretWrite.check('Bash', {
      command: 'echo X > .env.example',
    })
    expect(verdict.kind).toBe('allow')
  })

  it('allows non-Bash tools', () => {
    const verdict = preventBashSecretWrite.check('Edit', {
      file_path: '/p/.env',
    })
    expect(verdict.kind).toBe('allow')
  })
})
