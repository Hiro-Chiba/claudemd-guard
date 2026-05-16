import { DeterministicRule, RuleVerdict } from '../types'

const DEFAULT_PROTECTED_BRANCHES = [
  'main',
  'master',
  'develop',
  'development',
  'production',
  'prod',
  'release',
  'stable',
]

function isGitPush(tokens: string[]): boolean {
  const gitIdx = tokens.indexOf('git')
  if (gitIdx === -1) return false
  return tokens[gitIdx + 1] === 'push'
}

function hasForceFlag(tokens: string[]): boolean {
  for (const token of tokens) {
    if (token === '--force-with-lease') continue
    if (token.startsWith('--force-with-lease=')) continue
    if (token === '--force' || token === '-f') return true
  }
  return false
}

function targetsProtectedBranch(
  tokens: string[],
  protectedSet: Set<string>
): boolean {
  for (const token of tokens) {
    if (token.startsWith('+')) {
      const branch = token.slice(1).split(':').pop() ?? ''
      if (protectedSet.has(branch)) return true
    }
    if (protectedSet.has(token)) return true
    if (token.includes(':')) {
      const dest = token.split(':').pop() ?? ''
      if (protectedSet.has(dest)) return true
    }
  }
  return false
}

function hasPlusPrefixedProtected(
  tokens: string[],
  protectedSet: Set<string>
): boolean {
  for (const token of tokens) {
    if (!token.startsWith('+')) continue
    const branch = token.slice(1).split(':').pop() ?? ''
    if (protectedSet.has(branch)) return true
  }
  return false
}

export interface PreventForcePushMainOptions {
  protectedBranches?: string[]
}

export function preventForcePushMainWith(
  opts?: PreventForcePushMainOptions
): DeterministicRule {
  const protectedSet = new Set(
    opts?.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES
  )
  return {
    id: 'prevent-force-push-main',
    check(toolName, toolInput): RuleVerdict {
      if (toolName !== 'Bash') return { kind: 'allow' }
      const command = toolInput.command
      if (typeof command !== 'string') return { kind: 'allow' }

      const tokens = command.trim().split(/\s+/)
      if (!isGitPush(tokens)) return { kind: 'allow' }

      const force = hasForceFlag(tokens)
      const plusForce = hasPlusPrefixedProtected(tokens, protectedSet)

      if (!force && !plusForce) return { kind: 'allow' }
      if (!targetsProtectedBranch(tokens, protectedSet)) return { kind: 'allow' }

      return {
        kind: 'block',
        reason:
          'Force push to a protected branch is blocked. Use --force-with-lease if you really need to overwrite history, or push to a feature branch instead.',
      }
    },
  }
}

export const preventForcePushMain: DeterministicRule = preventForcePushMainWith()
