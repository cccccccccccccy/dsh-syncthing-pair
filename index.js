/**
 * Host half of the Syncthing pair bundle.
 *
 * Registers the local HTTP endpoint used by the sidebar panel and the
 * `syncthing_sync` agent tool. Both call the same `applyPair` operation.
 */

import {
  applyPair,
  overview,
  probe,
  status,
  toError,
} from './server.js'

export const inject = ['webServer', 'tools']

const ROUTE = '/syncthing-pair/api'

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

function readBody(request, limit = 128 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    request.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        settled = true
        request.destroy()
        reject(new Error('Request body is too large.'))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (settled) return
      settled = true
      if (size === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(new Error(`Request body is not valid JSON: ${error.message}`))
      }
    })
    request.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

function expectedOrigin(ctx) {
  try {
    return ctx.webServer.getOrigin()
  } catch {
    return 'http://127.0.0.1:3080'
  }
}

function sameOrigin(origin, expected) {
  if (origin === expected) return true
  try {
    const left = new URL(origin)
    const right = new URL(expected)
    const loopback = new Set(['127.0.0.1', 'localhost', '::1'])
    return left.protocol === right.protocol
      && left.port === right.port
      && loopback.has(left.hostname)
      && loopback.has(right.hostname)
  } catch {
    return false
  }
}

function isTrusted(ctx, request) {
  const origin = request.headers.origin
  if (typeof origin === 'string' && origin !== '') {
    return sameOrigin(origin, expectedOrigin(ctx))
  }
  // A missing Origin is only acceptable from this machine (curl, tests).
  const remote = request.socket?.remoteAddress ?? ''
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
}

async function dispatch(ctx, name, body) {
  if (name === 'probe') return { ok: true, ...(await probe(body.sshHost)) }
  if (name === 'overview') return overview()
  if (name === 'status') {
    if (typeof body.folderId !== 'string' || body.folderId === '') {
      return { ok: false, error: { code: 'invalid-folder-id', message: 'folderId is required.' } }
    }
    return status(body.folderId)
  }
  if (name === 'apply') return applyPair(body)
  return { ok: false, error: { code: 'not-found', message: `Unknown API method "${name}".` } }
}

function registerRoute(ctx) {
  return ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (request, response) => {
      try {
        if (!isTrusted(ctx, request)) {
          sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'Forbidden.' } })
          return
        }
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: { code: 'method', message: 'POST only.' } })
          return
        }
        const url = new URL(request.url ?? '/', 'http://dsh.local')
        const prefix = `${ROUTE}/`
        if (!url.pathname.startsWith(prefix)) {
          sendJson(response, 404, { ok: false, error: { code: 'not-found', message: 'Not found.' } })
          return
        }
        const name = url.pathname.slice(prefix.length)
        if (name === '' || name.includes('/')) {
          sendJson(response, 404, { ok: false, error: { code: 'not-found', message: 'Not found.' } })
          return
        }
        let body
        try {
          body = await readBody(request)
        } catch (error) {
          sendJson(response, 400, { ok: false, error: { code: 'bad-request', message: error.message } })
          return
        }
        const result = await dispatch(ctx, name, body)
        sendJson(response, 200, result)
      } catch (error) {
        ctx.logger?.warn?.('syncthing-pair: request failed: %s', error?.stack ?? error)
        sendJson(response, 200, { ok: false, error: toError(error) })
      }
    },
  })
}

function registerTool(ctx) {
  return ctx.tools.register({
    name: 'syncthing_sync',
    description: 'Create or update a two-way Syncthing folder pair between this Mac and a remote Mac reachable over SSH. Pass the SSH host plus one absolute folder path on each side. Idempotent: an existing pair with the same paths is updated rather than duplicated. If the remote cannot be reached, the local side is still created and shared, and the result carries a command to run on the remote.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sshHost: {
          type: 'string',
          description: 'SSH alias or user@host for the remote Mac, for example remote-mac or me@192.0.2.10.',
        },
        localPath: {
          type: 'string',
          description: 'Absolute folder path on this Mac, for example /Users/me/Documents/Shared.',
        },
        remotePath: {
          type: 'string',
          description: 'Absolute folder path on the remote Mac, for example /Users/me/Documents/Shared.',
        },
        label: {
          type: 'string',
          description: 'Optional Syncthing folder display name. Defaults to the local folder name.',
        },
        createMissing: {
          type: 'boolean',
          description: 'Create missing folders on both machines. Defaults to true.',
        },
      },
      required: ['sshHost', 'localPath', 'remotePath'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      try {
        return await applyPair(args)
      } catch (error) {
        return { ok: false, stage: 'tool', error: toError(error) }
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Syncthing 同步',
      rawInput: args,
    }),
  })
}

export function apply(ctx) {
  ctx.effect(() => registerRoute(ctx), 'syncthing-pair: local API')
  ctx.effect(() => registerTool(ctx), 'syncthing-pair: agent tool')
}
