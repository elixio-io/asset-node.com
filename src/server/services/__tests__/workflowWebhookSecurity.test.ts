import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  isExternalUrl,
  isPublicIpAddress,
  resolvePublicWebhookTarget,
  verifyWebhookSignature,
  type WebhookDnsResolver
} from '../workflowWebhookSecurity'

describe('verifyWebhookSignature', () => {
  const secret = 'super-secret-key'
  const body = '{"hardwareId":"abc","event":"created"}'
  const sign = (b: string, s: string) => crypto.createHmac('sha256', s).update(b, 'utf8').digest('hex')

  it('accepts a correct signature with the sha256= prefix', () => {
    expect(verifyWebhookSignature(body, secret, `sha256=${sign(body, secret)}`)).toBe(true)
  })

  it('accepts a correct bare-hex signature (no prefix)', () => {
    expect(verifyWebhookSignature(body, secret, sign(body, secret))).toBe(true)
  })

  it('accepts a header array (uses the first value)', () => {
    expect(verifyWebhookSignature(body, secret, [`sha256=${sign(body, secret)}`])).toBe(true)
  })

  it('rejects a signature computed with the wrong secret', () => {
    expect(verifyWebhookSignature(body, secret, `sha256=${sign(body, 'other-secret')}`)).toBe(false)
  })

  it('rejects when the body was tampered with after signing', () => {
    const sig = `sha256=${sign(body, secret)}`
    expect(verifyWebhookSignature(body + ' ', secret, sig)).toBe(false)
  })

  it('rejects missing, empty, and malformed signatures', () => {
    const sig = sign(body, secret)
    expect(verifyWebhookSignature(body, secret, undefined)).toBe(false)
    expect(verifyWebhookSignature(body, secret, '')).toBe(false)
    expect(verifyWebhookSignature(body, secret, 'sha256=')).toBe(false)
    expect(verifyWebhookSignature(body, secret, 'not-hex')).toBe(false)
    expect(verifyWebhookSignature(body, secret, sig.slice(0, -1))).toBe(false)
  })

  it('rejects when no secret is configured', () => {
    expect(verifyWebhookSignature(body, '', `sha256=${sign(body, secret)}`)).toBe(false)
  })
})

describe('workflow webhook network boundary', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '2606:4700:4700::1111'
  ])('accepts globally routable address %s', address => {
    expect(isPublicIpAddress(address)).toBe(true)
  })

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.0.2.10',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.10',
    '203.0.113.10',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::'
  ])('rejects private or special-purpose address %s', address => {
    expect(isPublicIpAddress(address)).toBe(false)
  })

  it.each([
    'http://hooks.example.com/test',
    'https://localhost/test',
    'https://internal/test',
    'https://user:password@example.com/test',
    'https://127.0.0.1/test',
    'https://[::1]/test'
  ])('rejects unsafe URL syntax %s', url => {
    expect(isExternalUrl(url)).toBe(false)
  })

  it('rejects a hostname if any A or AAAA result is not public', async () => {
    const resolver: WebhookDnsResolver = vi.fn(async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.8', family: 4 }
    ])

    await expect(resolvePublicWebhookTarget('https://hooks.example.com/test', resolver))
      .rejects.toThrow('private or reserved')
  })

  it('returns only the addresses validated during this execution', async () => {
    const resolver: WebhookDnsResolver = vi.fn(async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 }
    ])

    const target = await resolvePublicWebhookTarget('https://hooks.example.com/test', resolver)
    expect(resolver).toHaveBeenCalledWith('hooks.example.com', { all: true, verbatim: true })
    expect(target.addresses).toEqual([
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 }
    ])
  })
})
