import { describe, it, expect, vi } from 'vitest'
import { DecisionCache } from '../../src/cache/DecisionCache'
import { ValidationResult } from '../../src/contracts/types/ValidationResult'

const blocked: ValidationResult = { decision: 'block', reason: 'nope' }
const allowed: ValidationResult = { decision: undefined, reason: '' }

function key(adapter: string, toolName: string, input: Record<string, unknown>, cwd: string) {
  return { adapter, toolName, toolInput: input, cwd }
}

describe('DecisionCache', () => {
  it('returns null for a miss', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    expect(cache.get(key('a', 'Bash', { command: 'ls' }, '/p'))).toBeNull()
  })

  it('returns the stored verdict on a hit', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    const k = key('a', 'Bash', { command: 'rm -rf /' }, '/p')
    cache.set(k, blocked)
    const hit = cache.get(k)
    expect(hit).toEqual(blocked)
  })

  it('treats different cwd as different keys', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    cache.set(key('a', 'Bash', { command: 'ls' }, '/p1'), allowed)
    expect(cache.get(key('a', 'Bash', { command: 'ls' }, '/p2'))).toBeNull()
  })

  it('treats different toolInput as different keys', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    cache.set(key('a', 'Bash', { command: 'ls' }, '/p'), allowed)
    expect(cache.get(key('a', 'Bash', { command: 'ls -la' }, '/p'))).toBeNull()
  })

  it('hits regardless of toolInput key order (canonical serialization)', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    cache.set(key('a', 'Write', { file_path: '/x', content: 'a' }, '/p'), allowed)
    const hit = cache.get(
      key('a', 'Write', { content: 'a', file_path: '/x' }, '/p')
    )
    expect(hit).toEqual(allowed)
  })

  it('expires entries past the TTL', () => {
    const now = vi.fn(() => 1000)
    const cache = new DecisionCache({ ttlSec: 10, maxEntries: 10, now })
    const k = key('a', 'Bash', { command: 'ls' }, '/p')
    cache.set(k, allowed)
    expect(cache.get(k)).toEqual(allowed)
    now.mockReturnValue(1000 + 11 * 1000)
    expect(cache.get(k)).toBeNull()
  })

  it('evicts the least-recently-used entry when over capacity', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 2 })
    cache.set(key('a', 'Bash', { command: 'a' }, '/p'), allowed)
    cache.set(key('a', 'Bash', { command: 'b' }, '/p'), allowed)
    // Touch 'a' to make it most recently used
    cache.get(key('a', 'Bash', { command: 'a' }, '/p'))
    // Add 'c' -> should evict 'b' (now LRU)
    cache.set(key('a', 'Bash', { command: 'c' }, '/p'), allowed)
    expect(cache.get(key('a', 'Bash', { command: 'a' }, '/p'))).not.toBeNull()
    expect(cache.get(key('a', 'Bash', { command: 'b' }, '/p'))).toBeNull()
    expect(cache.get(key('a', 'Bash', { command: 'c' }, '/p'))).not.toBeNull()
  })

  it('reports size and clear()', () => {
    const cache = new DecisionCache({ ttlSec: 60, maxEntries: 10 })
    cache.set(key('a', 'Bash', { command: 'x' }, '/p'), allowed)
    expect(cache.size).toBe(1)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
