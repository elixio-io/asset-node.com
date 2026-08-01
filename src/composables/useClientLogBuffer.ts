
export type LogKind = 'error' | 'warn' | 'api' | 'route' | 'info'

export interface LogEntry {
  t: string
  kind: LogKind
  message: string
  data?: Record<string, string | number>
}

const BUFFER_CAPACITY = 50
const MESSAGE_CAP = 500
const EXPORT_SIZE_CAP = 10_000

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi
const SECRET_ASSIGNMENT_PATTERN = /((?:access[_-]?token|refresh[_-]?token|token|authorization|password|secret|api[_-]?key|code|state)\s*[:=]\s*)[^\s&,'"}<>]+/gi
const URL_WITH_PRIVATE_SUFFIX_PATTERN = /(?:https?:\/\/|\/)[^\s'"<>]*[?#][^\s'"<>]*/gi

function scrub(s: string): string {
  return s
    .replace(JWT_PATTERN, '[JWT]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1[REDACTED]')
    .replace(URL_WITH_PRIVATE_SUFFIX_PATTERN, value => value.split(/[?#]/, 1)[0])
    .slice(0, MESSAGE_CAP)
}


const entries: LogEntry[] = []
let installed = false

export function pushLog(kind: LogKind, message: string, data?: Record<string, string | number>): void {
  entries.push({
    t: new Date().toISOString(),
    kind,
    message: scrub(message || ''),
    data: data && Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, typeof value === 'string' ? scrub(value) : value])
    ),
  })
  if (entries.length > BUFFER_CAPACITY) {
    entries.splice(0, entries.length - BUFFER_CAPACITY)
  }
}

export function snapshotLog(): string {
  const newestFirst = [...entries].reverse()
  const kept: LogEntry[] = []
  let size = 2
  for (const e of newestFirst) {
    const encoded = JSON.stringify(e)
    if (size + encoded.length + 1 > EXPORT_SIZE_CAP) break
    kept.unshift(e)
    size += encoded.length + 1
  }
  return JSON.stringify(kept)
}

export function clearLog(): void {
  entries.length = 0
}


export function installClientLogCapture(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event: ErrorEvent) => {
    pushLog('error', event.message || 'window.onerror', {
      file: String(event.filename || '').slice(0, 200),
      line: event.lineno ?? 0,
      col: event.colno ?? 0,
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const r = event.reason as { message?: string; name?: string } | string | undefined
    const msg = typeof r === 'string'
      ? r
      : (r?.message || r?.name || 'unhandledrejection')
    pushLog('error', `unhandledrejection: ${msg}`)
  })

  pushLog('info', 'log capture installed')
}
