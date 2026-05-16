import { readdirSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { RuleSource, RuleSourceKind } from '../contracts/types/RuleSource'

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

interface DirectFileSpec {
  filename: string
  kind: RuleSourceKind
}

interface NestedFileSpec {
  parentDir: string
  fileMatcher: (filename: string) => boolean
  kind: RuleSourceKind
}

// Files looked up directly inside a candidate directory
const DIRECT_FILES: DirectFileSpec[] = [
  { filename: 'CLAUDE.md', kind: 'claude-md' },
  { filename: 'AGENTS.md', kind: 'agents-md' },
  { filename: '.cursorrules', kind: 'cursorrules' },
  { filename: 'CONVENTIONS.md', kind: 'aider-conventions' },
]

// Files looked up inside a known subdirectory of a candidate directory.
// e.g. `<dir>/.cursor/rules/*.mdc` ; the parentDir here is `.cursor/rules`
// or `.github` for copilot-instructions.md.
const NESTED_FILES: NestedFileSpec[] = [
  {
    parentDir: '.cursor/rules',
    fileMatcher: (name) => name.endsWith('.mdc'),
    kind: 'cursor-mdc',
  },
  {
    parentDir: '.clinerules',
    fileMatcher: (name) => name.endsWith('.md'),
    kind: 'clinerules',
  },
  {
    parentDir: '.windsurf/rules',
    fileMatcher: (name) => name.endsWith('.md'),
    kind: 'windsurf-rule',
  },
  {
    parentDir: '.github',
    fileMatcher: (name) => name === 'copilot-instructions.md',
    kind: 'copilot-instructions',
  },
]

export function collectRuleSources(cwd: string): RuleSource[] {
  const upward = collectUpward(cwd)
  const downward = collectDownward(cwd)

  const upwardPaths = new Set(upward.map((f) => f.path))
  return [...upward, ...downward.filter((f) => !upwardPaths.has(f.path))]
}

function collectUpward(cwd: string): RuleSource[] {
  const files: RuleSource[] = []
  let dir = cwd
  while (true) {
    collectDirectFiles(dir, files)
    collectNestedFiles(dir, files)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return files
}

function collectDownward(cwd: string): RuleSource[] {
  const files: RuleSource[] = []
  walkDir(cwd, 0, files)
  return files
}

function walkDir(dir: string, depth: number, files: RuleSource[]): void {
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

    const directSpec = DIRECT_FILES.find((s) => s.filename === entry)
    if (directSpec) {
      const content = readFileSafe(fullPath)
      if (content !== null) {
        files.push({ path: fullPath, content, kind: directSpec.kind })
      }
      continue
    }

    let isDir = false
    try {
      isDir = statSync(fullPath).isDirectory()
    } catch {
      continue
    }

    if (isDir) {
      const nestedSpec = NESTED_FILES.find((s) => s.parentDir === entry)
      if (nestedSpec) {
        collectFromNestedDir(fullPath, nestedSpec, files)
      }
      walkDir(fullPath, depth + 1, files)
    }
  }
}

function collectDirectFiles(dir: string, files: RuleSource[]): void {
  for (const spec of DIRECT_FILES) {
    const filePath = join(dir, spec.filename)
    const content = readFileSafe(filePath)
    if (content !== null) {
      files.push({ path: filePath, content, kind: spec.kind })
    }
  }
}

function collectNestedFiles(dir: string, files: RuleSource[]): void {
  for (const spec of NESTED_FILES) {
    const nestedDir = join(dir, spec.parentDir)
    collectFromNestedDir(nestedDir, spec, files)
  }
}

function collectFromNestedDir(
  nestedDir: string,
  spec: NestedFileSpec,
  files: RuleSource[]
): void {
  let entries: string[]
  try {
    entries = readdirSync(nestedDir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!spec.fileMatcher(entry)) continue
    const fullPath = join(nestedDir, entry)
    const content = readFileSafe(fullPath)
    if (content !== null) {
      files.push({ path: fullPath, content, kind: spec.kind })
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
