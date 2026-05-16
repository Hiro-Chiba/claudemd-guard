import { DeterministicRule } from './types'
import { preventRmRfRoot } from './rules/preventRmRfRoot'
import { preventSecretFileWrite } from './rules/preventSecretFileWrite'
import { preventBashSecretWrite } from './rules/preventBashSecretWrite'
import { preventForcePushMain } from './rules/preventForcePushMain'
import { preventSystemPathWrite } from './rules/preventSystemPathWrite'

export const defaultDeterministicRules: DeterministicRule[] = [
  preventRmRfRoot,
  preventSecretFileWrite,
  preventBashSecretWrite,
  preventForcePushMain,
  preventSystemPathWrite,
]
