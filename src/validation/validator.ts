import { ValidationResult } from '../contracts/types/ValidationResult'
import { ClaudeMdFile } from '../contracts/types/ClaudeMdFile'
import { IModelClient } from '../contracts/types/ModelClient'
import { buildPrompt } from './prompts/context'

interface ModelResponseJson {
  decision: 'block' | null
  reason: string
}

export async function validator(
  claudeMdFiles: ClaudeMdFile[],
  toolName: string,
  toolInput: Record<string, unknown>,
  modelClient: IModelClient
): Promise<ValidationResult> {
  try {
    const prompt = buildPrompt(claudeMdFiles, toolName, toolInput)
    const response = await modelClient.ask(prompt)
    return parseModelResponse(response)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return {
      decision: undefined,
      reason: `Validation error (allowing operation): ${errorMessage}`,
    }
  }
}

function parseModelResponse(response: string): ValidationResult {
  const jsonString = extractJsonString(response)
  const parsed = JSON.parse(jsonString) as Partial<ModelResponseJson>
  return {
    decision: parsed.decision === 'block' ? 'block' : undefined,
    reason: parsed.reason ?? '',
  }
}

function extractJsonString(response: string): string {
  if (!response) {
    throw new Error('No response from model')
  }

  const jsonFromCodeBlock = extractFromJsonCodeBlock(response)
  if (jsonFromCodeBlock) return jsonFromCodeBlock

  const jsonFromGenericBlock = extractFromGenericCodeBlock(response)
  if (jsonFromGenericBlock) return jsonFromGenericBlock

  const plainJson = extractPlainJson(response)
  if (plainJson) return plainJson

  return response
}

function extractFromJsonCodeBlock(response: string): string | null {
  const startPattern = '```json'
  const endPattern = '```'

  let startIndex = 0
  let lastBlock: string | null = null
  let blockStart = response.indexOf(startPattern, startIndex)

  while (blockStart !== -1) {
    const contentStart = blockStart + startPattern.length
    const blockEnd = response.indexOf(endPattern, contentStart)
    if (blockEnd === -1) break

    lastBlock = response.substring(contentStart, blockEnd).trim()
    startIndex = blockEnd + endPattern.length
    blockStart = response.indexOf(startPattern, startIndex)
  }

  return lastBlock
}

function extractFromGenericCodeBlock(response: string): string | null {
  const startPattern = '```'
  let lastValidBlock: string | null = null
  let searchFrom = 0

  while (true) {
    const blockStart = response.indexOf(startPattern, searchFrom)
    if (blockStart === -1) break

    let contentStart = blockStart + startPattern.length
    while (contentStart < response.length && /\s/.test(response[contentStart])) {
      contentStart++
    }

    const blockEnd = response.indexOf(startPattern, contentStart)
    if (blockEnd === -1) break

    const content = response.substring(contentStart, blockEnd).trim()
    if (isValidJson(content)) {
      lastValidBlock = content
    }

    searchFrom = blockEnd + startPattern.length
  }

  return lastValidBlock
}

function extractPlainJson(response: string): string | null {
  const pattern =
    /\{[^{}]*"decision"[^{}]*"reason"[^{}]*}|\{[^{}]*"reason"[^{}]*"decision"[^{}]*}/g
  const matches = response.match(pattern)
  if (!matches) return null

  const lastMatch = matches[matches.length - 1]
  return isValidJson(lastMatch) ? lastMatch : null
}

function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}
