import { DeterministicRule, RuleVerdict } from '../types'

const TOOLS_THAT_WRITE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const SYSTEM_PREFIXES = [
  '/etc/',
  '/usr/',
  '/var/',
  '/bin/',
  '/sbin/',
  '/boot/',
  '/lib/',
  '/lib64/',
  '/opt/',
  '/System/',
  '/Library/',
  '/private/etc/',
  '/private/var/',
]

function startsWithSystemPath(filePath: string): boolean {
  return SYSTEM_PREFIXES.some((prefix) => filePath.startsWith(prefix))
}

export const preventSystemPathWrite: DeterministicRule = {
  id: 'prevent-system-path-write',
  check(toolName, toolInput): RuleVerdict {
    if (!TOOLS_THAT_WRITE.has(toolName)) return { kind: 'allow' }
    const filePath = toolInput.file_path
    if (typeof filePath !== 'string') return { kind: 'allow' }
    if (!startsWithSystemPath(filePath)) return { kind: 'allow' }

    return {
      kind: 'block',
      reason: `Refusing to modify a system path: ${filePath}. Operations against /etc, /usr, /System, /Library and similar locations belong outside of the agent.`,
    }
  },
}
