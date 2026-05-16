import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { loadPluginConfig } from '../../src/config/PluginConfigLoader'

const ROOT = join(__dirname, '..', '..', 'tmp', 'test-plugin-config')

function freshDir(name: string): string {
  const dir = join(ROOT, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('loadPluginConfig', () => {
  beforeEach(() => {
    mkdirSync(ROOT, { recursive: true })
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('returns an empty config when no file exists', () => {
    const dir = freshDir('empty')
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules ?? []).toEqual([])
    expect(cfg.customRules ?? []).toEqual([])
  })

  it('loads a .agent-gate.config.js file via CommonJS export', () => {
    const dir = freshDir('cjs')
    writeFileSync(
      join(dir, '.agent-gate.config.js'),
      `module.exports = {
         disabledRules: ['prevent-rm-rf-root'],
         protectedBranches: ['main', 'release'],
       }`
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules).toEqual(['prevent-rm-rf-root'])
    expect(cfg.protectedBranches).toEqual(['main', 'release'])
  })

  it('loads a .agent-gate.config.mjs file via default ESM export', () => {
    const dir = freshDir('mjs')
    writeFileSync(
      join(dir, '.agent-gate.config.mjs'),
      `export default {
         disabledRules: ['prevent-system-path-write'],
       }`
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules).toEqual(['prevent-system-path-write'])
  })

  it('loads a .agent-gate.config.ts file with an inline custom rule', () => {
    const dir = freshDir('ts')
    writeFileSync(
      join(dir, '.agent-gate.config.ts'),
      `export default {
         customRules: [{
           id: 'no-drop',
           check: (toolName, toolInput) => {
             if (toolName === 'Bash' && typeof toolInput.command === 'string' &&
                 /drop\\s+table/i.test(toolInput.command)) {
               return { kind: 'block', reason: 'no drop' }
             }
             return { kind: 'allow' }
           }
         }]
       }`
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.customRules).toHaveLength(1)
    expect(cfg.customRules![0].id).toBe('no-drop')
    expect(
      cfg.customRules![0].check('Bash', { command: 'DROP TABLE users' }).kind
    ).toBe('block')
  })

  it('falls back to .agent-gate.json when no JS/TS config is present', () => {
    const dir = freshDir('json')
    writeFileSync(
      join(dir, '.agent-gate.json'),
      JSON.stringify({ disabled_rules: ['prevent-force-push-main'] })
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules).toEqual(['prevent-force-push-main'])
  })

  it('prefers .agent-gate.config.ts over .agent-gate.json when both exist', () => {
    const dir = freshDir('priority')
    writeFileSync(
      join(dir, '.agent-gate.json'),
      JSON.stringify({ disabled_rules: ['from-json'] })
    )
    writeFileSync(
      join(dir, '.agent-gate.config.ts'),
      `export default { disabledRules: ['from-ts'] }`
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules).toEqual(['from-ts'])
  })

  it('walks upward to find the config in a parent directory', () => {
    const dir = freshDir('walk')
    const sub = join(dir, 'a', 'b')
    mkdirSync(sub, { recursive: true })
    writeFileSync(
      join(dir, '.agent-gate.config.js'),
      `module.exports = { disabledRules: ['parent-rule'] }`
    )
    const cfg = loadPluginConfig(sub)
    expect(cfg.disabledRules).toEqual(['parent-rule'])
  })

  it('returns empty config when the file throws on load', () => {
    const dir = freshDir('throw')
    writeFileSync(
      join(dir, '.agent-gate.config.js'),
      `throw new Error('bad config')`
    )
    const cfg = loadPluginConfig(dir)
    expect(cfg.disabledRules ?? []).toEqual([])
  })
})
