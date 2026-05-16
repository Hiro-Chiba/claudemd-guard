import { describe, it, expect, vi } from 'vitest'
import { lintRuleSourcesWithAi } from '../../src/doctor/lintRuleSourcesWithAi'
import { RuleSource } from '../../src/contracts/types/RuleSource'
import { IModelClient } from '../../src/contracts/types/ModelClient'

function aiClient(response: string): IModelClient {
  return { ask: vi.fn(async () => response) }
}

const sources: RuleSource[] = [
  {
    path: '/p/CLAUDE.md',
    content: '- Always use TypeScript.\n- Write all scripts in Python.',
    kind: 'claude-md',
  },
]

describe('lintRuleSourcesWithAi', () => {
  it('returns an empty array when AI reports no issues', async () => {
    const client = aiClient('[]')
    const findings = await lintRuleSourcesWithAi(sources, client)
    expect(findings).toEqual([])
  })

  it('converts AI JSON output into Finding objects', async () => {
    const ai = JSON.stringify([
      {
        code: 'contradiction',
        ruleSourcePath: '/p/CLAUDE.md',
        line: 2,
        message: '"Always use TypeScript" conflicts with "Write all scripts in Python".',
        excerpt: 'Write all scripts in Python.',
      },
    ])
    const findings = await lintRuleSourcesWithAi(sources, aiClient(ai))
    expect(findings).toHaveLength(1)
    expect(findings[0].code).toBe('contradiction')
    expect(findings[0].ruleSourcePath).toBe('/p/CLAUDE.md')
    expect(findings[0].line).toBe(2)
    expect(findings[0].excerpt).toContain('Python')
    expect(findings[0].ruleSourceKind).toBe('claude-md')
    expect(['info', 'warning', 'error']).toContain(findings[0].severity)
  })

  it('tolerates AI output wrapped in markdown code fences', async () => {
    const ai = '```json\n[{"code":"ambiguity","ruleSourcePath":"/p/CLAUDE.md","line":1,"message":"vague","excerpt":"x"}]\n```'
    const findings = await lintRuleSourcesWithAi(sources, aiClient(ai))
    expect(findings).toHaveLength(1)
    expect(findings[0].code).toBe('ambiguity')
  })

  it('returns empty array when AI returns invalid JSON (fail safe)', async () => {
    const findings = await lintRuleSourcesWithAi(sources, aiClient('not json'))
    expect(findings).toEqual([])
  })

  it('returns empty array when the AI client throws', async () => {
    const client: IModelClient = {
      ask: async () => {
        throw new Error('boom')
      },
    }
    const findings = await lintRuleSourcesWithAi(sources, client)
    expect(findings).toEqual([])
  })

  it('skips findings with an unknown code', async () => {
    const ai = JSON.stringify([
      { code: 'banana', ruleSourcePath: '/p/CLAUDE.md', message: 'x' },
      {
        code: 'ambiguity',
        ruleSourcePath: '/p/CLAUDE.md',
        message: 'vague',
        excerpt: 'x',
      },
    ])
    const findings = await lintRuleSourcesWithAi(sources, aiClient(ai))
    expect(findings).toHaveLength(1)
    expect(findings[0].code).toBe('ambiguity')
  })

  it('sends the AI a prompt that includes every source content', async () => {
    const ask = vi.fn(async () => '[]')
    const client: IModelClient = { ask }
    const many: RuleSource[] = [
      { path: '/a.md', content: 'rule a', kind: 'claude-md' },
      { path: '/b.md', content: 'rule b', kind: 'agents-md' },
    ]
    await lintRuleSourcesWithAi(many, client)
    const prompt = ask.mock.calls[0][0] as string
    expect(prompt).toContain('rule a')
    expect(prompt).toContain('rule b')
    expect(prompt).toContain('/a.md')
    expect(prompt).toContain('/b.md')
  })
})
