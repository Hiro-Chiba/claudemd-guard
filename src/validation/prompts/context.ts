import { RuleSource, RuleSourceKind } from '../../contracts/types/RuleSource'
import { RESPONSE_FORMAT } from './response'

const KIND_LABEL: Record<RuleSourceKind, string> = {
  'claude-md': 'CLAUDE.md',
  'agents-md': 'AGENTS.md',
  cursorrules: '.cursorrules (Cursor legacy)',
  'cursor-mdc': '.cursor/rules/*.mdc (Cursor)',
  clinerules: '.clinerules/*.md (Cline)',
  'windsurf-rule': '.windsurf/rules/*.md (Windsurf)',
  'copilot-instructions': '.github/copilot-instructions.md (Copilot)',
  'aider-conventions': 'CONVENTIONS.md (Aider)',
}

export function buildPrompt(
  rules: RuleSource[],
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const rulesSection = rules
    .map((r) => `## ${KIND_LABEL[r.kind]} (${r.path})\n\n${r.content}`)
    .join('\n\n')

  const toolSection = JSON.stringify(
    { tool_name: toolName, tool_input: toolInput },
    null,
    2
  )

  return `# プロジェクトルール (集約された指示ファイル)

${rulesSection}

# 実行されるツール操作

${toolSection}

${RESPONSE_FORMAT}`
}
