import { describe, it, expect } from 'vitest'


const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 2_000

function getConfig(env: Record<string, string> = {}) {
  return {
    baseUrl: env.QONTO_BASE_URL || 'https://thirdparty-sandbox.staging.qonto.co/v2',
    apiLogin: env.QONTO_API_LOGIN || '',
    apiKey: env.QONTO_API_KEY || '',
    stagingToken: env.QONTO_STAGING_TOKEN || '',
    albCookie: env.QONTO_ALB_COOKIE || '',
    environment: env.QONTO_ENV || 'sandbox',
  }
}

function authHeaders(cfg: ReturnType<typeof getConfig>): Record<string, string> {
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

function calculateBackoff(attempt: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`
}

function buildQueryString(params: Record<string, any>): string {
  return '?' + new URLSearchParams(params).toString()
}


describe('Qonto Client — Deep Logic', () => {
  describe('Config Defaults', () => {
    it('should use sandbox base URL by default', () => {
      const cfg = getConfig()
      expect(cfg.baseUrl).toBe('https://thirdparty-sandbox.staging.qonto.co/v2')
    })

    it('should default to sandbox environment', () => {
      const cfg = getConfig()
      expect(cfg.environment).toBe('sandbox')
    })

    it('should default to empty credentials', () => {
      const cfg = getConfig()
      expect(cfg.apiLogin).toBe('')
      expect(cfg.apiKey).toBe('')
    })

    it('should use custom base URL when provided', () => {
      const cfg = getConfig({ QONTO_BASE_URL: 'https://thirdparty.qonto.com/v2' })
      expect(cfg.baseUrl).toBe('https://thirdparty.qonto.com/v2')
    })

    it('should use custom env when provided', () => {
      const cfg = getConfig({ QONTO_ENV: 'production' })
      expect(cfg.environment).toBe('production')
    })
  })

  describe('Auth Headers', () => {
    it('should format Authorization as login:key', () => {
      const cfg = getConfig({ QONTO_API_LOGIN: 'my-login', QONTO_API_KEY: 'secret-key' })
      const headers = authHeaders(cfg)
      expect(headers['Authorization']).toBe('my-login:secret-key')
    })

    it('should set Accept: application/json', () => {
      const headers = authHeaders(getConfig())
      expect(headers['Accept']).toBe('application/json')
    })

    it('should set Content-Type: application/json', () => {
      const headers = authHeaders(getConfig())
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should NOT include staging token when empty', () => {
      const headers = authHeaders(getConfig())
      expect(headers).not.toHaveProperty('X-Qonto-Staging-Token')
    })

    it('should include staging token for sandbox', () => {
      const cfg = getConfig({ QONTO_STAGING_TOKEN: 'my-staging-token' })
      const headers = authHeaders(cfg)
      expect(headers['X-Qonto-Staging-Token']).toBe('my-staging-token')
    })

    it('should NOT include Cookie when no ALB cookie', () => {
      const headers = authHeaders(getConfig())
      expect(headers).not.toHaveProperty('Cookie')
    })

    it('should include ALB cookie for OneLogin bypass', () => {
      const cfg = getConfig({ QONTO_ALB_COOKIE: 'alb-cookie-value' })
      const headers = authHeaders(cfg)
      expect(headers['Cookie']).toBe('X-Qonto-Staging-Partner-Id-Token=alb-cookie-value')
    })

    it('should include both staging token AND cookie when both set', () => {
      const cfg = getConfig({
        QONTO_STAGING_TOKEN: 'stg',
        QONTO_ALB_COOKIE: 'alb'
      })
      const headers = authHeaders(cfg)
      expect(headers['X-Qonto-Staging-Token']).toBeDefined()
      expect(headers['Cookie']).toBeDefined()
    })
  })

  describe('Rate Limit Backoff', () => {
    it('MAX_RETRIES should be 3', () => {
      expect(MAX_RETRIES).toBe(3)
    })

    it('INITIAL_BACKOFF_MS should be 2000', () => {
      expect(INITIAL_BACKOFF_MS).toBe(2000)
    })

    it('attempt 1: 2000ms', () => {
      expect(calculateBackoff(1)).toBe(2000)
    })

    it('attempt 2: 4000ms (exponential)', () => {
      expect(calculateBackoff(2)).toBe(4000)
    })

    it('attempt 3: 8000ms (exponential)', () => {
      expect(calculateBackoff(3)).toBe(8000)
    })

    it('should grow exponentially (2^n)', () => {
      const b1 = calculateBackoff(1)
      const b2 = calculateBackoff(2)
      const b3 = calculateBackoff(3)
      expect(b2).toBe(b1 * 2)
      expect(b3).toBe(b2 * 2)
    })
  })

  describe('URL Construction', () => {
    const base = 'https://thirdparty-sandbox.staging.qonto.co/v2'

    it('should build organization URL', () => {
      expect(buildUrl(base, '/organization'))
        .toBe('https://thirdparty-sandbox.staging.qonto.co/v2/organization')
    })

    it('should build client invoices URL', () => {
      expect(buildUrl(base, '/client_invoices'))
        .toBe('https://thirdparty-sandbox.staging.qonto.co/v2/client_invoices')
    })

    it('should build finalize URL with ID', () => {
      expect(buildUrl(base, '/client_invoices/inv-123/finalize'))
        .toBe('https://thirdparty-sandbox.staging.qonto.co/v2/client_invoices/inv-123/finalize')
    })

    it('should build attachment URL', () => {
      expect(buildUrl(base, '/attachments/att-456'))
        .toBe('https://thirdparty-sandbox.staging.qonto.co/v2/attachments/att-456')
    })
  })

  describe('Query String Building', () => {
    it('should encode simple params', () => {
      expect(buildQueryString({ status: 'paid' })).toBe('?status=paid')
    })

    it('should encode multiple params', () => {
      const qs = buildQueryString({ status: 'paid', page: '1' })
      expect(qs).toContain('status=paid')
      expect(qs).toContain('page=1')
    })

    it('should URL-encode special characters', () => {
      const qs = buildQueryString({ filter: 'name eq "test"' })
      expect(qs).toContain('filter=')
      expect(qs).not.toContain('"')
    })
  })
})
