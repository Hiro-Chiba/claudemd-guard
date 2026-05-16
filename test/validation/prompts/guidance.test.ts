import { describe, it, expect } from 'vitest'
import {
  SYSTEM_PROMPT,
  getSystemPrompt,
} from '../../../src/validation/prompts/system-prompt'
import { RESPONSE_FORMAT } from '../../../src/validation/prompts/response'

describe('SYSTEM_PROMPT', () => {
  it('instructs the model to return guidance in the reason field, not just denial', () => {
    expect(SYSTEM_PROMPT).toMatch(/next.*step|guidance|how to|what to do/i)
  })

  it('mentions the broader set of rule sources, not only CLAUDE.md', () => {
    expect(SYSTEM_PROMPT).toMatch(/AGENTS\.md|rule source|instruction file/i)
  })
})

describe('getSystemPrompt language directive', () => {
  it('defaults to auto: match instruction files, fall back to English', () => {
    const p = getSystemPrompt()
    expect(p).toMatch(/match.*language|dominant.*language/i)
    expect(p).toMatch(/English/i)
  })

  it('honors "auto" explicitly the same as undefined', () => {
    expect(getSystemPrompt('auto')).toBe(getSystemPrompt())
  })

  it('forces English when reasonLang is "en"', () => {
    const p = getSystemPrompt('en')
    expect(p).toMatch(/Always write.*in English/i)
    expect(p).not.toMatch(/match.*dominant.*language/i)
  })

  it('forces Japanese when reasonLang is "ja"', () => {
    const p = getSystemPrompt('ja')
    expect(p).toMatch(/Always write.*in Japanese/i)
  })

  it('falls back to the raw code if unknown', () => {
    const p = getSystemPrompt('xx')
    expect(p).toMatch(/Always write.*in xx/i)
  })
})

describe('RESPONSE_FORMAT', () => {
  it('shows a block example whose reason contains an actionable next step', () => {
    // The example should encourage probity-style guidance in the reason
    expect(RESPONSE_FORMAT).toMatch(/next|do.*instead|try|run/i)
  })
})
