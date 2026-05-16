export type RuleVerdict =
  | { kind: 'allow' }
  | { kind: 'block'; reason: string }

export interface DeterministicRule {
  id: string
  check(toolName: string, toolInput: Record<string, unknown>): RuleVerdict
}
