export type RuleSourceKind =
  | 'claude-md'
  | 'agents-md'
  | 'cursorrules'
  | 'cursor-mdc'
  | 'clinerules'
  | 'windsurf-rule'
  | 'copilot-instructions'
  | 'aider-conventions'

export interface RuleSource {
  path: string
  content: string
  kind: RuleSourceKind
}
