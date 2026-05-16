import { DeterministicRule, RuleVerdict } from '../types'

const TOOLS_THAT_WRITE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const TEMPLATE_SUFFIXES = ['.example', '.sample', '.template', '.dist']

function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

function isTemplate(filePath: string): boolean {
  return TEMPLATE_SUFFIXES.some((suffix) => filePath.endsWith(suffix))
}

function isBuiltInSecretPath(filePath: string): boolean {
  if (isTemplate(filePath)) return false

  const name = basename(filePath)

  if (name === '.env' || name.startsWith('.env.')) return true
  if (filePath.includes('/.ssh/')) return true
  if (/\/\.aws\/(credentials|config)$/.test(filePath)) return true
  if (/\.(pem|key)$/.test(name)) return true
  if (/^id_(rsa|ed25519|ecdsa|dsa)$/.test(name)) return true
  if (name === '.netrc') return true

  return false
}

export interface PreventSecretFileWriteOptions {
  extraSecretPathPrefixes?: string[]
}

export function preventSecretFileWriteWith(
  opts?: PreventSecretFileWriteOptions
): DeterministicRule {
  const extras = opts?.extraSecretPathPrefixes ?? []
  return {
    id: 'prevent-secret-file-write',
    check(toolName, toolInput): RuleVerdict {
      if (!TOOLS_THAT_WRITE.has(toolName)) return { kind: 'allow' }
      const filePath = toolInput.file_path
      if (typeof filePath !== 'string') return { kind: 'allow' }
      if (isTemplate(filePath)) return { kind: 'allow' }

      const builtIn = isBuiltInSecretPath(filePath)
      const extra = extras.some((prefix) => filePath.includes(prefix))
      if (!builtIn && !extra) return { kind: 'allow' }

      return {
        kind: 'block',
        reason: `Refusing to write to a likely secret/credential file: ${filePath}. If this is intentional, edit the file outside of the agent.`,
      }
    },
  }
}

export const preventSecretFileWrite: DeterministicRule =
  preventSecretFileWriteWith()
