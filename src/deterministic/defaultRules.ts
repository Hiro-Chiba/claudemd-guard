import { DeterministicRule } from './types'
import { preventRmRfRoot } from './rules/preventRmRfRoot'
import { preventSecretFileWriteWith } from './rules/preventSecretFileWrite'
import { preventBashSecretWrite } from './rules/preventBashSecretWrite'
import { preventForcePushMainWith } from './rules/preventForcePushMain'
import { preventSystemPathWrite } from './rules/preventSystemPathWrite'
import { AgentGateConfig } from '../config/AgentGateConfig'

/**
 * Builds the deterministic rule list, applying config overrides where the
 * rule supports them, appending any user-supplied customRules, and
 * filtering out any rule ids listed in config.disabledRules.
 * Built-ins come first; custom rules run after them in declaration order.
 */
export function buildDefaultDeterministicRules(
  config?: AgentGateConfig
): DeterministicRule[] {
  const builtIn: DeterministicRule[] = [
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
  const custom = config?.customRules ?? []
  const all = [...builtIn, ...custom]
  const disabled = new Set(config?.disabledRules ?? [])
  return all.filter((r) => !disabled.has(r.id))
}

export const defaultDeterministicRules: DeterministicRule[] =
  buildDefaultDeterministicRules()
