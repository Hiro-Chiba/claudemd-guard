import { describe, it, expect, vi } from 'vitest'
import { CompositeModelClient } from '../../../src/validation/models/CompositeModelClient'
import { IModelClient } from '../../../src/contracts/types/ModelClient'

function client(name: string, behavior: 'ok' | 'throw' | 'slow'): IModelClient {
  return {
    ask: vi.fn(async () => {
      if (behavior === 'throw') throw new Error(`${name} failed`)
      if (behavior === 'slow') {
        await new Promise((r) => setTimeout(r, 200))
        return `${name}:slow`
      }
      return `${name}:ok`
    }),
  }
}

describe('CompositeModelClient', () => {
  it('returns the first client response when it succeeds', async () => {
    const c1 = client('primary', 'ok')
    const c2 = client('fallback', 'ok')
    const composite = new CompositeModelClient([c1, c2])

    const result = await composite.ask('prompt')

    expect(result).toBe('primary:ok')
    expect(c2.ask).not.toHaveBeenCalled()
  })

  it('falls back to the next client when the first throws', async () => {
    const c1 = client('primary', 'throw')
    const c2 = client('fallback', 'ok')
    const composite = new CompositeModelClient([c1, c2])

    const result = await composite.ask('prompt')

    expect(result).toBe('fallback:ok')
    expect(c1.ask).toHaveBeenCalled()
    expect(c2.ask).toHaveBeenCalled()
  })

  it('tries every client until one succeeds', async () => {
    const c1 = client('a', 'throw')
    const c2 = client('b', 'throw')
    const c3 = client('c', 'ok')
    const composite = new CompositeModelClient([c1, c2, c3])

    const result = await composite.ask('prompt')

    expect(result).toBe('c:ok')
  })

  it('throws when every client fails', async () => {
    const c1 = client('a', 'throw')
    const c2 = client('b', 'throw')
    const composite = new CompositeModelClient([c1, c2])

    await expect(composite.ask('prompt')).rejects.toThrow(/all .* failed/i)
  })

  it('respects per-client timeout and falls back when exceeded', async () => {
    const slow = client('slow', 'slow') // 200ms
    const fast = client('fast', 'ok')
    const composite = new CompositeModelClient([slow, fast], { timeoutMs: 50 })

    const result = await composite.ask('prompt')

    expect(result).toBe('fast:ok')
  })

  it('throws when given an empty client list', () => {
    expect(() => new CompositeModelClient([])).toThrow(/at least one/i)
  })
})
