import { createServer, Server, Socket } from 'net'
import { existsSync, unlinkSync } from 'fs'
import { DaemonRequest, DaemonResponse } from './protocol'

export type DaemonHandler = (
  req: DaemonRequest
) => Promise<DaemonResponse>

export interface DaemonServerOptions {
  socketPath: string
  handler: DaemonHandler
}

/**
 * Long-lived agent-gate process accepting hook payloads over a Unix socket.
 *
 * Wire protocol per connection:
 *   - client writes one JSON object (DaemonRequest) terminated by '\n'.
 *   - server writes one JSON object back ({output: "..."} or {error: "..."})
 *     terminated by '\n', then closes the socket.
 *
 * Errors in the handler become {error: ...} responses; the client treats
 * those as "fall back to direct mode" and the pipeline continues without
 * blocking the agent.
 */
export class DaemonServer {
  private readonly opts: DaemonServerOptions
  private server: Server | null = null

  constructor(opts: DaemonServerOptions) {
    this.opts = opts
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (existsSync(this.opts.socketPath)) {
          unlinkSync(this.opts.socketPath)
        }
      } catch (e) {
        reject(e)
        return
      }
      const server = createServer((socket) => this.handleSocket(socket))
      server.on('error', (err) => {
        if (this.server === null) reject(err)
      })
      server.listen(this.opts.socketPath, () => {
        this.server = server
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      const s = this.server
      this.server = null
      s.close(() => {
        try {
          if (existsSync(this.opts.socketPath)) {
            unlinkSync(this.opts.socketPath)
          }
        } catch {
          // best effort
        }
        resolve()
      })
    })
  }

  private handleSocket(socket: Socket): void {
    let buffer = ''
    socket.setEncoding('utf-8')
    socket.on('data', async (chunk) => {
      buffer += chunk
      const newlineIdx = buffer.indexOf('\n')
      if (newlineIdx === -1) return
      const line = buffer.slice(0, newlineIdx)
      buffer = ''
      let req: DaemonRequest
      try {
        req = JSON.parse(line) as DaemonRequest
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'invalid JSON'
        socket.end(JSON.stringify({ error: msg }) + '\n')
        return
      }
      try {
        const resp = await this.opts.handler(req)
        socket.end(JSON.stringify(resp) + '\n')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'handler failed'
        socket.end(JSON.stringify({ error: msg }) + '\n')
      }
    })
    socket.on('error', () => {
      // ignore — client side disconnected; nothing to do
    })
  }
}
