import { DeterministicRule, RuleVerdict } from '../types'

const TEMPLATE_SUFFIXES = ['.example', '.sample', '.template', '.dist']

function basename(path: string): string {
  const cleaned = path.replace(/[\s'"]+$/, '')
  const idx = cleaned.lastIndexOf('/')
  return idx >= 0 ? cleaned.slice(idx + 1) : cleaned
}

function isTemplate(path: string): boolean {
  return TEMPLATE_SUFFIXES.some((s) => path.endsWith(s))
}

function isSecretTargetPath(rawPath: string): boolean {
  const cleaned = rawPath.replace(/^['"]|['"]$/g, '').trim()
  if (isTemplate(cleaned)) return false

  const name = basename(cleaned)

  if (name === '.env' || name.startsWith('.env.')) return true
  if (cleaned.includes('/.ssh/')) return true
  if (/\/\.aws\/(credentials|config)$/.test(cleaned)) return true
  if (/\.(pem|key)$/.test(name)) return true
  if (/^id_(rsa|ed25519|ecdsa|dsa)$/.test(name)) return true
  if (name === '.netrc') return true

  return false
}

/**
 * Extracts files that the command writes to via redirect (>, >>) or `tee`.
 * Conservative: matches the next non-flag token after the operator/word.
 */
function extractWriteTargets(command: string): string[] {
  const targets: string[] = []

  // Redirect operators: >, >>, &>, &>>, 1>, 2> etc.
  const redirectRe = /[12&]?>>?\s*([^\s;|&<>]+)/g
  for (const m of command.matchAll(redirectRe)) {
    if (m[1]) targets.push(m[1])
  }

  // tee [-a] FILE [FILE ...]
  const teeRe = /\btee\b(?:\s+-[A-Za-z]+)*\s+([^\s;|&<>]+(?:\s+[^\s;|&<>]+)*)/g
  for (const m of command.matchAll(teeRe)) {
    if (m[1]) {
      for (const f of m[1].split(/\s+/)) {
        if (f && !f.startsWith('-')) targets.push(f)
      }
    }
  }

  return targets
}

export const preventBashSecretWrite: DeterministicRule = {
  id: 'prevent-bash-secret-write',
  check(toolName, toolInput): RuleVerdict {
    if (toolName !== 'Bash') return { kind: 'allow' }
    const command = toolInput.command
    if (typeof command !== 'string') return { kind: 'allow' }

    const targets = extractWriteTargets(command)
    for (const target of targets) {
      if (isSecretTargetPath(target)) {
        return {
          kind: 'block',
          reason: `Refusing to write to a likely secret/credential file via shell redirect: ${target}. If this is intentional, run the command manually outside of the agent.`,
        }
      }
    }
    return { kind: 'allow' }
  },
}
