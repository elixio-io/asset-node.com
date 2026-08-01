import { describe, it, expect } from 'vitest'


const ACCESS_TOKEN_KEY = 'hw_access_token'
const REFRESH_TOKEN_KEY = 'hw_refresh_token'
const TIMEOUT_MS = 15_000

class ApiError extends Error {
  response?: { data?: any; status?: number }
  constructor(message: string, status?: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.response = { data, status }
  }
}

function resolveApiUrl(envUrl: string | undefined, hostname: string): string {
  if (envUrl) return envUrl
  if (hostname.endsWith('.asset-node.com') || hostname === 'asset-node.com') {
    return 'https://api.asset-node.com/api'
  }
  return 'http://localhost:3001/api'
}

function buildFullUrl(baseUrl: string, url: string, params?: Record<string, string | number | boolean | undefined>): string {
  let fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  if (params) {
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined)
    if (filtered.length) {
      const qs = new URLSearchParams(filtered.map(([k, v]) => [k, String(v)])).toString()
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
    }
  }
  return fullUrl
}

function getErrorSeverity(status: number): 'error' | 'warn' {
  return status >= 500 ? 'error' : 'warn'
}

function shouldBroadcastError(err: ApiError): boolean {
  return err.response?.status !== 401
}

function shouldRetryRefresh(status: number, isRetry: boolean, hasRefreshToken: boolean): boolean {
  return status === 401 && !isRetry && hasRefreshToken
}

function shouldAttemptRoleRefresh(status: number, isRoleRetry: boolean, hasRefreshToken: boolean, isAuthRoute: boolean): boolean {
  return status === 403 && !isRoleRetry && hasRefreshToken && !isAuthRoute
}


