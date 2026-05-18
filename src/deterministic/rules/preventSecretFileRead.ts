import { DeterministicRule, RuleVerdict } from '../types'

const READ_TOOLS = new Set(['read_file', 'read_many_files', 'Read'])

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

export const preventSecretFileRead: DeterministicRule = {
  id: 'prevent-secret-file-read',
  check(toolName, toolInput): RuleVerdict {
    if (!READ_TOOLS.has(toolName)) return { kind: 'allow' }

    const paths: string[] = []
    if (typeof toolInput.file_path === 'string') {
      paths.push(toolInput.file_path)
    }
    if (Array.isArray(toolInput.file_paths)) {
      for (const p of toolInput.file_paths) {
        if (typeof p === 'string') paths.push(p)
      }
    }
    // Claude Code's 'Read' tool often uses 'path'
    if (typeof toolInput.path === 'string') {
      paths.push(toolInput.path)
    }

    for (const filePath of paths) {
      if (isBuiltInSecretPath(filePath)) {
        return {
          kind: 'block',
          reason: `Refusing to read a likely secret/credential file: ${filePath}. Access to .env, .ssh, and other sensitive files is restricted for safety.`,
        }
      }
    }

    return { kind: 'allow' }
  },
}
