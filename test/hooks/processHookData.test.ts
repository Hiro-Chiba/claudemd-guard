import { describe, it, expect } from 'vitest'
import {
  processHookData,
  CooldownStore,
} from '../../src/hooks/processHookData'
import { Config } from '../../src/config/Config'
import { ClaudeMdFile } from '../../src/contracts/types/ClaudeMdFile'
import { ValidationResult } from '../../src/contracts/types/ValidationResult'
import { IModelClient } from '../../src/contracts/types/ModelClient'

const sampleClaudeMdFiles: ClaudeMdFile[] = [
  { path: '/project/CLAUDE.md', content: '# Rules\n- No deleting files' },
]

function createMockValidator(
  result: ValidationResult
): (
  files: ClaudeMdFile[],
  toolName: string,
  toolInput: Record<string, unknown>,
  client: IModelClient
) => Promise<ValidationResult> {
  return async () => result
}

function mockClient(): IModelClient {
  return { ask: async () => '{"decision": null, "reason": "ok"}' }
}

class InMemoryCooldownStore implements CooldownStore {
  private store = new Map<string, number>()

  getLastTime(key: string): number {
    return this.store.get(key) ?? 0
  }

  setLastTime(key: string, time: number): void {
    this.store.set(key, time)
  }
}

describe('processHookData', () => {
  it('passes through non-PreToolUse events', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: {},
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
    })

    expect(result.decision).toBeUndefined()
  })

  it('passes through when disabled', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/test.ts' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: true }),
    })

    expect(result.decision).toBeUndefined()
  })

  it('passes through when no CLAUDE.md files found', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/test.ts' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => [],
    })

    expect(result.decision).toBeUndefined()
  })

  it('passes through invalid JSON input', async () => {
    const result = await processHookData('not json', {
      config: new Config({ disabled: false }),
    })

    expect(result.decision).toBeUndefined()
  })

  it('calls validator for PreToolUse events with CLAUDE.md files', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => sampleClaudeMdFiles,
      validatorFn: createMockValidator({
        decision: 'block',
        reason: 'Dangerous command',
      }),
      getModelClient: () => mockClient(),
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('Dangerous command')
  })

  it('passes through when tool_name is missing', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
    })

    expect(result.decision).toBeUndefined()
  })

  it('respects cooldown period', async () => {
    let callCount = 0
    const mockValidator = async () => {
      callCount++
      return { decision: undefined as const, reason: 'ok' }
    }

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/test.ts' },
    })

    // Use in-memory store to simulate file-based cooldown behavior
    const cooldownStore = new InMemoryCooldownStore()

    const deps = {
      config: new Config({ disabled: false, cooldown: 60 }),
      collectFn: () => sampleClaudeMdFiles,
      validatorFn: mockValidator,
      getModelClient: () => mockClient(),
      cooldownStore,
      cwd: '/unique-cooldown-test-dir',
    }

    // First call should validate
    await processHookData(input, deps)
    expect(callCount).toBe(1)

    // Second call within cooldown should skip
    await processHookData(input, deps)
    expect(callCount).toBe(1)
  })

  it('validates again after cooldown expires', async () => {
    let callCount = 0
    const mockValidator = async () => {
      callCount++
      return { decision: undefined as const, reason: 'ok' }
    }

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/test.ts' },
    })

    // Simulate expired cooldown by pre-setting old timestamp
    const cooldownStore = new InMemoryCooldownStore()
    cooldownStore.setLastTime(
      '/expired-cooldown-test-dir',
      Math.floor(Date.now() / 1000) - 120
    )

    const deps = {
      config: new Config({ disabled: false, cooldown: 60 }),
      collectFn: () => sampleClaudeMdFiles,
      validatorFn: mockValidator,
      getModelClient: () => mockClient(),
      cooldownStore,
      cwd: '/expired-cooldown-test-dir',
    }

    // Should validate because cooldown has expired
    await processHookData(input, deps)
    expect(callCount).toBe(1)
  })
})
