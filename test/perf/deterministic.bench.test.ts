import { describe, it, expect } from 'vitest'
import { runDeterministicRules } from '../../src/deterministic/engine'
import { buildDefaultDeterministicRules } from '../../src/deterministic/defaultRules'

/**
 * Micro-benchmark for the deterministic layer. agent-gate is hot path
 * for every PreToolUse event, so latency here matters. We assert a
 * generous upper bound; the typical observed p99 on a recent laptop
 * is well under 1ms.
 */
describe('deterministic engine performance', () => {
  it('runs the full default rule set in under 2ms per call (p99 of 10k runs)', () => {
    const rules = buildDefaultDeterministicRules()
    const samples = [
      { toolName: 'Bash', toolInput: { command: 'ls -la' } },
      { toolName: 'Bash', toolInput: { command: 'rm -rf ./build' } },
      { toolName: 'Bash', toolInput: { command: 'git push origin main' } },
      {
        toolName: 'Write',
        toolInput: { file_path: '/Users/me/project/src/index.ts', content: '' },
      },
      {
        toolName: 'Edit',
        toolInput: { file_path: '/Users/me/project/.env.example', old_string: 'a', new_string: 'b' },
      },
    ] as const

    // Warmup to let the JIT settle.
    for (let i = 0; i < 1000; i++) {
      runDeterministicRules(
        samples[i % samples.length].toolName,
        samples[i % samples.length].toolInput,
        rules
      )
    }

    const N = 10000
    const durations: number[] = []
    for (let i = 0; i < N; i++) {
      const s = samples[i % samples.length]
      const start = process.hrtime.bigint()
      runDeterministicRules(s.toolName, s.toolInput, rules)
      const end = process.hrtime.bigint()
      durations.push(Number(end - start) / 1_000_000) // ns -> ms
    }
    durations.sort((a, b) => a - b)
    const p99 = durations[Math.floor(N * 0.99)]

    expect(p99).toBeLessThan(2)
  })
})
