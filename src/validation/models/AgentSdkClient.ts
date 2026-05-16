import { IModelClient } from '../../contracts/types/ModelClient'
import { Config } from '../../config/Config'
import { getSystemPrompt } from '../prompts/system-prompt'

/**
 * Shape of the `query` export from `@anthropic-ai/claude-agent-sdk`,
 * as documented by Anthropic. The SDK returns an AsyncIterable of
 * streamed messages and accepts a small set of options.
 */
export type AgentSdkQueryFn = (args: {
  prompt: string
  options?: {
    model?: string
    allowedTools?: string[]
    permissionMode?: 'default' | 'bypassPermissions' | 'dontAsk'
    maxTurns?: number
  }
}) => AsyncIterable<unknown>

export interface AgentSdkClientOptions {
  config: Config
  /**
   * Override the SDK loader. Production builds default to a dynamic
   * import of `@anthropic-ai/claude-agent-sdk`; tests inject a fake.
   */
  loadQuery?: () => Promise<AgentSdkQueryFn>
}

/**
 * IModelClient that runs validation through Anthropic's agent SDK
 * (`@anthropic-ai/claude-agent-sdk`). Reuses the host process's
 * existing Claude authentication so no separate API key is required.
 *
 * Tradeoff: the SDK has noticeable cold-start cost on each call.
 * Recommended paired with `agent-gate daemon` so the SDK initialization
 * is amortized across hook invocations.
 */
export class AgentSdkClient implements IModelClient {
  private readonly config: Config
  private readonly loadQuery: () => Promise<AgentSdkQueryFn>

  constructor(opts: AgentSdkClientOptions) {
    this.config = opts.config
    this.loadQuery = opts.loadQuery ?? defaultLoadQuery
  }

  async ask(prompt: string): Promise<string> {
    let query: AgentSdkQueryFn
    try {
      query = await this.loadQuery()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Agent SDK loader failed; install @anthropic-ai/claude-agent-sdk or fall back to another client. Underlying: ${msg}`
      )
    }

    const fullPrompt = `${getSystemPrompt(this.config.reasonLang)}\n\n${prompt}`

    let lastText = ''
    for await (const message of query({
      prompt: fullPrompt,
      options: {
        model: this.config.model,
        allowedTools: [],
        permissionMode: 'bypassPermissions',
        maxTurns: 1,
      },
    })) {
      const t = extractText(message)
      if (t) lastText = t
    }

    if (!lastText) {
      throw new Error('No response from agent SDK stream')
    }
    return lastText
  }
}

async function defaultLoadQuery(): Promise<AgentSdkQueryFn> {
  const mod = (await import('@anthropic-ai/claude-agent-sdk' as string)) as {
    query?: AgentSdkQueryFn
  }
  if (typeof mod.query !== 'function') {
    throw new Error('@anthropic-ai/claude-agent-sdk did not export query()')
  }
  return mod.query
}

/**
 * Pulls assistant text out of one streamed message. The SDK emits a
 * mix of system / assistant / result envelopes; we cover the common
 * shapes and ignore the rest.
 */
function extractText(message: unknown): string | null {
  if (typeof message !== 'object' || message === null) return null
  const m = message as Record<string, unknown>

  if (typeof m.result === 'string' && m.result.length > 0) return m.result

  const inner = m.message
  if (typeof inner === 'object' && inner !== null) {
    const content = (inner as Record<string, unknown>).content
    if (Array.isArray(content)) {
      const text = content
        .map((c) => {
          if (typeof c === 'object' && c !== null) {
            const block = c as Record<string, unknown>
            if (typeof block.text === 'string') return block.text
          }
          return null
        })
        .filter((s): s is string => Boolean(s))
        .join('\n')
      if (text.length > 0) return text
    }
  }

  if (typeof m.text === 'string' && m.text.length > 0) return m.text

  return null
}
