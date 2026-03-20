import { execFileSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { IModelClient } from '../../contracts/types/ModelClient'
import { Config } from '../../config/Config'
import { SYSTEM_PROMPT } from '../prompts/system-prompt'

export class ClaudeCli implements IModelClient {
  private readonly config: Config

  constructor(config: Config) {
    this.config = config
  }

  async ask(prompt: string): Promise<string> {
    const claudeBinary = this.getClaudeBinary()

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`

    const args = [
      '-',
      '--output-format',
      'json',
      '--max-turns',
      '1',
      '--model',
      this.config.model,
      '--disallowed-tools',
      'Edit,Write,Bash,Read,Glob,Grep',
      '--strict-mcp-config',
    ]

    const claudeDir = join(process.cwd(), '.claude')
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
    }

    const output = execFileSync(claudeBinary, args, {
      encoding: 'utf-8',
      timeout: 60000,
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

    // Try the standard Claude Code local binary first
    const localBinary = join(homedir(), '.claude', 'local', 'claude')
    if (existsSync(localBinary)) {
      return localBinary
    }

    // Fall back to PATH
    return 'claude'
  }
}
