import { DeterministicRule, RuleVerdict } from '../types'

const CATASTROPHIC_TARGETS = new Set<string>([
  '/',
  '$HOME',
  '${HOME}',
  '"$HOME"',
  "'$HOME'",
  '~',
  '~/',
  '/etc',
  '/usr',
  '/var',
  '/bin',
  '/sbin',
  '/boot',
  '/lib',
  '/lib64',
  '/opt',
  '/Users',
  '/home',
  '/root',
  '/private',
  '/System',
  '/Library',
  '/Applications',
])

function stripSudoPrefix(command: string): string {
  return command.replace(/^\s*sudo(\s+-[A-Za-z]+)*\s+/, '')
}

function isRecursiveForceRm(command: string): boolean {
  const trimmed = stripSudoPrefix(command).trim()
  if (!/^rm\b/.test(trimmed)) return false
  const padded = ' ' + trimmed + ' '
  if (/\s--recursive\b/.test(padded)) return true
  // Short flag form: any flag cluster containing r/R (case-insensitive)
  return /\s-[A-Za-z]*[rR][A-Za-z]*\s/.test(padded)
}

function extractTargets(command: string): string[] {
  const trimmed = stripSudoPrefix(command).trim()
  const tokens = trimmed.split(/\s+/)
  return tokens.slice(1).filter((t) => !t.startsWith('-'))
}

export const preventRmRfRoot: DeterministicRule = {
  id: 'prevent-rm-rf-root',
  check(toolName, toolInput): RuleVerdict {
    if (toolName !== 'Bash') return { kind: 'allow' }
    const command = toolInput.command
    if (typeof command !== 'string') return { kind: 'allow' }
    if (!isRecursiveForceRm(command)) return { kind: 'allow' }

    const targets = extractTargets(command)
    for (const target of targets) {
      if (CATASTROPHIC_TARGETS.has(target)) {
        return {
          kind: 'block',
          reason: `Refusing to run recursive rm on a catastrophic path: ${target}. If this is genuinely intended, run the command manually outside of the agent.`,
        }
      }
    }
    return { kind: 'allow' }
  },
}
