import { DeterministicRule, RuleVerdict } from './types'

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

export interface ForbidCommandPatternOptions {
  id: string
  match: RegExp
  reason: string
}

export function forbidCommandPattern(
  opts: ForbidCommandPatternOptions
): DeterministicRule {
  return {
    id: opts.id,
    check(toolName, toolInput): RuleVerdict {
      if (toolName !== 'Bash') return { kind: 'allow' }
      const command = toolInput.command
      if (typeof command !== 'string') return { kind: 'allow' }
      if (!opts.match.test(command)) return { kind: 'allow' }
      return { kind: 'block', reason: opts.reason }
    },
  }
}

export interface ForbidContentPatternOptions {
  id: string
  match: RegExp
  reason: string
}

export function forbidContentPattern(
  opts: ForbidContentPatternOptions
): DeterministicRule {
  return {
    id: opts.id,
    check(toolName, toolInput): RuleVerdict {
      if (!WRITE_TOOLS.has(toolName)) return { kind: 'allow' }
      const candidates: unknown[] = [
        toolInput.content,
        toolInput.new_string,
        toolInput.new_content,
      ]
      for (const c of candidates) {
        if (typeof c === 'string' && opts.match.test(c)) {
          return { kind: 'block', reason: opts.reason }
        }
      }
      return { kind: 'allow' }
    },
  }
}

export interface ForbidFilePathPatternOptions {
  id: string
  match: RegExp
  reason: string
}

export function forbidFilePathPattern(
  opts: ForbidFilePathPatternOptions
): DeterministicRule {
  return {
    id: opts.id,
    check(toolName, toolInput): RuleVerdict {
      if (!WRITE_TOOLS.has(toolName)) return { kind: 'allow' }
      const filePath = toolInput.file_path
      if (typeof filePath !== 'string') return { kind: 'allow' }
      if (!opts.match.test(filePath)) return { kind: 'allow' }
      return { kind: 'block', reason: opts.reason }
    },
  }
}
