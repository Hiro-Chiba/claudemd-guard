import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { DaemonServer } from '../../src/daemon/server'
import { sendToDaemon } from '../../src/daemon/client'

const ROOT = join(__dirname, '..', '..', 'tmp', 'test-daemon')

function freshSocket(name: string): string {
  return join(ROOT, `${name}-${Date.now()}.sock`)
}

describe('DaemonServer + sendToDaemon', () => {
  beforeEach(() => mkdirSync(ROOT, { recursive: true }))
  afterEach(() => rmSync(ROOT, { recursive: true, force: true }))

  it('round-trips a request through a running daemon', async () => {
    const socket = freshSocket('rt')
    const server = new DaemonServer({
      socketPath: socket,
      handler: async (req) => ({
        output: JSON.stringify({ echoedAdapter: req.adapter }),
      }),
    })
    await server.start()
    try {
      const resp = await sendToDaemon(
        { adapter: 'claude-code', payload: '{}', cwd: '/p' },
        { socketPath: socket, timeoutMs: 2000 }
      )
      expect(resp).not.toBeNull()
      expect(resp?.output).toBe(JSON.stringify({ echoedAdapter: 'claude-code' }))
    } finally {
      await server.stop()
    }
  })

  it('returns null when no daemon is running at the socket', async () => {
    const socket = freshSocket('nope')
    const resp = await sendToDaemon(
      { adapter: 'claude-code', payload: '{}', cwd: '/p' },
      { socketPath: socket, timeoutMs: 500 }
    )
    expect(resp).toBeNull()
  })

  it('returns null when the handler throws (server responds with error)', async () => {
    const socket = freshSocket('throw')
    const server = new DaemonServer({
      socketPath: socket,
      handler: async () => {
        throw new Error('handler boom')
      },
    })
    await server.start()
    try {
      const resp = await sendToDaemon(
        { adapter: 'claude-code', payload: '{}', cwd: '/p' },
        { socketPath: socket, timeoutMs: 2000 }
      )
      expect(resp).toBeNull()
    } finally {
      await server.stop()
    }
  })

  it('start() removes a stale socket file before binding', async () => {
    const socket = freshSocket('stale')
    // Pretend a previous daemon left a stale socket file.
    const { writeFileSync } = await import('fs')
    writeFileSync(socket, 'stale')

    const server = new DaemonServer({
      socketPath: socket,
      handler: async () => ({ output: '{}' }),
    })
    await server.start()
    try {
      const resp = await sendToDaemon(
        { adapter: 'claude-code', payload: '{}', cwd: '/p' },
        { socketPath: socket, timeoutMs: 2000 }
      )
      expect(resp).not.toBeNull()
    } finally {
      await server.stop()
    }
  })
})
