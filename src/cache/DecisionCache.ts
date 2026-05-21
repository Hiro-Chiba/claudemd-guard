import { ValidationResult } from '../contracts/types/ValidationResult'

export interface CacheKey {
  adapter: string
  toolName: string
  toolInput: Record<string, unknown>
  /**
   * Stable project identifier (typically the closest dir with `.git`,
   * `package.json`, or `.agent-gate.config.*`). Same key value across
   * subdirectories of the same project so cache hits survive `cd`.
   */
  projectRoot: string
}

export interface DecisionCacheOptions {
  /** Time to live in seconds. Entries past this age miss. */
  ttlSec: number
  /** Max entries before LRU eviction kicks in. */
  maxEntries: number
  /** Clock injection for testing. Defaults to Date.now. */
  now?: () => number
}

interface Entry {
  value: ValidationResult
  expiresAt: number
}

/**
 * In-process LRU + TTL cache of agent-gate decisions.
 *
 * Most useful inside `agent-gate daemon` where the cache persists
 * across hook invocations. Same {adapter, toolName, toolInput,
 * projectRoot} within the TTL skips the entire pipeline (deterministic
 * engine, collector, AI call) and returns the prior verdict.
 */
export class DecisionCache {
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number
  private readonly store: Map<string, Entry> = new Map()

  constructor(opts: DecisionCacheOptions) {
    this.ttlMs = opts.ttlSec * 1000
    this.maxEntries = opts.maxEntries
    this.now = opts.now ?? Date.now
  }

  private hash(key: CacheKey): string {
    return JSON.stringify({
      a: key.adapter,
      t: key.toolName,
      p: key.projectRoot,
      i: canonicalize(key.toolInput),
    })
  }

  get(key: CacheKey): ValidationResult | null {
    const k = this.hash(key)
    const entry = this.store.get(k)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.store.delete(k)
      return null
    }
    // Refresh LRU order: re-insert.
    this.store.delete(k)
    this.store.set(k, entry)
    return entry.value
  }

  set(key: CacheKey, value: ValidationResult): void {
    const k = this.hash(key)
    this.store.delete(k)
    this.store.set(k, { value, expiresAt: this.now() + this.ttlMs })
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  get size(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }
}

/**
 * Stable string representation of an arbitrary JSON-like input.
 * Sorts object keys so key-order does not affect cache hits.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = canonicalize(obj[k])
    }
    return sorted
  }
  return value
}
