import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'

import { apply } from '../index.js'

/** Capture the one route and one tool the host half registers. */
function harness(rejection) {
  const state = { route: undefined, tool: undefined, checked: [] }
  const ctx = {
    webServer: {
      register(route) {
        state.route = route
        return () => {}
      },
    },
    tools: {
      register(tool) {
        state.tool = tool
        return () => {}
      },
    },
    connection: {
      requestRejection(request) {
        state.checked.push(request)
        return rejection
      },
    },
    effect(run) {
      const dispose = run()
      return typeof dispose === 'function' ? dispose : () => {}
    },
  }
  apply(ctx)
  assert.equal(typeof state.route?.handler, 'function', 'route is registered')
  assert.equal(state.tool?.name, 'syncthing_sync', 'agent tool is registered')
  return state
}

/** Minimal ServerResponse stand-in: capture the status, headers, and body. */
function response() {
  return {
    statusCode: undefined,
    headers: undefined,
    body: undefined,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode
      this.headers = headers
    },
    end(chunk) {
      this.body = chunk
    },
  }
}

/** Node HTTP request stand-in with a JSON body. */
function request({ method = 'POST', url = '/syncthing-pair/api/overview', body } = {}) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  stream.method = method
  stream.url = url
  stream.headers = { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }
  return stream
}

function payload(res) {
  return JSON.parse(res.body)
}

test('a request DSH rejects never reaches the route body', async () => {
  const state = harness(401)
  const req = request({ method: 'GET' })
  const res = response()
  await state.route.handler(req, res)

  assert.equal(res.statusCode, 401)
  assert.equal(payload(res).error.code, 'unauthorized')
  assert.equal(state.checked.length, 1)
  assert.equal(state.checked[0], req, 'the same request object is checked')
})

test('a cross-host request is refused with 403 before dispatch', async () => {
  const state = harness(403)
  const res = response()
  await state.route.handler(request({ body: {} }), res)

  assert.equal(res.statusCode, 403)
  assert.equal(payload(res).error.code, 'forbidden')
})

test('an authenticated POST reaches dispatch', async () => {
  const state = harness(undefined)
  const res = response()
  await state.route.handler(request({ url: '/syncthing-pair/api/nope', body: {} }), res)

  assert.equal(res.statusCode, 200)
  assert.equal(payload(res).error.code, 'not-found')
})

test('an authenticated non-POST is rejected with 405', async () => {
  const state = harness(undefined)
  const res = response()
  await state.route.handler(request({ method: 'GET' }), res)

  assert.equal(res.statusCode, 405)
  assert.equal(payload(res).error.code, 'method')
})
