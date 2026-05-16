import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  loadAgentGateConfig,
} from '../../src/config/AgentGateConfig'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-agent-gate-config')

describe('loadAgentGateConfig', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    delete process.env.AGENT_GATE_DISABLED_RULES
  })

  it('returns empty disabled_rules when no config file and no env var', () => {
    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual([])
  })

  it('reads disabled_rules from .agent-gate.json', () => {
    writeFileSync(
      join(TEST_DIR, '.agent-gate.json'),
      JSON.stringify({ disabled_rules: ['prevent-rm-rf-root'] })
    )

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual(['prevent-rm-rf-root'])
  })

  it('merges env var AGENT_GATE_DISABLED_RULES with file values', () => {
    writeFileSync(
      join(TEST_DIR, '.agent-gate.json'),
      JSON.stringify({ disabled_rules: ['prevent-rm-rf-root'] })
    )
    process.env.AGENT_GATE_DISABLED_RULES =
      'prevent-force-push-main,prevent-system-path-write'

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules.sort()).toEqual([
      'prevent-force-push-main',
      'prevent-rm-rf-root',
      'prevent-system-path-write',
    ])
  })

  it('handles invalid JSON gracefully by returning empty config', () => {
    writeFileSync(join(TEST_DIR, '.agent-gate.json'), '{ not json')
    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual([])
  })

  it('reads protected_branches from config when present', () => {
    writeFileSync(
      join(TEST_DIR, '.agent-gate.json'),
      JSON.stringify({ protected_branches: ['main', 'release/v1'] })
    )
    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.protectedBranches).toEqual(['main', 'release/v1'])
  })

  it('reads extra_secret_paths from config when present', () => {
    writeFileSync(
      join(TEST_DIR, '.agent-gate.json'),
      JSON.stringify({ extra_secret_paths: ['vault/', 'secrets/'] })
    )
    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.extraSecretPathPrefixes).toEqual(['vault/', 'secrets/'])
  })

  it('walks upward to find .agent-gate.json in a parent directory', () => {
    const sub = join(TEST_DIR, 'subproject')
    mkdirSync(sub, { recursive: true })
    writeFileSync(
      join(TEST_DIR, '.agent-gate.json'),
      JSON.stringify({ disabled_rules: ['prevent-rm-rf-root'] })
    )

    const cfg = loadAgentGateConfig(sub)
    expect(cfg.disabledRules).toContain('prevent-rm-rf-root')
  })
})
