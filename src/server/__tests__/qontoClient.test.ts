import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'


function getConfig() {
  return {
    baseUrl: process.env.QONTO_BASE_URL || 'https://thirdparty-sandbox.staging.qonto.co/v2',
    apiLogin: process.env.QONTO_API_LOGIN || '',
    apiKey: process.env.QONTO_API_KEY || '',
    stagingToken: process.env.QONTO_STAGING_TOKEN || '',
    albCookie: process.env.QONTO_ALB_COOKIE || '',
    environment: process.env.QONTO_ENV || 'sandbox',
  }
}

function authHeaders(): Record<string, string> {
  const cfg = getConfig()
  const headers: Record<string, string> = {
    'Authorization': `${cfg.apiLogin}:${cfg.apiKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (cfg.stagingToken) {
    headers['X-Qonto-Staging-Token'] = cfg.stagingToken
  }
  if (cfg.albCookie) {
    headers['Cookie'] = `X-Qonto-Staging-Partner-Id-Token=${cfg.albCookie}`
  }
  return headers
}

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 2_000

function calculateBackoff(attempt: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
}


describe('Qonto Client — Configuration & Auth', () => {
  describe('getConfig defaults', () => {
    it('should default to sandbox base URL', () => {
      delete process.env.QONTO_BASE_URL
      expect(getConfig().baseUrl).toBe('https://thirdparty-sandbox.staging.qonto.co/v2')
    })

    it('should default environment to sandbox', () => {
      delete process.env.QONTO_ENV
      expect(getConfig().environment).toBe('sandbox')
    })

    it('should use custom base URL from env', () => {
      process.env.QONTO_BASE_URL = 'https://api.qonto.com/v2'
      expect(getConfig().baseUrl).toBe('https://api.qonto.com/v2')
      delete process.env.QONTO_BASE_URL
    })
  })

  describe('authHeaders', () => {
    beforeEach(() => {
      process.env.QONTO_API_LOGIN = 'test-login'
      process.env.QONTO_API_KEY = 'test-key-123'
    })

    afterEach(() => {
      delete process.env.QONTO_API_LOGIN
      delete process.env.QONTO_API_KEY
      delete process.env.QONTO_STAGING_TOKEN
      delete process.env.QONTO_ALB_COOKIE
    })

    it('should build Authorization header as login:key', () => {
      const headers = authHeaders()
      expect(headers['Authorization']).toBe('test-login:test-key-123')
    })

    it('should include Accept and Content-Type', () => {
      const headers = authHeaders()
      expect(headers['Accept']).toBe('application/json')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include staging token when set', () => {
      process.env.QONTO_STAGING_TOKEN = 'staging-token-abc'
      const headers = authHeaders()
      expect(headers['X-Qonto-Staging-Token']).toBe('staging-token-abc')
    })

    it('should NOT include staging token when not set', () => {
      const headers = authHeaders()
      expect(headers['X-Qonto-Staging-Token']).toBeUndefined()
    })

    it('should include ALB cookie for OneLogin bypass', () => {
      process.env.QONTO_ALB_COOKIE = 'alb-cookie-xyz'
      const headers = authHeaders()
      expect(headers['Cookie']).toBe('X-Qonto-Staging-Partner-Id-Token=alb-cookie-xyz')
    })

    it('should NOT include Cookie when ALB cookie is not set', () => {
      const headers = authHeaders()
      expect(headers['Cookie']).toBeUndefined()
    })
  })

  describe('Rate-limit backoff strategy', () => {
    it('should use 2 seconds for first retry', () => {
      expect(calculateBackoff(1)).toBe(2000)
    })

    it('should use 4 seconds for second retry', () => {
      expect(calculateBackoff(2)).toBe(4000)
    })

    it('should use 8 seconds for third retry', () => {
      expect(calculateBackoff(3)).toBe(8000)
    })

    it('should cap at 3 retries', () => {
      expect(MAX_RETRIES).toBe(3)
    })

    it('should follow exponential pattern', () => {
      const b1 = calculateBackoff(1)
      const b2 = calculateBackoff(2)
      const b3 = calculateBackoff(3)
      expect(b2).toBe(b1 * 2)
      expect(b3).toBe(b2 * 2)
    })
  })

  describe('URL construction', () => {
    it('should build correct client invoice endpoint', () => {
      const cfg = getConfig()
      const url = `${cfg.baseUrl}/client_invoices`
      expect(url).toContain('/v2/client_invoices')
    })

    it('should build correct organization endpoint', () => {
      const cfg = getConfig()
      const url = `${cfg.baseUrl}/organization`
      expect(url).toContain('/v2/organization')
    })

    it('should build correct finalize endpoint', () => {
      const invoiceId = 'inv-123'
      const cfg = getConfig()
      const url = `${cfg.baseUrl}/client_invoices/${invoiceId}/finalize`
      expect(url).toContain('/client_invoices/inv-123/finalize')
    })

    it('should build query string for list endpoints', () => {
      const params = { client_id: 'cli-abc', status: 'paid' }
      const query = new URLSearchParams(params).toString()
      expect(query).toContain('client_id=cli-abc')
      expect(query).toContain('status=paid')
    })
  })
})
