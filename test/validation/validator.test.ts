import { describe, it, expect } from 'vitest'
import { validator } from '../../src/validation/validator'
import { IModelClient } from '../../src/contracts/types/ModelClient'
import { ClaudeMdFile } from '../../src/contracts/types/ClaudeMdFile'

function createMockClient(response: string): IModelClient {
  return {
    ask: async () => response,
  }
}

const sampleClaudeMdFiles: ClaudeMdFile[] = [
  {
    path: '/project/CLAUDE.md',
    content: '# Rules\n- Do not delete production files',
  },
]

describe('validator', () => {
  it('returns undefined decision when model says no violation', async () => {
    const client = createMockClient(
      '```json\n{"decision": null, "reason": "No violation"}\n```'
    )

    const result = await validator(
      sampleClaudeMdFiles,
      'Edit',
      { file_path: '/project/src/app.ts', old_string: 'a', new_string: 'b' },
      client
    )

    expect(result.decision).toBeUndefined()
    expect(result.reason).toBe('No violation')
  })

  it('returns block decision when model detects violation', async () => {
    const client = createMockClient(
      '```json\n{"decision": "block", "reason": "Deleting production files is not allowed"}\n```'
    )

    const result = await validator(
      sampleClaudeMdFiles,
      'Bash',
      { command: 'rm -rf /production' },
      client
    )

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('Deleting production files is not allowed')
  })

  it('handles plain JSON response without code blocks', async () => {
    const client = createMockClient(
      '{"decision": null, "reason": "OK"}'
    )

    const result = await validator(
      sampleClaudeMdFiles,
      'Write',
      { file_path: '/project/src/new.ts', content: 'code' },
      client
    )

    expect(result.decision).toBeUndefined()
    expect(result.reason).toBe('OK')
  })

  it('allows operation when model client throws error', async () => {
    const client: IModelClient = {
      ask: async () => {
        throw new Error('Connection failed')
      },
    }

    const result = await validator(
      sampleClaudeMdFiles,
      'Edit',
      { file_path: '/project/src/app.ts' },
      client
    )

    expect(result.decision).toBeUndefined()
    expect(result.reason).toContain('Validation error')
    expect(result.reason).toContain('Connection failed')
  })

  it('handles response with extra text around JSON', async () => {
    const client = createMockClient(
      'Here is my analysis:\n{"decision": "block", "reason": "Violates rule #1"}\nEnd.'
    )

    const result = await validator(
      sampleClaudeMdFiles,
      'Bash',
      { command: 'something bad' },
      client
    )

    expect(result.decision).toBe('block')
    expect(result.reason).toBe('Violates rule #1')
  })
})
