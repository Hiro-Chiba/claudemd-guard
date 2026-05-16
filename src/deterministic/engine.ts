import { DeterministicRule } from './types'
import { SessionContext } from '../contracts/types/SessionContext'

export type EngineResult =
  | { kind: 'allow' }
  | { kind: 'block'; reason: string; ruleId: string }

export type OnErrorPolicy = 'allow' | 'block'

export interface RunDeterministicRulesOptions {
  /**
   * What to do when a rule's check function throws.
   * - "allow" (default): swallow the exception and continue with the
   *   next rule. Compatible with prior versions.
   * - "block": turn the exception into a block verdict and stop the
   *   engine. Suitable for enterprise / production use where the
   *   safest response to a misbehaving rule is to halt.
   */
  onError?: OnErrorPolicy
}

export function runDeterministicRules(
  toolName: string,
  toolInput: Record<string, unknown>,
  rules: DeterministicRule[],
  ctx?: SessionContext,
  options?: RunDeterministicRulesOptions
): EngineResult {
  const onError: OnErrorPolicy = options?.onError ?? 'allow'

  for (const rule of rules) {
    let verdict: ReturnType<DeterministicRule['check']>
    try {
      verdict = rule.check(toolName, toolInput, ctx)
    } catch (e) {
      if (onError === 'block') {
        const reason = e instanceof Error ? e.message : String(e)
        return {
          kind: 'block',
          reason: `Rule "${rule.id}" failed: ${reason}. Failing closed.`,
          ruleId: rule.id,
        }
      }
      continue
    }
    if (verdict.kind === 'block') {
      return { kind: 'block', reason: verdict.reason, ruleId: rule.id }
    }
  }
  return { kind: 'allow' }
}
