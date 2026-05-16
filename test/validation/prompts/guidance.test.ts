import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from '../../../src/validation/prompts/system-prompt'
import { RESPONSE_FORMAT } from '../../../src/validation/prompts/response'

describe('SYSTEM_PROMPT', () => {
  it('instructs the model to return guidance in the reason field, not just denial', () => {
    expect(SYSTEM_PROMPT).toMatch(/next.*step|guidance|how to|what to do/i)
  })

  it('mentions the broader set of rule sources, not only CLAUDE.md', () => {
    // After Phase 1 the validator may receive AGENTS.md, .cursorrules etc.
    expect(SYSTEM_PROMPT).toMatch(/AGENTS\.md|rule source|instruction file/i)
  })
})

describe('RESPONSE_FORMAT', () => {
  it('shows a block example whose reason contains an actionable next step', () => {
    // The example should encourage probity-style guidance in the reason
    expect(RESPONSE_FORMAT).toMatch(/next|do.*instead|try|run/i)
  })
})
