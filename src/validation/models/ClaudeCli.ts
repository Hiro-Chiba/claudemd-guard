import { execFileSync } from 'child_process'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { IModelClient } from '../../contracts/types/ModelClient'
import { Config } from '../../config/Config'
import { getSystemPrompt } from '../prompts/system-prompt'

const CLI_TIMEOUT_MS = 60_000
const CLI_MAX_TURNS = '1'
const DISALLOWED_TOOLS = 'Edit,Write,Bash,Read,Glob,Grep'
// Prefix is matched against in tests; keep it stable.
export const CLAUDE_TMP_PREFIX = 'agent-gate-claude-'

export class ClaudeCli implements IModelClient {
  private readonly config: Config

  constructor(config: Config) {
    this.config = config
  }

  async ask(prompt: string): Promise<string> {
    const claudeBinary = this.getClaudeBinary()

    const fullPrompt = `${getSystemPrompt(this.config.reasonLang)}\n\n${prompt}`

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

    // Run the validation claude process from an isolated tmpdir so we do
    // not leave a stray `.claude/` directory inside the user's project,
    // and so the user's project-level `.claude/settings.json` cannot
    // alter validation behavior. A fresh dir per call also avoids
    // concurrent invocations stepping on each other.
    const claudeDir = mkdtempSync(join(tmpdir(), CLAUDE_TMP_PREFIX))

    try {
      const output = execFileSync(claudeBinary, args, {
        encoding: 'utf-8',
        timeout: CLI_TIMEOUT_MS,
        input: fullPrompt,
        cwd: claudeDir,
        // shell is needed on Windows to invoke the `.cmd` shim that npm creates
        // for installed bins. On Unix the binary is invoked directly via execve,
        // so shell interpretation (and any associated injection surface) is off.
        // All args passed here are constants or validated config values, so this
        // flag does not widen the injection surface in practice.
        shell: process.platform === 'win32',
      })

      const response = JSON.parse(output)
      return response.result
    } finally {
      try {
        rmSync(claudeDir, { recursive: true, force: true })
      } catch {
        // best-effort: a leftover tmpdir is harmless; never let cleanup
        // failures mask the real validation result or error.
      }
    }
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
