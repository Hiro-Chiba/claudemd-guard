import { IModelClient } from '../../contracts/types/ModelClient'

export interface CompositeModelClientOptions {
  /** Per-client timeout in ms. A client that exceeds this is treated as failed. */
  timeoutMs?: number
}

/**
 * Tries each client in order, returning the first successful response.
 * If a client throws or exceeds the optional timeout, the composite
 * falls back to the next client. When every client fails, the composite
 * itself throws an aggregate error so the AI validator's outer
 * try/catch can fail-open the request.
 */
export class CompositeModelClient implements IModelClient {
  private readonly clients: IModelClient[]
  private readonly timeoutMs?: number

  constructor(clients: IModelClient[], opts?: CompositeModelClientOptions) {
    if (clients.length === 0) {
      throw new Error('CompositeModelClient requires at least one IModelClient')
    }
    this.clients = clients
    this.timeoutMs = opts?.timeoutMs
  }

  async ask(prompt: string): Promise<string> {
    const errors: string[] = []
    for (let i = 0; i < this.clients.length; i++) {
      const c = this.clients[i]
      try {
        return await this.askWithOptionalTimeout(c, prompt)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`client[${i}]: ${msg}`)
      }
    }
    throw new Error(
      `CompositeModelClient: all ${this.clients.length} clients failed. ${errors.join(' | ')}`
    )
  }

  private async askWithOptionalTimeout(
    client: IModelClient,
    prompt: string
  ): Promise<string> {
    if (this.timeoutMs === undefined) {
      return client.ask(prompt)
    }
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`client timeout after ${this.timeoutMs}ms`))
      }, this.timeoutMs)
      client.ask(prompt).then(
        (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        (err: unknown) => {
          clearTimeout(timer)
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      )
    })
  }
}
