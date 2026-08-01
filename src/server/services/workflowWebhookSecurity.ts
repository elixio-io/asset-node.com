import crypto from 'node:crypto'
import { promises as dns } from 'node:dns'
import https from 'node:https'
import net from 'node:net'

// Header carrying the caller's HMAC-SHA256 signature over the raw request body,
// modelled on GitHub's `X-Hub-Signature-256` ("sha256=<hex>"). The bare hex
// digest (no prefix) is also accepted for tolerance.
export const WEBHOOK_SIGNATURE_HEADER = 'x-signature-256'

// Timing-safe verification that `provided` is a valid HMAC-SHA256 of `rawBody`
// under `secret`. Returns false for any missing/malformed input rather than
// throwing, so callers can treat it as a plain boolean gate.
export function verifyWebhookSignature(
  rawBody: string,
  secret: string,
  provided: string | string[] | undefined
): boolean {
  if (!secret || typeof rawBody !== 'string') return false
  const header = Array.isArray(provided) ? provided[0] : provided
  if (!header || typeof header !== 'string') return false

  const supplied = header.startsWith('sha256=') ? header.slice(7) : header
  if (!/^[0-9a-f]{64}$/i.test(supplied)) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const suppliedBuf = Buffer.from(supplied.toLowerCase(), 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (suppliedBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(suppliedBuf, expectedBuf)
}

export interface ResolvedWebhookTarget {
  url: URL
  addresses: Array<{ address: string; family: 4 | 6 }>
}

export interface SecureWebhookResponse {
  status: number
  ok: boolean
  body: string
}

export type WebhookDnsResolver = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<Array<{ address: string; family: number }>>

const FORBIDDEN_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

function ipv4ToNumber(address: string): number | null {
  const parts = address.split('.')
  if (parts.length !== 4) return null

  const octets = parts.map(part => Number(part))
  if (octets.some((part, index) => (
    !/^\d{1,3}$/.test(parts[index]) || !Number.isInteger(part) || part < 0 || part > 255
  ))) return null

  return (
    ((octets[0] << 24) >>> 0) +
    (octets[1] << 16) +
    (octets[2] << 8) +
    octets[3]
  ) >>> 0
}

function isInIpv4Range(value: number, base: string, prefix: number): boolean {
  const baseValue = ipv4ToNumber(base)
  if (baseValue === null) return false
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (value & mask) === (baseValue & mask)
}

function parseIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized.includes('%') || normalized.split('::').length > 2) return null

  const parseGroups = (part: string): string[] | null => {
    if (!part) return []
    const groups = part.split(':')
    const last = groups.at(-1)
    if (last?.includes('.')) {
      const ipv4 = ipv4ToNumber(last)
      if (ipv4 === null) return null
      groups.splice(groups.length - 1, 1, ((ipv4 >>> 16) & 0xffff).toString(16), (ipv4 & 0xffff).toString(16))
    }
    return groups.every(group => /^[0-9a-f]{1,4}$/.test(group)) ? groups : null
  }

  const [leftPart, rightPart = ''] = normalized.split('::')
  const left = parseGroups(leftPart)
  const right = parseGroups(rightPart)
  if (!left || !right) return null

  const hasCompression = normalized.includes('::')
  const missing = 8 - left.length - right.length
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) return null

  const groups = hasCompression
    ? [...left, ...Array(missing).fill('0'), ...right]
    : left
  if (groups.length !== 8) return null

  const bytes: number[] = []
  for (const group of groups) {
    const value = Number.parseInt(group, 16)
    bytes.push(value >>> 8, value & 0xff)
  }
  return bytes
}

function ipv6HasPrefix(bytes: number[], prefixBytes: number[], bits: number): boolean {
  const fullBytes = Math.floor(bits / 8)
  const remainingBits = bits % 8
  for (let index = 0; index < fullBytes; index += 1) {
    if (bytes[index] !== prefixBytes[index]) return false
  }
  if (remainingBits === 0) return true
  const mask = 0xff << (8 - remainingBits)
  return (bytes[fullBytes] & mask) === (prefixBytes[fullBytes] & mask)
}

export function isPublicIpAddress(address: string): boolean {
  const family = net.isIP(address.replace(/^\[|\]$/g, ''))
  if (family === 4) {
    const value = ipv4ToNumber(address)
    if (value === null) return false
    const blockedRanges: Array<[string, number]> = [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.31.196.0', 24],
      ['192.52.193.0', 24],
      ['192.88.99.0', 24],
      ['192.168.0.0', 16],
      ['192.175.48.0', 24],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4]
    ]
    return !blockedRanges.some(([base, prefix]) => isInIpv4Range(value, base, prefix))
  }

  if (family === 6) {
    const bytes = parseIpv6(address)
    if (!bytes) return false

    if ((bytes[0] & 0xe0) !== 0x20) return false
    const blockedRanges: Array<[number[], number]> = [
      [[0x20, 0x01, 0x00, 0x00], 23],
      [[0x20, 0x01, 0x0d, 0xb8], 32],
      [[0x20, 0x02], 16],
      [[0x26, 0x20, 0x00, 0x4f, 0x80, 0x00], 48],
      [[0x3f, 0xff, 0x00], 20]
    ]
    return !blockedRanges.some(([prefix, bits]) => ipv6HasPrefix(bytes, prefix, bits))
  }

  return false
}

