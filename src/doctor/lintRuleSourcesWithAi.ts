import { RuleSource, RuleSourceKind } from '../contracts/types/RuleSource'
import { IModelClient } from '../contracts/types/ModelClient'
import { Finding, FindingCode, Severity } from './findings'

const PROMPT_HEADER = `You are auditing AI agent instruction files for issues that
make rules hard for an AI to enforce reliably. Look at the sources below
and report any of the following:

- "contradiction": two or more rules across one or more files that
  conflict. Cite both/all sides in the excerpt.
- "ambiguity": a rule that uses vague language (e.g. "where possible",
  "as needed", "appropriately") with no concrete threshold or condition.
- "missing-imperative": a rule expressed as a wish or description rather
  than an imperative the AI can act on.

Respond as a JSON array of objects with this shape:
[
  {
    "code": "contradiction" | "ambiguity" | "missing-imperative",
    "ruleSourcePath": "<one of the paths shown>",
    "line": <1-indexed line number in that file, or null>,
    "message": "<concise explanation>",
    "excerpt": "<short literal text from the file>"
  }
]

If there are no issues, respond with []. Output ONLY the JSON array. No
markdown, no prose, no commentary.`

const ALLOWED_CODES: FindingCode[] = [
  'ambiguity',
  'contradiction',
  'missing-imperative',
]

const CODE_SEVERITY: Record<FindingCode, Severity> = {
  'empty-file': 'warning',
  'ambiguous-modifier': 'info',
  'no-concrete-rules': 'warning',
  ambiguity: 'info',
  contradiction: 'warning',
  'missing-imperative': 'info',
}

interface RawAiFinding {
  code?: string
  ruleSourcePath?: string
  line?: number | null
  message?: string
  excerpt?: string
}

function buildPrompt(sources: RuleSource[]): string {
  const blocks = sources.map(
    (s) => `--- path: ${s.path} (kind: ${s.kind}) ---\n${s.content}`
  )
  return `${PROMPT_HEADER}\n\n${blocks.join('\n\n')}`
}

function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) return trimmed
  // Code fence variants
  const fenced = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (fenced) return fenced[1].trim()
  // Plain extraction: first [ to last ]
  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)
  return null
}

function pathToKind(
  path: string,
  sources: RuleSource[]
): RuleSourceKind | null {
  const match = sources.find((s) => s.path === path)
  return match ? match.kind : null
}

export async function lintRuleSourcesWithAi(
  sources: RuleSource[],
  client: IModelClient
): Promise<Finding[]> {
  if (sources.length === 0) return []

  let response: string
  try {
    response = await client.ask(buildPrompt(sources))
  } catch {
    return []
  }

  const jsonStr = extractJsonArray(response)
  if (!jsonStr) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const findings: Finding[] = []
  for (const raw of parsed as RawAiFinding[]) {
    if (!raw || typeof raw !== 'object') continue
    const code = raw.code as FindingCode | undefined
    if (!code || !ALLOWED_CODES.includes(code)) continue
    if (typeof raw.ruleSourcePath !== 'string') continue
    const kind = pathToKind(raw.ruleSourcePath, sources)
    if (!kind) continue

    findings.push({
      ruleSourcePath: raw.ruleSourcePath,
      ruleSourceKind: kind,
      severity: CODE_SEVERITY[code],
      code,
      message: typeof raw.message === 'string' ? raw.message : '',
      line:
        typeof raw.line === 'number' && Number.isFinite(raw.line)
          ? raw.line
          : undefined,
      excerpt: typeof raw.excerpt === 'string' ? raw.excerpt : undefined,
    })
  }
  return findings
}
