import { existsSync } from 'fs'
import { dirname, join } from 'path'

const PROJECT_ROOT_MARKERS = [
  '.git',
  'package.json',
  '.agent-gate.config.ts',
  '.agent-gate.config.mts',
  '.agent-gate.config.mjs',
  '.agent-gate.config.cjs',
  '.agent-gate.config.js',
  '.agent-gate.json',
]

/**
 * Walk upward from `cwd` and return the first directory that contains a
 * project-root marker, or `null` if nothing matches before the filesystem
 * root. Markers checked at each level: `.git`, `package.json`, and any
 * `.agent-gate.config.*` / `.agent-gate.json`. The closest match wins.
 *
 * Used as a stable identifier so caches, cooldowns, and warning throttles
 * share state across subdirectories of the same project.
 */
export function findProjectRoot(cwd: string): string | null {
  let dir = cwd
  while (true) {
    for (const marker of PROJECT_ROOT_MARKERS) {
      if (existsSync(join(dir, marker))) return dir
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}
