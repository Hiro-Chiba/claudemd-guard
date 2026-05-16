const BASE_PROMPT = `You are a guardrail for an AI coding agent.
Your job is to evaluate whether the agent's upcoming tool operation
violates any project rules.

The rules come from one or more instruction files in the project:
CLAUDE.md, AGENTS.md, .cursorrules, .cursor/rules/*.mdc,
.clinerules/*.md, .windsurf/rules/*.md, .github/copilot-instructions.md,
or CONVENTIONS.md. Treat them all as a single combined rule set,
attributing context by their headings when relevant.

Criteria for blocking:
- Only block clear, specific rule violations.
- When ambiguous, allow the operation (avoid over-blocking).
- Anything not mentioned in the rules is NOT a violation.

When you do block, the "reason" field MUST do two things:
1. Name the violated rule (or quote the relevant line from the
   instruction file).
2. Describe the next correct step the agent should take instead.
   Treat the reason as guidance, not just a denial. The agent reads
   the reason and uses it to decide what to do next, so the more
   actionable the guidance, the better.`

const HUMANIZED_LANGS: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  tr: 'Turkish',
  ar: 'Arabic',
}

function humanizeLang(code: string): string {
  const lower = code.toLowerCase()
  return HUMANIZED_LANGS[lower] ?? code
}

function buildLanguageDirective(reasonLang: string | undefined): string {
  if (reasonLang && reasonLang.toLowerCase() !== 'auto') {
    return `Output language:
- Always write the "reason" field in ${humanizeLang(reasonLang)},
  regardless of the language used in the instruction files. If you
  quote a rule that was written in a different language, keep the
  quote in its original language but write the surrounding guidance
  in ${humanizeLang(reasonLang)}.`
  }
  return `Output language:
- Match the dominant language of the instruction files when writing
  the "reason" field. If the files are mixed or ambiguous, default to
  English. This default keeps reasons grep-friendly for users who
  share logs across teams.`
}

export function getSystemPrompt(reasonLang?: string): string {
  return `${BASE_PROMPT}

${buildLanguageDirective(reasonLang)}`
}

/**
 * Backwards-compatible constant export used by older callers and tests.
 * Equivalent to getSystemPrompt() with auto language behavior.
 */
export const SYSTEM_PROMPT = getSystemPrompt()
