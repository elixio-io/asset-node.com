

export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  responseType?: 'json' | 'blob'
  data?: unknown
  timeoutMs?: number
  _retry?: boolean
  _roleRetry?: boolean
}

export interface ApiResponse<T = any> {
  data: T
  status: number
  headers: Headers
}

export class ApiError extends Error {
  response?: { data?: any; status?: number }

  constructor(message: string, status?: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.response = { data, status }
  }
}


function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host.endsWith('.asset-node.com') || host === 'asset-node.com') {
    return 'https://api.asset-node.com/api'
  }
  return 'http://127.0.0.1:3001/api'
}

export const API_BASE_URL = resolveApiUrl()
const TIMEOUT_MS = 60_000


const ACCESS_TOKEN_KEY = 'hw_access_token'
const REFRESH_TOKEN_KEY = 'hw_refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function clearTokensIfRefreshUnchanged(failedRefreshToken: string): boolean {
  if (getRefreshToken() !== failedRefreshToken) return false
  clearTokens()
  return true
}


let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: Error | null, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}


async function request<T = any>(
  method: string,
  url: string,
  body?: unknown,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  let fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  if (config.params) {
    const filtered = Object.entries(config.params).filter(([, v]) => v !== undefined)
    if (filtered.length) {
      const qs = new URLSearchParams(
        filtered.map(([k, v]) => [k, String(v)])
      ).toString()
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
    }
  }

  const headers: Record<string, string> = { ...config.headers }
  const token = getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let fetchBody: BodyInit | undefined
  if (body instanceof FormData) {
    fetchBody = body
    delete headers['Content-Type']
  } else if (body !== undefined && body !== null) {
    fetchBody = JSON.stringify(body)
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
  } else if (!headers['Content-Type'] && method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeoutMs = config.timeoutMs ?? TIMEOUT_MS
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(fullUrl, {
      method,
      headers,
      body: fetchBody,
      signal: controller.signal
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${timeoutMs}ms`, 0)
    }
    throw new ApiError(err.message || 'Network error', 0)
  } finally {
    clearTimeout(timeoutId)
  }

  let data: any
  if (config.responseType === 'blob') {
    data = await res.blob()
  } else {
    const text = await res.text()
    try { data = text ? JSON.parse(text) : null }
    catch { data = text }
  }

  if (!res.ok) {
    const error = new ApiError(
      data?.message || data?.error || res.statusText,
      res.status,
      data
    )

    if (
      res.status === 403 &&
      !config._roleRetry &&
      getRefreshToken() &&
      !url.includes('/auth/')
    ) {
      config._roleRetry = true
      const failedRefreshToken = getRefreshToken()!
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: failedRefreshToken })
        })
        if (!refreshRes.ok) throw new Error('Refresh failed')
        const tokens = await refreshRes.json()
        setTokens(tokens.accessToken, tokens.refreshToken)

        try {
          const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
          })
          if (meRes.ok) {
            const { useAuthStore } = await import('../stores/auth')
            const authStore = useAuthStore()
            authStore.user = await meRes.json()
          }
        } catch {  }

        return request<T>(method, url, body, config)
      } catch {



        if (getRefreshToken() && getRefreshToken() !== failedRefreshToken) {
          return request<T>(method, url, body, config)
        }
        throw error
      }
    }

    if (res.status === 401 && !config._retry && getRefreshToken()) {
      if (isRefreshing) {
        return new Promise<ApiResponse<T>>((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              config._retry = true
              resolve(request<T>(method, url, body, { ...config, _retry: true }))
            },
            reject
          })
        })
      }

      config._retry = true
      isRefreshing = true
      const failedRefreshToken = getRefreshToken()!

      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: failedRefreshToken })
        })
        if (!refreshRes.ok) throw new Error('Refresh failed')
        const tokens = await refreshRes.json()
        setTokens(tokens.accessToken, tokens.refreshToken)
        processQueue(null, tokens.accessToken)
        return request<T>(method, url, body, config)
      } catch (refreshError) {
        const replacementRefreshToken = getRefreshToken()
        if (replacementRefreshToken && replacementRefreshToken !== failedRefreshToken) {


          processQueue(null, getAccessToken())
          return request<T>(method, url, body, config)
        }

        processQueue(refreshError as Error)
        if (clearTokensIfRefreshUnchanged(failedRefreshToken)) {
          window.location.href = '/sign-in'
        }
        throw refreshError
      } finally {
        isRefreshing = false
      }
    }

    throw error
  }

  return { data, status: res.status, headers: res.headers }
}


const api = {
  get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return request<T>('GET', url, undefined, config)
  },

  post<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return request<T>('POST', url, body, config)
  },

  put<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return request<T>('PUT', url, body, config)
  },

  patch<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return request<T>('PATCH', url, body, config)
  },

  delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const body = config?.data
    return request<T>('DELETE', url, body, config)
  }
}


import { useErrorHandler } from '../composables/useErrorHandler'

const errorHandler = useErrorHandler()

const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
const rawApi = { ...api }

for (const method of methods) {
  const original = rawApi[method] as (...args: any[]) => Promise<ApiResponse>
  ;(api as any)[method] = async (...args: any[]): Promise<ApiResponse> => {
    try {
      return await original(...args)
    } catch (err: any) {
      if (err instanceof ApiError && err.response?.status !== 401) {
        const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'An unexpected error occurred'
        const severity = err.response?.status && err.response.status >= 500 ? 'error' : 'warn'
        errorHandler.addError(msg, severity as any)



        try {
          const url = typeof args[0] === 'string' ? args[0].slice(0, 200) : ''
          const { pushLog } = await import('../composables/useClientLogBuffer')
          pushLog('api', `${method.toUpperCase()} ${url} → ${err.response?.status || 0}`, {
            status: err.response?.status ?? 0,
          })
        } catch {  }
      }
      throw err
    }
  }
}

export default api
