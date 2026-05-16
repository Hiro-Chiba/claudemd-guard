import { describe, it, expect } from 'vitest'
import { parseArgs } from '../../src/cli/agent-gate'

describe('parseArgs', () => {
  it('defaults agentId to claude-code when no --agent given', () => {
    const r = parseArgs([])
    expect(r.agentId).toBe('claude-code')
  })

  it('accepts --agent <id> form', () => {
    const r = parseArgs(['--agent', 'cursor'])
    expect(r.agentId).toBe('cursor')
  })

  it('accepts --agent=<id> form', () => {
    const r = parseArgs(['--agent=cursor'])
    expect(r.agentId).toBe('cursor')
  })

  it('preserves positional subcommand after the flag', () => {
    const r = parseArgs(['--agent', 'cursor', 'install'])
    expect(r.agentId).toBe('cursor')
    expect(r.positional).toEqual(['install'])
  })

  it('preserves positional subcommand before the flag', () => {
    const r = parseArgs(['install', '--agent', 'cursor'])
    expect(r.agentId).toBe('cursor')
    expect(r.positional).toEqual(['install'])
  })

  it('detects --help', () => {
    const r = parseArgs(['--help'])
    expect(r.showHelp).toBe(true)
  })

  it('detects --version', () => {
    const r = parseArgs(['--version'])
    expect(r.showVersion).toBe(true)
  })

  it('defaults ai to false', () => {
    expect(parseArgs([]).ai).toBe(false)
  })

  it('detects --ai', () => {
    const r = parseArgs(['lint', '--ai'])
    expect(r.ai).toBe(true)
    expect(r.positional).toEqual(['lint'])
  })
})
