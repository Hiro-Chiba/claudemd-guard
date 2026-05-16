import { DeterministicRule } from './types'
import { preventRmRfRoot } from './rules/preventRmRfRoot'
import { preventSecretFileWriteWith } from './rules/preventSecretFileWrite'
import { preventBashSecretWrite } from './rules/preventBashSecretWrite'
import { preventForcePushMainWith } from './rules/preventForcePushMain'
import { preventSystemPathWrite } from './rules/preventSystemPathWrite'
import { AgentGateConfig } from '../config/AgentGateConfig'

/**
 * Builds the deterministic rule list, applying config overrides where the
 * rule supports them and filtering out any rule ids listed in
 * config.disabledRules. Always returns the rules in stable order.
 */
export function buildDefaultDeterministicRules(
  config?: AgentGateConfig
): DeterministicRule[] {
  const rules: DeterministicRule[] = [
    preventRmRfRoot,
    preventSecretFileWriteWith({
      extraSecretPathPrefixes: config?.extraSecretPathPrefixes,
    }),
    preventBashSecretWrite,
    preventForcePushMainWith({
      protectedBranches: config?.protectedBranches,
    }),
    preventSystemPathWrite,
  ]

  const disabled = new Set(config?.disabledRules ?? [])
  return rules.filter((r) => !disabled.has(r.id))
}

/**
 * Convenience export: the rule list with no config overrides. Kept for
 * existing callers and tests that construct rules directly.
 */
export const defaultDeterministicRules: DeterministicRule[] =
  buildDefaultDeterministicRules()
