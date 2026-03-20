import { readdirSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { ClaudeMdFile } from '../contracts/types/ClaudeMdFile'

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  '.venv',
  'vendor',
  '__pycache__',
  'dist',
  'build',
])

const MAX_DEPTH = 3

export function collectClaudeMd(cwd: string): ClaudeMdFile[] {
  const upward = collectUpward(cwd)
  const downward = collectDownward(cwd)

  // Deduplicate: upward already includes cwd/CLAUDE.md
  const upwardPaths = new Set(upward.map((f) => f.path))
  const combined = [
    ...upward,
    ...downward.filter((f) => !upwardPaths.has(f.path)),
  ]

  return combined
}

function collectUpward(cwd: string): ClaudeMdFile[] {
  const files: ClaudeMdFile[] = []
  let dir = cwd

  while (true) {
    const claudeMdPath = join(dir, 'CLAUDE.md')
    const content = readFileSafe(claudeMdPath)
    if (content !== null) {
      files.push({ path: claudeMdPath, content })
    }

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return files
}

function collectDownward(cwd: string): ClaudeMdFile[] {
  const files: ClaudeMdFile[] = []
  walkDir(cwd, 0, files)
  return files
}

function walkDir(dir: string, depth: number, files: ClaudeMdFile[]): void {
  if (depth > MAX_DEPTH) return

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue

    const fullPath = join(dir, entry)

    if (entry === 'CLAUDE.md') {
      const content = readFileSafe(fullPath)
      if (content !== null) {
        files.push({ path: fullPath, content })
      }
      continue
    }

    try {
      if (statSync(fullPath).isDirectory()) {
        walkDir(fullPath, depth + 1, files)
      }
    } catch {
      // Skip inaccessible entries
    }
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}
