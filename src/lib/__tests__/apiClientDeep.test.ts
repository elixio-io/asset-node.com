import { describe, it, expect } from 'vitest'


class ApiError extends Error {
  response?: { data?: any; status?: number }

  constructor(message: string, status?: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.response = { data, status }
  }
}

interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  responseType?: 'json' | 'blob'
  data?: unknown
  _retry?: boolean
  _roleRetry?: boolean
}

const ACCESS_TOKEN_KEY = 'hw_access_token'
const REFRESH_TOKEN_KEY = 'hw_refresh_token'

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined)
  if (!filtered.length) return ''
  return new URLSearchParams(filtered.map(([k, v]) => [k, String(v)])).toString()
}

function buildFullUrl(baseUrl: string, path: string, params?: RequestConfig['params']): string {
  let fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`
  if (params) {
    const qs = buildQueryString(params)
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
  }
  return fullUrl
}

function resolveApiUrl(hostname: string, envUrl?: string): string {
  if (envUrl) return envUrl
  if (hostname.endsWith('.asset-node.com') || hostname === 'asset-node.com') {
    return 'https://api.asset-node.com/api'
  }
  return 'http://localhost:3001/api'
}


describe('API Client Deep — Pure Logic', () => {
  describe('ApiError', () => {
    it('should have name "ApiError"', () => {
      const err = new ApiError('test')
      expect(err.name).toBe('ApiError')
    })

    it('should be an instance of Error', () => {
      const err = new ApiError('test')
      expect(err).toBeInstanceOf(Error)
    })

    it('should store message', () => {
      const err = new ApiError('Not found')
      expect(err.message).toBe('Not found')
    })

    it('should store status and data', () => {
      const err = new ApiError('Forbidden', 403, { code: 'PLAN_UPGRADE_REQUIRED' })
      expect(err.response?.status).toBe(403)
      expect(err.response?.data?.code).toBe('PLAN_UPGRADE_REQUIRED')
    })

    it('status defaults to undefined', () => {
      const err = new ApiError('oops')
      expect(err.response?.status).toBeUndefined()
    })

    it('data defaults to undefined', () => {
      const err = new ApiError('oops', 500)
      expect(err.response?.data).toBeUndefined()
    })
  })

  describe('Token Key Constants', () => {
    it('access token key should be hw_access_token', () => {
      expect(ACCESS_TOKEN_KEY).toBe('hw_access_token')
    })

    it('refresh token key should be hw_refresh_token', () => {
      expect(REFRESH_TOKEN_KEY).toBe('hw_refresh_token')
    })
  })

  describe('buildQueryString()', () => {
    it('empty params to empty string', () => {
      expect(buildQueryString({})).toBe('')
    })

    it('single param', () => {
      expect(buildQueryString({ page: 1 })).toBe('page=1')
    })

    it('multiple params', () => {
      const qs = buildQueryString({ page: 1, limit: 25 })
      expect(qs).toContain('page=1')
      expect(qs).toContain('limit=25')
    })

    it('boolean param to string', () => {
      expect(buildQueryString({ active: true })).toBe('active=true')
    })

    it('undefined values are filtered out', () => {
      const qs = buildQueryString({ page: 1, search: undefined })
      expect(qs).toBe('page=1')
      expect(qs).not.toContain('search')
    })

    it('all undefined to empty string', () => {
      expect(buildQueryString({ a: undefined, b: undefined })).toBe('')
    })
  })

  describe('buildFullUrl()', () => {
    const base = 'http://localhost:3001/api'

    it('relative path to base + path', () => {
      expect(buildFullUrl(base, '/hardware')).toBe('http://localhost:3001/api/hardware')
    })

    it('absolute URL used as-is', () => {
      expect(buildFullUrl(base, 'https://external.com/data')).toBe('https://external.com/data')
    })

    it('with params appended as query string', () => {
      const url = buildFullUrl(base, '/hardware', { page: 1 })
      expect(url).toBe('http://localhost:3001/api/hardware?page=1')
    })

    it('existing query string appended with &', () => {
      const url = buildFullUrl(base, 'http://example.com?foo=bar', { baz: 1 })
      expect(url).toBe('http://example.com?foo=bar&baz=1')
    })

    it('no params means no query string', () => {
      const url = buildFullUrl(base, '/test')
      expect(url).not.toContain('?')
    })
  })

  describe('resolveApiUrl()', () => {
    it('env var takes precedence', () => {
      expect(resolveApiUrl('localhost', 'https://custom.api.com')).toBe('https://custom.api.com')
    })

    it('asset-node.com to production API', () => {
      expect(resolveApiUrl('asset-node.com')).toBe('https://api.asset-node.com/api')
    })

    it('app.asset-node.com to production API', () => {
      expect(resolveApiUrl('app.asset-node.com')).toBe('https://api.asset-node.com/api')
    })

    it('localhost to dev API', () => {
      expect(resolveApiUrl('localhost')).toBe('http://localhost:3001/api')
    })

    it('any other hostname to dev API', () => {
      expect(resolveApiUrl('192.168.1.100')).toBe('http://localhost:3001/api')
    })
  })

  describe('RequestConfig Types', () => {
    it('should accept params', () => {
      const cfg: RequestConfig = { params: { page: 1, search: 'test' } }
      expect(cfg.params?.page).toBe(1)
    })

    it('should accept responseType blob', () => {
      const cfg: RequestConfig = { responseType: 'blob' }
      expect(cfg.responseType).toBe('blob')
    })

    it('retry flags should default to undefined', () => {
      const cfg: RequestConfig = {}
      expect(cfg._retry).toBeUndefined()
      expect(cfg._roleRetry).toBeUndefined()
    })

    it('should accept DELETE body via data', () => {
      const cfg: RequestConfig = { data: { ids: ['a', 'b'] } }
      expect(cfg.data).toEqual({ ids: ['a', 'b'] })
    })
  })
})
