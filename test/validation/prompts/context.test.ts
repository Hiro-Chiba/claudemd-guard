import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../../../src/validation/prompts/context'
import { RuleSource } from '../../../src/contracts/types/RuleSource'

describe('buildPrompt', () => {
  it('includes each rule source attributed by its kind and path', () => {
    const rules: RuleSource[] = [
      {
        path: '/p/CLAUDE.md',
        content: 'claude content',
        kind: 'claude-md',
      },
      {
        path: '/p/AGENTS.md',
        content: 'agents content',
        kind: 'agents-md',
      },
    ]

    const prompt = buildPrompt(rules, 'Edit', {
      file_path: '/p/src/a.ts',
    })

    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('/p/CLAUDE.md')
    expect(prompt).toContain('claude content')
    expect(prompt).toContain('AGENTS.md')
    expect(prompt).toContain('/p/AGENTS.md')
    expect(prompt).toContain('agents content')
  })

  it('labels each source by its kind regardless of path tokens', () => {
    const rules: RuleSource[] = [
      { path: '/x/y/z.md', content: 'agents body', kind: 'agents-md' },
      { path: '/a/b/c.txt', content: 'cursor mdc body', kind: 'cursor-mdc' },
      { path: '/d/e/f.md', content: 'cline body', kind: 'clinerules' },
    ]

    const prompt = buildPrompt(rules, 'Bash', { command: 'ls' })

    expect(prompt).toContain('AGENTS.md')
    expect(prompt).toMatch(/cursor.*\.mdc|cursor.*rules|cursor-mdc/i)
    expect(prompt).toMatch(/cline|clinerules/i)
  })

  it('includes the tool name and tool_input as JSON', () => {
    const rules: RuleSource[] = []
    const prompt = buildPrompt(rules, 'Bash', { command: 'echo hi' })
    expect(prompt).toContain('"tool_name": "Bash"')
    expect(prompt).toContain('"command": "echo hi"')
  })
})
