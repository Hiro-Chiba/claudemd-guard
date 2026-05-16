import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { collectRuleSources } from '../../src/collector/collectRuleSources'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-rule-sources')

describe('collectRuleSources', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('collects CLAUDE.md and tags it claude-md', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# claude rules')

    const result = collectRuleSources(TEST_DIR)

    const file = result.find((f) => f.path === join(TEST_DIR, 'CLAUDE.md'))
    expect(file).toBeDefined()
    expect(file!.kind).toBe('claude-md')
    expect(file!.content).toBe('# claude rules')
  })

  it('collects AGENTS.md and tags it agents-md', () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# agents rules')

    const result = collectRuleSources(TEST_DIR)

    const file = result.find((f) => f.path === join(TEST_DIR, 'AGENTS.md'))
    expect(file).toBeDefined()
    expect(file!.kind).toBe('agents-md')
    expect(file!.content).toBe('# agents rules')
  })

  it('collects both CLAUDE.md and AGENTS.md when both exist', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'claude')
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), 'agents')

    const result = collectRuleSources(TEST_DIR)

    const localFiles = result.filter((f) => f.path.startsWith(TEST_DIR))
    expect(localFiles.map((f) => f.kind).sort()).toEqual([
      'agents-md',
      'claude-md',
    ])
  })

  it('collects .cursorrules and tags it cursorrules', () => {
    writeFileSync(join(TEST_DIR, '.cursorrules'), 'cursor legacy rules')

    const result = collectRuleSources(TEST_DIR)
    const file = result.find((f) => f.path === join(TEST_DIR, '.cursorrules'))
    expect(file).toBeDefined()
    expect(file!.kind).toBe('cursorrules')
  })

  it('collects .cursor/rules/*.mdc and tags them cursor-mdc', () => {
    const rulesDir = join(TEST_DIR, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'main.mdc'), '---\nfoo: bar\n---\nrules')
    writeFileSync(join(rulesDir, 'README.md'), 'should NOT be picked up')

    const result = collectRuleSources(TEST_DIR)
    const mdcFiles = result.filter((f) => f.kind === 'cursor-mdc')
    expect(mdcFiles.map((f) => f.path)).toContain(join(rulesDir, 'main.mdc'))
    expect(mdcFiles).toHaveLength(1)
  })

  it('collects .clinerules/*.md and tags them clinerules', () => {
    const clineDir = join(TEST_DIR, '.clinerules')
    mkdirSync(clineDir, { recursive: true })
    writeFileSync(join(clineDir, 'one.md'), 'cline 1')
    writeFileSync(join(clineDir, 'two.md'), 'cline 2')

    const result = collectRuleSources(TEST_DIR)
    const found = result.filter((f) => f.kind === 'clinerules')
    expect(found.map((f) => f.path).sort()).toEqual(
      [join(clineDir, 'one.md'), join(clineDir, 'two.md')].sort()
    )
  })

  it('collects .windsurf/rules/*.md and tags them windsurf-rule', () => {
    const windsurfDir = join(TEST_DIR, '.windsurf', 'rules')
    mkdirSync(windsurfDir, { recursive: true })
    writeFileSync(join(windsurfDir, 'guidelines.md'), 'windsurf')

    const result = collectRuleSources(TEST_DIR)
    const file = result.find(
      (f) => f.path === join(windsurfDir, 'guidelines.md')
    )
    expect(file).toBeDefined()
    expect(file!.kind).toBe('windsurf-rule')
  })

  it('collects .github/copilot-instructions.md and tags it copilot-instructions', () => {
    const ghDir = join(TEST_DIR, '.github')
    mkdirSync(ghDir, { recursive: true })
    writeFileSync(join(ghDir, 'copilot-instructions.md'), 'copilot')

    const result = collectRuleSources(TEST_DIR)
    const file = result.find(
      (f) => f.path === join(ghDir, 'copilot-instructions.md')
    )
    expect(file).toBeDefined()
    expect(file!.kind).toBe('copilot-instructions')
  })

  it('collects CONVENTIONS.md and tags it aider-conventions', () => {
    writeFileSync(join(TEST_DIR, 'CONVENTIONS.md'), 'aider conventions')

    const result = collectRuleSources(TEST_DIR)
    const file = result.find(
      (f) => f.path === join(TEST_DIR, 'CONVENTIONS.md')
    )
    expect(file).toBeDefined()
    expect(file!.kind).toBe('aider-conventions')
  })

  it('excludes node_modules', () => {
    const nm = join(TEST_DIR, 'node_modules', 'pkg')
    mkdirSync(nm, { recursive: true })
    writeFileSync(join(nm, 'CLAUDE.md'), 'should not')
    writeFileSync(join(nm, 'AGENTS.md'), 'should not')

    const result = collectRuleSources(TEST_DIR)
    const found = result.find((f) => f.path.includes('node_modules'))
    expect(found).toBeUndefined()
  })
})
