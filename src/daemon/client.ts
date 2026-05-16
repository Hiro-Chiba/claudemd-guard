import { createConnection } from 'net'
import { DaemonRequest, DaemonResponse } from './protocol'

export interface SendToDaemonOptions {
  socketPath: string
  /** Connection + response timeout in ms. */
  timeoutMs?: number
}

/**
 * Connect to a running agent-gate daemon and exchange one request.
 *
 * Returns the daemon's DaemonResponse on success.
 * Returns null when the daemon is not running, the response cannot be
 * parsed, the daemon reported an error, or the timeout elapsed. The
 * caller is expected to fall back to direct (one-shot) mode in any of
 * those cases.
 */
export function sendToDaemon(
  request: DaemonRequest,
  opts: SendToDaemonOptions
): Promise<DaemonResponse | null> {
  const timeoutMs = opts.timeoutMs ?? 2000
  return new Promise((resolve) => {
    let settled = false
    const done = (val: DaemonResponse | null): void => {
      if (settled) return
      settled = true
      resolve(val)
    }

    const sock = createConnection(opts.socketPath)
    const timer = setTimeout(() => {
      sock.destroy()
      done(null)
    }, timeoutMs)

    let buffer = ''
    sock.setEncoding('utf-8')
    sock.on('connect', () => {
      sock.write(JSON.stringify(request) + '\n')
    })
    sock.on('data', (chunk) => {
      buffer += chunk
    })
    sock.on('end', () => {
      clearTimeout(timer)
      const line = buffer.trim()
      if (!line) return done(null)
      try {
        const parsed = JSON.parse(line) as
          | DaemonResponse
          | { error: string }
        if ('error' in parsed) return done(null)
        if (typeof parsed.output !== 'string') return done(null)
        done(parsed)
      } catch {
        done(null)
      }
    })
    sock.on('error', () => {
      clearTimeout(timer)
      done(null)
    })
  })
}
