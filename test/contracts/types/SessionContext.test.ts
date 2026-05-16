import { describe, it, expect } from 'vitest'
import { runDeterministicRules } from '../../../src/deterministic/engine'
import { DeterministicRule } from '../../../src/deterministic/types'
import { SessionContext, SessionEvent } from '../../../src/contracts/types/SessionContext'

describe('SessionContext propagation through the engine', () => {
  it('passes the SessionContext as the third argument to rule.check', () => {
    const captured: SessionContext[] = []
    const rule: DeterministicRule = {
      id: 'capture-ctx',
      check: (_toolName, _toolInput, ctx) => {
        if (ctx) captured.push(ctx)
        return { kind: 'allow' }
      },
    }

    const ctx: SessionContext = {
      cwd: '/p',
      projectRoot: '/p',
      history: [],
    }
    runDeterministicRules('Bash', { command: 'ls' }, [rule], ctx)
    expect(captured).toHaveLength(1)
    expect(captured[0].cwd).toBe('/p')
  })

  it('lets a rule branch on context.history', () => {
    const history: SessionEvent[] = [
      { kind: 'tool-call', toolName: 'Edit', toolInput: { file_path: '/p/x.ts' } },
      { kind: 'tool-call', toolName: 'Edit', toolInput: { file_path: '/p/y.ts' } },
    ]
    const rule: DeterministicRule = {
      id: 'no-third-edit',
      check: (toolName, _toolInput, ctx) => {
        if (!ctx) return { kind: 'allow' }
        const recentEdits = ctx.history.filter(
          (e) => e.kind === 'tool-call' && e.toolName === 'Edit'
        ).length
        if (toolName === 'Edit' && recentEdits >= 2) {
          return {
            kind: 'block',
            reason: 'Three consecutive Edit calls; stop and review.',
          }
        }
        return { kind: 'allow' }
      },
    }

    const ctx: SessionContext = { cwd: '/p', projectRoot: '/p', history }
    const result = runDeterministicRules(
      'Edit',
      { file_path: '/p/z.ts' },
      [rule],
      ctx
    )
    expect(result.kind).toBe('block')
  })

  it('engine works without ctx for backwards compatibility', () => {
    const rule: DeterministicRule = {
      id: 'no-ctx',
      check: () => ({ kind: 'allow' }),
    }
    const result = runDeterministicRules('Bash', { command: 'ls' }, [rule])
    expect(result.kind).toBe('allow')
  })
})
