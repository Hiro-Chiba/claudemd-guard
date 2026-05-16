import { describe, it, expect, vi } from 'vitest'
import { AgentSdkClient } from '../../../src/validation/models/AgentSdkClient'
import { Config } from '../../../src/config/Config'

function makeQueryFn(messages: unknown[]): ReturnType<typeof vi.fn> {
  return vi.fn(() => {
    return (async function* () {
      for (const m of messages) yield m
    })()
  })
}

describe('AgentSdkClient', () => {
  it('returns the assistant text from a streamed response', async () => {
    const query = makeQueryFn([
      { type: 'system', subtype: 'init' },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '{"decision": "block", "reason": "test"}' },
          ],
        },
      },
      { type: 'result', subtype: 'success', total_cost_usd: 0.001 },
    ])
    const client = new AgentSdkClient({
      config: new Config(),
      loadQuery: async () => query,
    })

    const out = await client.ask('user prompt')

    expect(out).toContain('"decision": "block"')
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('falls back to a result-shaped message when assistant content is absent', async () => {
    const query = makeQueryFn([
      { type: 'result', subtype: 'success', result: 'plain text result' },
    ])
    const client = new AgentSdkClient({
      config: new Config(),
      loadQuery: async () => query,
    })
    const out = await client.ask('p')
    expect(out).toBe('plain text result')
  })

  it('throws when the stream yields no text content', async () => {
    const query = makeQueryFn([
      { type: 'system', subtype: 'init' },
      { type: 'result', subtype: 'success' },
    ])
    const client = new AgentSdkClient({
      config: new Config(),
      loadQuery: async () => query,
    })
    await expect(client.ask('p')).rejects.toThrow(/no response/i)
  })

  it('passes model, maxTurns, allowedTools=[] and a bypass permissionMode to the query', async () => {
    const query = makeQueryFn([
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'ok' }] },
      },
    ])
    const client = new AgentSdkClient({
      config: new Config({ model: 'claude-sonnet-4-6' }),
      loadQuery: async () => query,
    })
    await client.ask('p')
    const arg = (query.mock.calls[0]?.[0] ?? {}) as {
      prompt?: string
      options?: {
        model?: string
        maxTurns?: number
        allowedTools?: string[]
        permissionMode?: string
      }
    }
    expect(arg.options?.model).toBe('claude-sonnet-4-6')
    expect(arg.options?.maxTurns).toBe(1)
    expect(arg.options?.allowedTools).toEqual([])
    expect(arg.options?.permissionMode).toMatch(/bypass|dontAsk/)
  })

  it('prefixes the system prompt before the user prompt', async () => {
    const query = makeQueryFn([
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'ok' }] },
      },
    ])
    const client = new AgentSdkClient({
      config: new Config(),
      loadQuery: async () => query,
    })
    await client.ask('USER_PROMPT_BODY')
    const arg = (query.mock.calls[0]?.[0] ?? {}) as { prompt?: string }
    expect(arg.prompt).toMatch(/guardrail|enforcer/i)
    expect(arg.prompt).toContain('USER_PROMPT_BODY')
  })

  it('wraps a loader failure with a clear message', async () => {
    const client = new AgentSdkClient({
      config: new Config(),
      loadQuery: async () => {
        throw new Error('module not found')
      },
    })
    await expect(client.ask('p')).rejects.toThrow(/agent sdk/i)
  })
})
