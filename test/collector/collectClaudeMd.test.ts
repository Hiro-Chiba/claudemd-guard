import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { collectClaudeMd } from '../../src/collector/collectClaudeMd'

const TEST_DIR = join(__dirname, '..', '..', 'tmp', 'test-collector')

describe('collectClaudeMd', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns empty array when no CLAUDE.md exists', () => {
    const subdir = join(TEST_DIR, 'empty-project')
    mkdirSync(subdir, { recursive: true })

    const result = collectClaudeMd(subdir)

    // May find CLAUDE.md files above TEST_DIR (in the real repo)
    // but none in the subdir itself
    const localFiles = result.filter((f) => f.path.startsWith(subdir))
    expect(localFiles).toHaveLength(0)
  })

  it('collects CLAUDE.md from current directory', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Rules\nDo something')

    const result = collectClaudeMd(TEST_DIR)

    const localFile = result.find((f) => f.path === join(TEST_DIR, 'CLAUDE.md'))
    expect(localFile).toBeDefined()
    expect(localFile!.content).toBe('# Rules\nDo something')
  })

  it('collects CLAUDE.md from subdirectories', () => {
    const subdir = join(TEST_DIR, 'subproject')
    mkdirSync(subdir, { recursive: true })
    writeFileSync(join(subdir, 'CLAUDE.md'), 'sub rules')

    const result = collectClaudeMd(TEST_DIR)

    const subFile = result.find((f) => f.path === join(subdir, 'CLAUDE.md'))
    expect(subFile).toBeDefined()
    expect(subFile!.content).toBe('sub rules')
  })

  it('excludes node_modules directory', () => {
    const nodeModules = join(TEST_DIR, 'node_modules', 'some-pkg')
    mkdirSync(nodeModules, { recursive: true })
    writeFileSync(join(nodeModules, 'CLAUDE.md'), 'should not be found')

    const result = collectClaudeMd(TEST_DIR)

    const excluded = result.find((f) => f.path.includes('node_modules'))
    expect(excluded).toBeUndefined()
  })

  it('excludes .git directory', () => {
    const gitDir = join(TEST_DIR, '.git', 'hooks')
    mkdirSync(gitDir, { recursive: true })
    writeFileSync(join(gitDir, 'CLAUDE.md'), 'should not be found')

    const result = collectClaudeMd(TEST_DIR)

    const excluded = result.find((f) => f.path.includes('.git'))
    expect(excluded).toBeUndefined()
  })

  it('does not duplicate files found in both upward and downward walks', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'root rules')

    const result = collectClaudeMd(TEST_DIR)

    const rootFiles = result.filter(
      (f) => f.path === join(TEST_DIR, 'CLAUDE.md')
    )
    expect(rootFiles).toHaveLength(1)
  })

  it('respects max depth of 3', () => {
    // Create a deeply nested CLAUDE.md (depth 4 from TEST_DIR)
    const deepDir = join(TEST_DIR, 'a', 'b', 'c', 'd')
    mkdirSync(deepDir, { recursive: true })
    writeFileSync(join(deepDir, 'CLAUDE.md'), 'too deep')

    // Create one at depth 3 (should be found)
    const okDir = join(TEST_DIR, 'a', 'b', 'c')
    writeFileSync(join(okDir, 'CLAUDE.md'), 'ok depth')

    const result = collectClaudeMd(TEST_DIR)

    const deepFile = result.find((f) =>
      f.path.includes(join('a', 'b', 'c', 'd', 'CLAUDE.md'))
    )
    expect(deepFile).toBeUndefined()

    const okFile = result.find((f) =>
      f.path.includes(join('a', 'b', 'c', 'CLAUDE.md'))
    )
    expect(okFile).toBeDefined()
  })
})
