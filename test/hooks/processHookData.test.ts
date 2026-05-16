import { describe, it, expect, vi } from 'vitest'
import {
  processHookData,
  CooldownStore,
} from '../../src/hooks/processHookData'
import { Config } from '../../src/config/Config'
import { RuleSource } from '../../src/contracts/types/RuleSource'
import { ValidationResult } from '../../src/contracts/types/ValidationResult'
import { IModelClient } from '../../src/contracts/types/ModelClient'
import { DeterministicRule } from '../../src/deterministic/types'
import { cursorAdapter } from '../../src/adapters/cursor/adapter'

const sampleClaudeMdFiles: RuleSource[] = [
  {
    path: '/project/CLAUDE.md',
    content: '# Rules\n- No deleting files',
    kind: 'claude-md',
  },
]

function createMockValidator(
  result: ValidationResult
): (
  files: RuleSource[],
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
      tool_input: { command: 'echo hello' },
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

  it('returns block from a deterministic rule without calling the AI validator', async () => {
    const validatorFn = vi.fn()
    const blockingRule: DeterministicRule = {
      id: 'test-block',
      check: () => ({ kind: 'block', reason: 'deterministic guard fired' }),
    }

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => sampleClaudeMdFiles,
      validatorFn: validatorFn as never,
      getModelClient: () => mockClient(),
      deterministicRules: [blockingRule],
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('deterministic guard fired')
    expect(validatorFn).not.toHaveBeenCalled()
  })

  it('falls through to AI validator when no deterministic rule blocks', async () => {
    const allowRule: DeterministicRule = {
      id: 'always-allow',
      check: () => ({ kind: 'allow' }),
    }

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => sampleClaudeMdFiles,
      validatorFn: createMockValidator({
        decision: 'block',
        reason: 'AI said no',
      }),
      getModelClient: () => mockClient(),
      deterministicRules: [allowRule],
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('AI said no')
  })

  it('runs deterministic rules even when there are no CLAUDE.md files', async () => {
    const blockingRule: DeterministicRule = {
      id: 'test-block',
      check: () => ({ kind: 'block', reason: 'safety baseline' }),
    }

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => [],
      deterministicRules: [blockingRule],
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('safety baseline')
  })

  it('runs deterministic rules even within the cooldown window', async () => {
    const blockingRule: DeterministicRule = {
      id: 'test-block',
      check: () => ({ kind: 'block', reason: 'safety baseline' }),
    }

    const cooldownStore = new InMemoryCooldownStore()
    cooldownStore.setLastTime(
      '/cooldown-still-blocks',
      Math.floor(Date.now() / 1000)
    )

    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false, cooldown: 60 }),
      collectFn: () => sampleClaudeMdFiles,
      cooldownStore,
      cwd: '/cooldown-still-blocks',
      deterministicRules: [blockingRule],
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('safety baseline')
  })

  it('accepts a Cursor adapter and parses cursor payloads', async () => {
    const blockingRule: DeterministicRule = {
      id: 'test-block',
      check: (toolName) =>
        toolName === 'Bash'
          ? { kind: 'block', reason: 'cursor bash blocked' }
          : { kind: 'allow' },
    }

    const input = JSON.stringify({
      hook_event_name: 'beforeShellExecution',
      command: 'rm -rf /etc',
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      adapter: cursorAdapter,
      deterministicRules: [blockingRule],
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('cursor bash blocked')
  })

  it('passes through cursor afterFileEdit (post-event)', async () => {
    const input = JSON.stringify({
      hook_event_name: 'afterFileEdit',
      file_path: '/p/a.ts',
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      adapter: cursorAdapter,
    })

    expect(result.decision).toBeUndefined()
  })

  it('allows a disabled deterministic rule via agentGateConfig', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => [],
      agentGateConfig: {
        disabledRules: ['prevent-rm-rf-root'],
      },
    })

    // With the rm-rf rule disabled and no CLAUDE.md present, the request
    // passes through (collect returns empty -> PASS).
    expect(result.decision).toBeUndefined()
  })

  it('uses custom protectedBranches from agentGateConfig', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin custom-prod' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      agentGateConfig: {
        disabledRules: [],
        protectedBranches: ['custom-prod'],
      },
    })

    expect(result.decision).toBe('block')
  })

  it('appends customRules from agentGateConfig before the AI step', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'DROP TABLE users;' },
    })

    const result = await processHookData(input, {
      config: new Config({ disabled: false }),
      collectFn: () => [],
      agentGateConfig: {
        customRules: [
          {
            id: 'no-drop-table',
            check: (toolName, toolInput) => {
              if (
                toolName === 'Bash' &&
                typeof toolInput.command === 'string' &&
                /drop\s+table/i.test(toolInput.command)
              ) {
                return {
                  kind: 'block',
                  reason: 'DROP TABLE forbidden. Use a migration.',
                }
              }
              return { kind: 'allow' }
            },
          },
        ],
      },
    })

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('DROP TABLE forbidden. Use a migration.')
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