export function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!hostname || hostname.includes('%')) return false

    const family = net.isIP(hostname)
    if (family !== 0) return isPublicIpAddress(hostname)

    const canonical = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname
    if (canonical.length > 253 || !canonical.includes('.')) return false
    return canonical.split('.').every(label => (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    ))
  } catch {
    return false
  }
}

export async function resolvePublicWebhookTarget(
  input: string,
  resolver: WebhookDnsResolver = dns.lookup as WebhookDnsResolver,
  timeoutMs = 5_000
): Promise<ResolvedWebhookTarget> {
  if (!isExternalUrl(input)) {
    throw new Error('Webhook URL must use HTTPS and a public, fully-qualified host')
  }

  const url = new URL(input)
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const literalFamily = net.isIP(hostname)
  let dnsTimeout: ReturnType<typeof setTimeout> | undefined
  const resolved = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await Promise.race([
      resolver(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        dnsTimeout = setTimeout(() => reject(new Error('Webhook DNS lookup timed out')), timeoutMs)
      })
    ]).finally(() => {
      if (dnsTimeout) clearTimeout(dnsTimeout)
    })

  if (resolved.length === 0) throw new Error('Webhook hostname did not resolve')

  if (resolved.some(result => result.family !== 4 && result.family !== 6)) {
    throw new Error('Webhook hostname returned an unsupported address family')
  }
  const addresses = resolved.map(result => ({
    address: result.address,
    family: result.family as 4 | 6
  }))
  if (addresses.some(result => net.isIP(result.address) !== result.family || !isPublicIpAddress(result.address))) {
    throw new Error('Webhook hostname resolves to a private or reserved address')
  }

  return { url, addresses }
}

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, string | string[]> {
  const safe: Record<string, string | string[]> = {}
  for (const [name, rawValue] of Object.entries(headers)) {
    const normalizedName = name.trim().toLowerCase()
    if (!normalizedName || FORBIDDEN_REQUEST_HEADERS.has(normalizedName)) continue
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(normalizedName)) continue
    if (Array.isArray(rawValue)) {
      safe[name] = rawValue.map(String).map(value => value.replace(/[\r\n]/g, ''))
    } else if (rawValue !== undefined && rawValue !== null) {
      safe[name] = String(rawValue).replace(/[\r\n]/g, '')
    }
  }
  return safe
}

export async function postSecureWebhook(
  input: string,
  body: string,
  headers: Record<string, unknown> = {},
  timeoutMs = 5_000,
  method = 'POST'
): Promise<SecureWebhookResponse> {
  const target = await resolvePublicWebhookTarget(input, dns.lookup as WebhookDnsResolver, timeoutMs)
  const selected = target.addresses[0]
  const safeHeaders = sanitizeHeaders(headers)
  const requestHostname = target.url.hostname.replace(/^\[|\]$/g, '')
  const httpMethod = String(method).toUpperCase()
  const sendsBody = httpMethod !== 'GET' && httpMethod !== 'HEAD'

  return await new Promise<SecureWebhookResponse>((resolve, reject) => {
    let overallTimeout: ReturnType<typeof setTimeout> | undefined
    const fail = (error: Error) => {
      if (overallTimeout) clearTimeout(overallTimeout)
      reject(error)
    }
    const request = https.request({
      protocol: 'https:',
      hostname: requestHostname,
      servername: net.isIP(requestHostname) === 0 ? requestHostname : '',
      port: target.url.port || 443,
      path: `${target.url.pathname}${target.url.search}`,
      method: httpMethod,
      agent: false,
      headers: {
        ...safeHeaders,
        ...(sendsBody ? { 'Content-Length': Buffer.byteLength(body) } : {})
      },
      lookup: ((_hostname: string, options: unknown, callback: (...args: any[]) => void) => {
        if (typeof options === 'object' && options !== null && 'all' in options && (options as { all?: boolean }).all) {
          callback(null, [selected])
          return
        }
        callback(null, selected.address, selected.family)
      }) as any
    }, response => {
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length
        if (size > 64 * 1024) {
          request.destroy(new Error('Webhook response exceeded 64 KiB'))
          return
        }
        chunks.push(buffer)
      })
      response.on('end', () => {
        const status = response.statusCode || 0
        if (overallTimeout) clearTimeout(overallTimeout)
        resolve({
          status,
          ok: status >= 200 && status < 300,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
      response.on('aborted', () => fail(new Error('Webhook response was aborted')))
      response.on('error', error => fail(error))
    })

    request.setTimeout(timeoutMs, () => request.destroy(new Error('Webhook request timed out')))
    overallTimeout = setTimeout(() => request.destroy(new Error('Webhook request timed out')), timeoutMs)
    request.on('error', error => fail(error))
    request.end(sendsBody ? body : undefined)
  })
}
