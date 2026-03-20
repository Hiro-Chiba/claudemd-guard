import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import { HookDataSchema } from '../contracts/schemas/hookDataSchema'
import { ValidationResult } from '../contracts/types/ValidationResult'
import { ClaudeMdFile } from '../contracts/types/ClaudeMdFile'
import { IModelClient } from '../contracts/types/ModelClient'
import { collectClaudeMd } from '../collector/collectClaudeMd'
import { validator } from '../validation/validator'
import { Config } from '../config/Config'
import { ClaudeCli } from '../validation/models/ClaudeCli'
import { AnthropicApi } from '../validation/models/AnthropicApi'

const PASS: ValidationResult = { decision: undefined, reason: '' }

export interface CooldownStore {
  getLastTime(key: string): number
  setLastTime(key: string, time: number): void
}

class FileCooldownStore implements CooldownStore {
  private readonly dir: string

  constructor() {
    this.dir = join(tmpdir(), 'claudemd-guard')
    mkdirSync(this.dir, { recursive: true })
  }

  private stampPath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex')
    return join(this.dir, hash)
  }

  getLastTime(key: string): number {
    try {
      return parseInt(readFileSync(this.stampPath(key), 'utf-8'), 10) || 0
    } catch {
      return 0
    }
  }

  setLastTime(key: string, time: number): void {
    writeFileSync(this.stampPath(key), String(time))
  }
}

export interface ProcessHookDataDeps {
  config?: Config
  collectFn?: (cwd: string) => ClaudeMdFile[]
  validatorFn?: typeof validator
  getModelClient?: (config: Config) => IModelClient
  cooldownStore?: CooldownStore
  cwd?: string
}

export async function processHookData(
  input: string,
  deps?: ProcessHookDataDeps
): Promise<ValidationResult> {
  const config = deps?.config ?? new Config()

  if (config.disabled) {
    return PASS
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return PASS
  }

  const result = HookDataSchema.safeParse(parsed)
  if (!result.success) {
    return PASS
  }

  const hookData = result.data

  // Only process PreToolUse events
  if (hookData.hook_event_name !== 'PreToolUse') {
    return PASS
  }

  const toolName = hookData.tool_name
  const toolInput = hookData.tool_input
  if (!toolName || !toolInput) {
    return PASS
  }

  // Cooldown check (file-based, persists across process invocations)
  const cwd = deps?.cwd ?? process.cwd()
  if (config.cooldown > 0) {
    const store = deps?.cooldownStore ?? new FileCooldownStore()
    const now = Math.floor(Date.now() / 1000)
    const lastTime = store.getLastTime(cwd)
    if (now - lastTime < config.cooldown) {
      return PASS
    }
    store.setLastTime(cwd, now)
  }

  // Collect CLAUDE.md files
  const collect = deps?.collectFn ?? collectClaudeMd
  const claudeMdFiles = collect(cwd)

  if (claudeMdFiles.length === 0) {
    return PASS
  }

  // Get model client
  const getClient = deps?.getModelClient ?? createModelClient
  const modelClient = getClient(config)

  // Validate
  const validate = deps?.validatorFn ?? validator
  return validate(claudeMdFiles, toolName, toolInput, modelClient)
}

function createModelClient(config: Config): IModelClient {
  if (config.useApi) {
    return new AnthropicApi(config)
  }
  return new ClaudeCli(config)
}
