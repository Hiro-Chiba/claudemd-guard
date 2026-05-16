export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export type ConfigOptions = {
  model?: string
  apiKey?: string
  cooldown?: number
  disabled?: boolean
  useSystemClaude?: boolean
  /**
   * Language for the AI validator's "reason" field.
   * - "auto" (or undefined): match the dominant language of the instruction
   *   files, falling back to English when ambiguous.
   * - "en", "ja", "zh", "ko", etc.: write reasons in that language.
   */
  reasonLang?: string
  /**
   * Prefer Anthropic's agent SDK (`@anthropic-ai/claude-agent-sdk`) as the
   * first model client. Reuses the host process's Claude auth, removing
   * the need for AGENT_GATE_API_KEY. The SDK has noticeable cold-start
   * cost, so this is most useful when paired with `agent-gate daemon`.
   */
  useSdk?: boolean
  /**
   * Behavior when a rule or model client throws unexpectedly.
   * - "allow" (default): swallow the error and let the operation through.
   *   Optimized for developer ergonomics so flaky AI does not block work.
   * - "block": turn the error into a block verdict. Recommended for
   *   production / enterprise pipelines that prefer fail-closed safety.
   */
  onError?: 'allow' | 'block'
}

export class Config {
  readonly model: string
  readonly apiKey: string | undefined
  readonly cooldown: number
  readonly disabled: boolean
  readonly useSystemClaude: boolean
  readonly reasonLang: string | undefined
  readonly useSdk: boolean
  readonly onError: 'allow' | 'block'

  constructor(options?: ConfigOptions) {
    this.model = options?.model ?? process.env.AGENT_GATE_MODEL ?? DEFAULT_MODEL
    this.apiKey = options?.apiKey ?? process.env.AGENT_GATE_API_KEY
    const parsedCooldown = parseInt(process.env.AGENT_GATE_COOLDOWN ?? '0', 10)
    this.cooldown = options?.cooldown ?? (Number.isNaN(parsedCooldown) ? 0 : parsedCooldown)
    this.disabled = options?.disabled ?? process.env.AGENT_GATE_DISABLED === 'true'
    this.useSystemClaude = options?.useSystemClaude ?? process.env.USE_SYSTEM_CLAUDE === 'true'
    this.reasonLang = options?.reasonLang ?? process.env.AGENT_GATE_REASON_LANG
    this.useSdk = options?.useSdk ?? process.env.AGENT_GATE_USE_SDK === '1'
    const envOnError = process.env.AGENT_GATE_ON_ERROR
    this.onError =
      options?.onError ??
      (envOnError === 'block' ? 'block' : 'allow')
  }

  get useApi(): boolean {
    return this.apiKey !== undefined && this.apiKey !== ''
  }
}
