import { DeterministicRule } from './types'
import { SessionContext } from '../contracts/types/SessionContext'

export type EngineResult =
  | { kind: 'allow' }
  | { kind: 'block'; reason: string; ruleId: string }

export function runDeterministicRules(
  toolName: string,
  toolInput: Record<string, unknown>,
  rules: DeterministicRule[],
  ctx?: SessionContext
): EngineResult {
  for (const rule of rules) {
    const verdict = rule.check(toolName, toolInput, ctx)
    if (verdict.kind === 'block') {
      return { kind: 'block', reason: verdict.reason, ruleId: rule.id }
    }
  }
  return { kind: 'allow' }
}
