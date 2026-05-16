import { RuleSourceKind } from '../contracts/types/RuleSource'

export type Severity = 'info' | 'warning' | 'error'

export type FindingCode =
  | 'empty-file'
  | 'ambiguous-modifier'
  | 'no-concrete-rules'
  | 'ambiguity'
  | 'contradiction'
  | 'missing-imperative'

export interface Finding {
  ruleSourcePath: string
  ruleSourceKind: RuleSourceKind
  severity: Severity
  code: FindingCode
  message: string
  /** 1-indexed line number when the finding is line-specific. */
  line?: number
  /** Small excerpt of the offending text for human review. */
  excerpt?: string
}
