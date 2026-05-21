import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { findProjectRoot } from '../../src/config/findProjectRoot'

const ROOT = join(__dirname, '..', '..', 'tmp', 'test-find-project-root')

function freshDir(name: string): string {
  const dir = join(ROOT, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('findProjectRoot', () => {
  beforeEach(() => {
    mkdirSync(ROOT, { recursive: true })
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('returns the dir itself when a marker is present at it', () => {
    const dir = freshDir('here')
    mkdirSync(join(dir, '.git'))
    expect(findProjectRoot(dir)).toBe(dir)
  })

  it('walks up to find a marker in a parent directory', () => {
    const dir = freshDir('walkup')
    mkdirSync(join(dir, '.git'))
    const sub = join(dir, 'a', 'b', 'c')
    mkdirSync(sub, { recursive: true })
    expect(findProjectRoot(sub)).toBe(dir)
  })

  it('finds package.json as a marker', () => {
    const dir = freshDir('pkg')
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(findProjectRoot(dir)).toBe(dir)
  })

  it('finds .agent-gate.config.ts as a marker', () => {
    const dir = freshDir('agts')
    writeFileSync(
      join(dir, '.agent-gate.config.ts'),
      'export default {}'
    )
    expect(findProjectRoot(dir)).toBe(dir)
  })

  it('finds .agent-gate.json as a marker', () => {
    const dir = freshDir('agjson')
    writeFileSync(join(dir, '.agent-gate.json'), '{}')
    expect(findProjectRoot(dir)).toBe(dir)
  })

  it('prefers the deepest (closest) marker over a higher-up one', () => {
    const outer = freshDir('nested')
    mkdirSync(join(outer, '.git'))
    const inner = join(outer, 'inner')
    mkdirSync(inner)
    writeFileSync(join(inner, 'package.json'), '{}')
    expect(findProjectRoot(inner)).toBe(inner)
  })

  it('returns null when no marker exists anywhere up the tree', () => {
    // Use the OS tmpdir so the walk does not pick up ambient markers in
    // the developer's hobby tree.
    const isolated = mkdtempSync(join(tmpdir(), 'find-project-root-null-'))
    try {
      expect(findProjectRoot(isolated)).toBeNull()
    } finally {
      rmSync(isolated, { recursive: true, force: true })
    }
  })
})
