#!/usr/bin/env node

import { processHookData } from '../hooks/processHookData'
import { ValidationResult } from '../contracts/types/ValidationResult'

export async function run(input: string): Promise<ValidationResult> {
  return processHookData(input)
}

if (require.main === module) {
  let inputData = ''
  process.stdin.setEncoding('utf8')

  process.stdin.on('data', (chunk) => {
    inputData += chunk
  })

  process.stdin.on('end', async () => {
    try {
      const result = await run(inputData)
      console.log(JSON.stringify(result))
    } catch (error) {
      console.error('claudemd-guard error:', error)
    } finally {
      process.exit(0)
    }
  })
}
