import { describe, it, expect } from 'vitest'
import { isExternalUrl } from '../../server/services/workflowEngine'

describe('SSRF Protection — isExternalUrl()', () => {


  describe('Valid external URLs (should ALLOW)', () => {
    it.each([
      ['https://example.com/webhook', 'Standard HTTPS'],
      ['https://hooks.slack.com/services/T123/B456', 'Slack webhook'],
      ['https://discord.com/api/webhooks/123/abc', 'Discord webhook'],
      ['https://api.github.com/repos/test/hooks', 'GitHub API'],
      ['https://1.1.1.1/callback', 'Public IPv4 over HTTPS'],
      ['https://webhook.site/test-uuid', 'Webhook.site'],
      ['https://sub.domain.co.uk/path', 'Subdomain with ccTLD'],
    ])('%s → allowed (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(true)
    })
  })


  describe('Localhost (should BLOCK)', () => {
    it.each([
      ['http://localhost/internal', 'Bare localhost'],
      ['http://localhost:3001/api/admin', 'Localhost with port'],
      ['http://LOCALHOST/test', 'Case variation'],
      ['http://127.0.0.1/secret', 'IPv4 loopback'],
      ['http://127.0.0.1:3001/api', 'IPv4 loopback with port'],
      ['http://127.0.0.255/test', 'IPv4 127.0.0.0/8 range'],
      ['http://0.0.0.0/test', 'Zero address'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IPv6 Loopback [CRITICAL FIX] (should BLOCK)', () => {
    it.each([
      ['http://[::1]/internal', 'Standard short form'],
      ['http://[::1]:3001/api', 'With port'],
      ['http://[0:0:0:0:0:0:0:1]/test', 'Fully expanded'],
      ['http://[0000:0000:0000:0000:0000:0000:0000:0001]/test', 'Zero-padded'],
      ['http://[0000::0001]/test', 'Partial expansion'],
      ['http://[::0001]/test', 'Leading zeros in last group'],
      ['http://[0::1]/test', 'Leading zero group'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IPv6 Unspecified Address (should BLOCK)', () => {
    it.each([
      ['http://[::]/test', 'Short form'],
      ['http://[0:0:0:0:0:0:0:0]/test', 'Fully expanded'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IPv4 Private Ranges (should BLOCK)', () => {
    it.each([
      ['http://10.0.0.1/internal', '10.0.0.0/8'],
      ['http://10.255.255.255/test', '10.x.x.x upper bound'],
      ['http://172.16.0.1/test', '172.16.0.0/12 lower'],
      ['http://172.31.255.255/test', '172.16.0.0/12 upper'],
      ['http://192.168.1.1/test', '192.168.0.0/16'],
      ['http://192.168.0.100:8080/webhook', '192.168 with port'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('Link-Local (should BLOCK)', () => {
    it.each([
      ['http://169.254.1.1/test', 'IPv4 link-local'],
      ['http://169.254.169.254/latest/meta-data/', 'AWS metadata'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('Cloud Metadata Endpoints (should BLOCK)', () => {
    it.each([
      ['http://169.254.169.254/latest/meta-data/', 'AWS IMDSv1'],
      ['http://metadata.google.internal/computeMetadata/', 'GCP metadata'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IPv4-mapped IPv6 (should BLOCK)', () => {
    it.each([
      ['http://[::ffff:127.0.0.1]/test', 'Loopback mapped'],
      ['http://[::ffff:10.0.0.1]/test', 'RFC1918 10.x mapped'],
      ['http://[::ffff:192.168.1.1]/test', 'RFC1918 192.168 mapped'],
      ['http://[::ffff:172.16.0.1]/test', 'RFC1918 172.16 mapped'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IPv6 Private Ranges (should BLOCK)', () => {
    it.each([
      ['http://[fc00::1]/test', 'ULA fc00::/7'],
      ['http://[fd00::1]/test', 'ULA fd00::/8'],
      ['http://[fe80::1]/test', 'Link-local fe80::/10'],
      ['http://[fe80::1%25eth0]/test', 'Link-local with zone ID'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('IP Obfuscation (should BLOCK)', () => {
    it.each([
      ['http://2130706433/test', 'Decimal 127.0.0.1'],
      ['http://0x7f000001/test', 'Hex 127.0.0.1'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('Protocol Enforcement (should BLOCK)', () => {
    it.each([
      ['http://example.com/webhook', 'Plain HTTP'],
      ['ftp://example.com/file', 'FTP'],
      ['file:///etc/passwd', 'File URI'],
      ['gopher://evil.com/test', 'Gopher'],
      ['javascript:alert(1)', 'JavaScript URI'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })

  describe('Malformed URLs (should BLOCK)', () => {
    it.each([
      ['not-a-url', 'Plain string'],
      ['', 'Empty string'],
      ['://missing-protocol', 'No protocol'],
    ])('%s → blocked (%s)', (url) => {
      expect(isExternalUrl(url)).toBe(false)
    })
  })
})
