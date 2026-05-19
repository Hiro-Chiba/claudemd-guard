import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import { join } from 'path'
import {
  loadAgentGateConfig,
} from '../../src/config/AgentGateConfig'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

const TEST_DIR = '/mock/test/dir'

describe('loadAgentGateConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  afterEach(() => {
    delete process.env.AGENT_GATE_DISABLED_RULES
  })

  it('returns empty disabled_rules when no config file and no env var', () => {
    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual([])
    expect(cfg.found).toBe(false)
  })

  it('reads disabled_rules from .agent-gate.json and sets found: true', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.agent-gate.json')) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ disabled_rules: ['prevent-rm-rf-root'] })
    )

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual(['prevent-rm-rf-root'])
    expect(cfg.found).toBe(true)
  })

  it('merges env var AGENT_GATE_DISABLED_RULES with file values', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.agent-gate.json')) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue(
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
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.agent-gate.json')) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue('{ not json')

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.disabledRules).toEqual([])
  })

  it('reads protected_branches from config when present', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.agent-gate.json')) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ protected_branches: ['main', 'release/v1'] })
    )

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.protectedBranches).toEqual(['main', 'release/v1'])
  })

  it('reads extra_secret_paths from config when present', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.agent-gate.json')) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ extra_secret_paths: ['vault/', 'secrets/'] })
    )

    const cfg = loadAgentGateConfig(TEST_DIR)
    expect(cfg.extraSecretPathPrefixes).toEqual(['vault/', 'secrets/'])
  })
})