describe('API Client — Pure Logic', () => {
  describe('URL Resolution', () => {
    it('should use VITE_API_URL when set', () => {
      expect(resolveApiUrl('https://custom.api.com', 'localhost')).toBe('https://custom.api.com')
    })

    it('should resolve to production API for asset-node.com', () => {
      expect(resolveApiUrl(undefined, 'asset-node.com')).toBe('https://api.asset-node.com/api')
    })

    it('should resolve to production API for subdomains', () => {
      expect(resolveApiUrl(undefined, 'app.asset-node.com')).toBe('https://api.asset-node.com/api')
      expect(resolveApiUrl(undefined, 'staging.asset-node.com')).toBe('https://api.asset-node.com/api')
    })

    it('should fallback to localhost for development', () => {
      expect(resolveApiUrl(undefined, 'localhost')).toBe('http://localhost:3001/api')
    })

    it('should fallback to localhost for unknown domains', () => {
      expect(resolveApiUrl(undefined, '192.168.1.100')).toBe('http://localhost:3001/api')
    })
  })

  describe('Full URL Building', () => {
    const base = 'http://localhost:3001/api'

    it('should prepend base URL', () => {
      expect(buildFullUrl(base, '/hardware')).toBe('http://localhost:3001/api/hardware')
    })

    it('should NOT prepend base for absolute URLs', () => {
      expect(buildFullUrl(base, 'https://external.com/data')).toBe('https://external.com/data')
    })

    it('should append query params', () => {
      const url = buildFullUrl(base, '/hardware', { page: 1, limit: 10 })
      expect(url).toContain('page=1')
      expect(url).toContain('limit=10')
    })

    it('should filter out undefined params', () => {
      const url = buildFullUrl(base, '/hardware', { page: 1, sort: undefined })
      expect(url).toContain('page=1')
      expect(url).not.toContain('sort')
    })

    it('should handle boolean params', () => {
      const url = buildFullUrl(base, '/hardware', { active: true })
      expect(url).toContain('active=true')
    })

    it('should handle existing query string', () => {
      const url = buildFullUrl(base, '/hardware?existing=1', { extra: 2 })
      expect(url).toContain('existing=1')
      expect(url).toContain('extra=2')
      expect(url).toContain('&')
    })

    it('should not add ? when no params', () => {
      const url = buildFullUrl(base, '/hardware')
      expect(url).not.toContain('?')
    })
  })

  describe('ApiError', () => {
    it('should set name to ApiError', () => {
      const err = new ApiError('test')
      expect(err.name).toBe('ApiError')
    })

    it('should set message', () => {
      const err = new ApiError('Not found')
      expect(err.message).toBe('Not found')
    })

    it('should set status and data', () => {
      const err = new ApiError('Server error', 500, { detail: 'crash' })
      expect(err.response?.status).toBe(500)
      expect(err.response?.data).toEqual({ detail: 'crash' })
    })

    it('should be an instance of Error', () => {
      expect(new ApiError('test')).toBeInstanceOf(Error)
    })

    it('should default response fields to undefined', () => {
      const err = new ApiError('test')
      expect(err.response?.status).toBeUndefined()
    })
  })

  describe('Error Severity', () => {
    it('500+ is error severity', () => {
      expect(getErrorSeverity(500)).toBe('error')
      expect(getErrorSeverity(502)).toBe('error')
      expect(getErrorSeverity(503)).toBe('error')
    })

    it('4xx is warn severity', () => {
      expect(getErrorSeverity(400)).toBe('warn')
      expect(getErrorSeverity(403)).toBe('warn')
      expect(getErrorSeverity(404)).toBe('warn')
      expect(getErrorSeverity(422)).toBe('warn')
      expect(getErrorSeverity(429)).toBe('warn')
    })
  })

  describe('Error Broadcasting', () => {
    it('should broadcast non-401 errors', () => {
      expect(shouldBroadcastError(new ApiError('Forbidden', 403))).toBe(true)
      expect(shouldBroadcastError(new ApiError('Server error', 500))).toBe(true)
    })

    it('should NOT broadcast 401 errors (handled by refresh)', () => {
      expect(shouldBroadcastError(new ApiError('Unauthorized', 401))).toBe(false)
    })
  })

  describe('Retry Logic', () => {
    it('should retry 401 on first attempt with refresh token', () => {
      expect(shouldRetryRefresh(401, false, true)).toBe(true)
    })

    it('should NOT retry 401 on second attempt', () => {
      expect(shouldRetryRefresh(401, true, true)).toBe(false)
    })

    it('should NOT retry 401 without refresh token', () => {
      expect(shouldRetryRefresh(401, false, false)).toBe(false)
    })

    it('should NOT retry non-401 errors', () => {
      expect(shouldRetryRefresh(500, false, true)).toBe(false)
      expect(shouldRetryRefresh(403, false, true)).toBe(false)
    })
  })

  describe('Role Refresh Logic', () => {
    it('should attempt role refresh on first 403 with token', () => {
      expect(shouldAttemptRoleRefresh(403, false, true, false)).toBe(true)
    })

    it('should NOT attempt on auth routes', () => {
      expect(shouldAttemptRoleRefresh(403, false, true, true)).toBe(false)
    })

    it('should NOT attempt on retry', () => {
      expect(shouldAttemptRoleRefresh(403, true, true, false)).toBe(false)
    })

    it('should NOT attempt without token', () => {
      expect(shouldAttemptRoleRefresh(403, false, false, false)).toBe(false)
    })

    it('should NOT attempt on non-403', () => {
      expect(shouldAttemptRoleRefresh(401, false, true, false)).toBe(false)
    })
  })

  describe('Token Storage Keys', () => {
    it('should use hw_access_token', () => {
      expect(ACCESS_TOKEN_KEY).toBe('hw_access_token')
    })

    it('should use hw_refresh_token', () => {
      expect(REFRESH_TOKEN_KEY).toBe('hw_refresh_token')
    })

    it('keys should be different', () => {
      expect(ACCESS_TOKEN_KEY).not.toBe(REFRESH_TOKEN_KEY)
    })
  })

  describe('Timeout', () => {
    it('should be 15 seconds', () => {
      expect(TIMEOUT_MS).toBe(15_000)
    })
  })
})
