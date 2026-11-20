/**
 * Syncthing pair helper (Host side).
 *
 * One operation is shared by the Web panel and the `syncthing_sync` agent
 * tool: probe both Macs, preflight both Syncthing configurations, create or
 * update the folder pair locally and (when SSH works) on the remote, and return
 * a copy-paste command for the remote when it cannot be reached.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const SCRIPT_PATH = fileURLToPath(new URL('./syncthing_pair.py', import.meta.url))
const SSH_OPTIONS = [
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=5',
  '-o', 'ServerAliveInterval=5',
  '-o', 'ServerAliveCountMax=2',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'LogLevel=ERROR',
]
const OUTPUT_LIMIT = 2 * 1024 * 1024

let scriptCache

export class PairError extends Error {
  constructor(code, message, detail = '') {
    super(message)
    this.name = 'PairError'
    this.code = code
    this.detail = detail
  }
}

export function toError(error) {
  if (error instanceof PairError) {
    return { code: error.code, message: error.message, detail: error.detail }
  }
  return {
    code: 'internal',
    message: error instanceof Error ? error.message : String(error),
    detail: error instanceof Error ? (error.stack ?? '') : '',
  }
}

function encode(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

function scriptText() {
  if (scriptCache === undefined) scriptCache = readFile(SCRIPT_PATH, 'utf8')
  return scriptCache
}

function runProcess(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 30000
    let child
    try {
      child = spawn(file, args, {
        stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        env: process.env,
      })
    } catch (error) {
      reject(new PairError('spawn-failed', `Cannot start ${file}.`, String(error)))
      return
    }
    const stdout = []
    const stderr = []
    let settled = false
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(value)
    }
    child.stdout.on('data', (chunk) => {
      if (stdout.length < OUTPUT_LIMIT) stdout.push(chunk)
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < OUTPUT_LIMIT) stderr.push(chunk)
    })
    child.on('error', (error) => {
      finish(reject, new PairError('spawn-failed', `Cannot start ${file}.`, error.message))
    })
    child.on('close', (code) => {
      const result = {
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }
      if (timedOut) {
        finish(
          reject,
          new PairError(
            'timeout',
            `${file} did not finish within ${Math.round(timeoutMs / 1000)}s.`,
            result.stderr.slice(-1200),
          ),
        )
        return
      }
      finish(resolve, result)
    })
    if (options.input !== undefined && child.stdin !== null) {
      child.stdin.on('error', () => {})
      child.stdin.end(options.input)
    }
  })
}

function parseEnvelope(result, context) {
  const line = result.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith('STPAIR:'))
  if (line === undefined) {
    throw new PairError(
      'no-result',
      `${context} did not return a Syncthing helper result.`,
      (result.stderr || result.stdout).slice(-1600),
    )
  }
  try {
    return JSON.parse(line.slice('STPAIR:'.length))
  } catch (error) {
    throw new PairError('bad-result', `${context} returned an unreadable result.`, String(error))
  }
}

async function runLocal(payload) {
  const result = await runProcess('python3', [SCRIPT_PATH, '--payload', encode(payload)], {
    timeoutMs: 30000,
  })
  return parseEnvelope(result, 'The local helper')
}

async function runRemoteOn(host, payload) {
  const script = await scriptText()
  const result = await runProcess(
    'ssh',
    [...SSH_OPTIONS, host, 'python3', '-', '--payload', encode(payload)],
    { input: script, timeoutMs: 45000 },
  )
  if (!result.stdout.includes('STPAIR:') && result.code !== 0) {
    throw new PairError(
      'ssh-failed',
      `SSH to ${host} exited with code ${result.code} before returning a result.`,
      (result.stderr || result.stdout).slice(-1600),
    )
  }
  return parseEnvelope(result, `${host}`)
}

async function runRemote(payload, sshHost) {
  const host = typeof sshHost === 'string' ? sshHost.trim() : ''
  if (host === '') {
    return {
      reachable: false,
      error: new PairError('no-host', 'Enter the remote SSH host first.'),
    }
  }
  try {
    const envelope = await runRemoteOn(host, payload)
    return { reachable: true, host, envelope }
  } catch (error) {
    return {
      reachable: false,
      error: new PairError(
        'offline',
        `Cannot reach ${host} over SSH.`,
        error instanceof PairError ? error.detail : String(error),
      ),
    }
  }
}

async function probeLocal() {
  try {
    const envelope = await runLocal({ action: 'probe' })
    if (!envelope.ok) return { ok: false, error: envelope.error }
    return { ok: true, data: envelope.data }
  } catch (error) {
    return { ok: false, error: toError(error) }
  }
}

async function probeRemote(sshHost) {
  const remote = await runRemote({ action: 'probe' }, sshHost)
  if (!remote.reachable) return { ok: false, reachable: false, error: toError(remote.error) }
  if (!remote.envelope.ok) {
    return { ok: false, reachable: true, host: remote.host, error: remote.envelope.error }
  }
  return { ok: true, reachable: true, host: remote.host, data: remote.envelope.data }
}

function absolutePath(value, field) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') throw new PairError('invalid-path', `${field} is empty.`)
  if (!text.startsWith('/')) throw new PairError('invalid-path', `${field} must be an absolute path.`, text)
  if (text.includes('\0')) throw new PairError('invalid-path', `${field} contains a NUL byte.`, text)
  if (text.length > 900) throw new PairError('invalid-path', `${field} is too long.`, text)
  return text
}

function cleanLabel(value, fallback) {
  const text = typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80)
    : ''
  return text || fallback
}

function slug(value) {
  const text = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return text || 'folder'
}

function folderIdFor(localPath, remotePath) {
  const hash = createHash('sha256')
    .update(`${localPath}\0${remotePath}`)
    .digest('hex')
    .slice(0, 6)
  return `st-${slug(basename(localPath))}-${hash}`
}

function normalizeAbsolute(text) {
  const normalized = posix.normalize(text)
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

function samePath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  return posix.normalize(left).replace(/\/+$/, '') === posix.normalize(right).replace(/\/+$/, '')
}

function checkSide(name, data, folderId, target) {
  const folders = Array.isArray(data?.folders) ? data.folders : []
  const existing = folders.find((folder) => folder.id === folderId)
  if (existing !== undefined && !samePath(existing.path, target)) {
    throw new PairError(
      'folder-conflict',
      `${name} already has folder "${folderId}" pointing at a different path.`,
      `${existing.path} (expected ${target})`,
    )
  }
  const conflict = folders.find((folder) => folder.id !== folderId && samePath(folder.path, target))
  if (conflict !== undefined) {
    throw new PairError(
      'path-in-use',
      `${name} already syncs that path under another folder.`,
      `${conflict.path} (${conflict.id})`,
    )
  }
}

function pickPeer(airData) {
  const devices = Array.isArray(airData?.devices) ? airData.devices : []
  const others = devices.filter((device) => device.id !== airData.myID)
  const named = others.find((device) => /remote/i.test(device.name ?? ''))
  if (named !== undefined) return named.id
  const usable = others.filter((device) => device.paused !== true)
  if (usable.length === 1) return usable[0].id
  return undefined
}

async function remoteCommand(params) {
  const script = await scriptText()
  const payload = encode({ action: 'apply', params })
  const compressed = deflateSync(Buffer.from(script, 'utf8')).toString('base64')
  return `python3 -c "import base64,sys,zlib;sys.argv=['-','--payload','${payload}'];exec(zlib.decompress(base64.b64decode('${compressed}')))"`
}

export async function probe(sshHost) {
  const [local, remote] = await Promise.all([probeLocal(), probeRemote(sshHost)])
  return { local, remote }
}

export async function overview() {
  try {
    const envelope = await runLocal({ action: 'overview' })
    if (!envelope.ok) return { ok: false, error: envelope.error }
    return { ok: true, data: envelope.data }
  } catch (error) {
    return { ok: false, error: toError(error) }
  }
}

export async function status(folderId) {
  try {
    const envelope = await runLocal({ action: 'status', params: { folderId } })
    if (!envelope.ok) return { ok: false, error: envelope.error }
    return { ok: true, data: envelope.data }
  } catch (error) {
    return { ok: false, error: toError(error) }
  }
}

export async function applyPair(input = {}) {
  const localPath = normalizeAbsolute(absolutePath(input.localPath, 'The local folder'))
  const remotePath = normalizeAbsolute(absolutePath(input.remotePath, 'The remote folder'))
  const sshHost = typeof input.sshHost === 'string' ? input.sshHost.trim() : ''
  const label = cleanLabel(input.label, basename(localPath) || 'Syncthing folder')
  const folderId = folderIdFor(localPath, remotePath)
  const createMissing = input.createMissing !== false

  if (sshHost === '') {
    const error = { code: 'no-host', message: 'Enter the remote SSH host first.' }
    return {
      ok: false,
      stage: 'preflight',
      folderId,
      label,
      localPath,
      remotePath,
      local: { ok: false, skipped: true, error },
      remote: { ok: false, reachable: false, error },
      error,
    }
  }

  const local = await probeLocal()
  if (!local.ok) {
    return {
      ok: false,
      stage: 'local',
      folderId,
      label,
      localPath,
      remotePath,
      local: { ok: false, error: local.error },
      remote: { ok: false, reachable: false, skipped: true },
      error: local.error,
    }
  }

  const remote = await probeRemote(sshHost)
  const peerId = remote.ok ? remote.data.myID : pickPeer(local.data)
  if (peerId === undefined || peerId === '') {
    const error = {
      code: 'no-peer',
      message: 'The remote device is not in this Mac\'s Syncthing, and the remote is unreachable.',
      detail: 'Connect the remote over SSH once so its device id can be read.',
    }
    return { ok: false, stage: 'preflight', folderId, label, localPath, remotePath, local: { ok: true, data: local.data }, remote, error }
  }
  if (peerId === local.data.myID) {
    const error = {
      code: 'no-peer',
      message: 'The remote device id resolves to this Mac itself.',
      detail: peerId,
    }
    return { ok: false, stage: 'preflight', folderId, label, localPath, remotePath, local: { ok: true, data: local.data }, remote, error }
  }

  try {
    checkSide('This Mac', local.data, folderId, localPath)
    if (remote.ok) checkSide('The remote', remote.data, folderId, remotePath)
  } catch (error) {
    return { ok: false, stage: 'preflight', folderId, label, localPath, remotePath, local: { ok: true, data: local.data }, remote, error: toError(error) }
  }

  const localPayload = {
    action: 'apply',
    params: {
      path: localPath,
      folderId,
      label,
      peerId,
      peerName: remote.ok ? (remote.data.hostname || 'remote') : 'remote',
      selfId: local.data.myID,
      createMissing,
    },
  }
  let localEnvelope
  try {
    localEnvelope = await runLocal(localPayload)
  } catch (error) {
    return { ok: false, stage: 'local', folderId, label, localPath, remotePath, local: { ok: false, error: toError(error) }, remote, error: toError(error) }
  }
  if (!localEnvelope.ok) {
    return { ok: false, stage: 'local', folderId, label, localPath, remotePath, local: { ok: false, error: localEnvelope.error }, remote, error: localEnvelope.error }
  }

  let remoteResult = null
  let remoteError = null
  if (remote.ok) {
    try {
      const envelope = await runRemoteOn(remote.host, {
        action: 'apply',
        params: {
          path: remotePath,
          folderId,
          label,
          peerId: local.data.myID,
          peerName: local.data.hostname || 'this Mac',
          selfId: peerId,
          createMissing,
        },
      })
      if (envelope.ok) remoteResult = envelope.data
      else remoteError = envelope.error
    } catch (error) {
      remoteError = toError(error)
    }
  }

  const remoteView = remote.ok
    ? {
        ok: remoteResult !== null,
        reachable: true,
        host: remote.host,
        data: remoteResult ?? undefined,
        error: remoteError ?? undefined,
      }
    : {
        ok: false,
        reachable: remote.reachable === true,
        error: remote.error,
      }

  const transportFailure = remoteError !== null
    && ['ssh-failed', 'timeout', 'offline', 'no-result'].includes(remoteError.code)
  let command
  if (!remoteView.ok && (remoteView.reachable !== true || transportFailure)) {
    try {
      command = await remoteCommand({
        path: remotePath,
        folderId,
        label,
        peerId: local.data.myID,
        peerName: local.data.hostname || 'this Mac',
        selfId: peerId,
        createMissing,
      })
    } catch {
      command = undefined
    }
  }

  const ok = remoteView.ok === true
  return {
    ok,
    stage: ok ? 'done' : 'remote',
    partial: ok ? false : true,
    folderId,
    label,
    localPath,
    remotePath,
    local: { ok: true, data: localEnvelope.data },
    remote: remoteView,
    command,
    warnings: [
      ...(localEnvelope.data?.warnings ?? []),
      ...(remoteResult?.warnings ?? []),
    ],
  }
}
