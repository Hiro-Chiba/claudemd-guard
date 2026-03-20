import { execFileSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { IModelClient } from '../../contracts/types/ModelClient'
import { Config } from '../../config/Config'
import { SYSTEM_PROMPT } from '../prompts/system-prompt'

const CLI_TIMEOUT_MS = 60_000
const CLI_MAX_TURNS = '1'
const DISALLOWED_TOOLS = 'Edit,Write,Bash,Read,Glob,Grep'

export class ClaudeCli implements IModelClient {
  private readonly config: Config
  private readonly cwd: string

  constructor(config: Config, cwd?: string) {
    this.config = config
    this.cwd = cwd ?? process.cwd()
  }

  async ask(prompt: string): Promise<string> {
    const claudeBinary = this.getClaudeBinary()

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`

    const args = [
      '-',
      '--output-format',
      'json',
      '--max-turns',
      CLI_MAX_TURNS,
      '--model',
      this.config.model,
      '--disallowed-tools',
      DISALLOWED_TOOLS,
      '--strict-mcp-config',
    ]

    const claudeDir = join(this.cwd, '.claude')
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
    }

    const output = execFileSync(claudeBinary, args, {
      encoding: 'utf-8',
      timeout: CLI_TIMEOUT_MS,
      input: fullPrompt,
      cwd: claudeDir,
      shell: process.platform === 'win32',
    })

    const response = JSON.parse(output)
    return response.result
  }

  private getClaudeBinary(): string {
    if (this.config.useSystemClaude) {
      return 'claude'
    }

    const localBinary = join(homedir(), '.claude', 'local', 'claude')
    if (existsSync(localBinary)) {
      return localBinary
    }

    return 'claude'
  }
}
