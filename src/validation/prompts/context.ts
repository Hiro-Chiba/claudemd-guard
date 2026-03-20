import { ClaudeMdFile } from '../../contracts/types/ClaudeMdFile'
import { RESPONSE_FORMAT } from './response'

export function buildPrompt(
  claudeMdFiles: ClaudeMdFile[],
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const rulesSection = claudeMdFiles
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n')

  const toolSection = JSON.stringify({ tool_name: toolName, tool_input: toolInput }, null, 2)

  return `# CLAUDE.md ルール

${rulesSection}

# 実行されるツール操作

${toolSection}

${RESPONSE_FORMAT}`
}
