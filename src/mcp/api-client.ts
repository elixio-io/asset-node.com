
const API_URL = process.env.ASSETNODE_API_URL || 'http://localhost:3001'
const STATIC_TOKEN = process.env.ASSETNODE_API_TOKEN || ''
const LOGIN_EMAIL = process.env.ASSETNODE_EMAIL || ''
const LOGIN_PASSWORD = process.env.ASSETNODE_PASSWORD || ''

let currentToken = STATIC_TOKEN
let tokenExpiresAt = 0

async function ensureToken(): Promise<void> {
  if (STATIC_TOKEN && !LOGIN_EMAIL) return

  if (LOGIN_EMAIL && LOGIN_PASSWORD) {
    const now = Date.now()
    if (!currentToken || (tokenExpiresAt > 0 && now > tokenExpiresAt - 60_000)) {
      await login()
    }
  }
}

async function login(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD })
    })
    if (!res.ok) throw new Error(`Login failed: ${res.status}`)
    const data = await res.json()
    currentToken = data.accessToken
    try {
      const payload = JSON.parse(Buffer.from(currentToken.split('.')[1], 'base64').toString())
      tokenExpiresAt = (payload.exp || 0) * 1000
    } catch {
      tokenExpiresAt = Date.now() + 10 * 60 * 1000
    }
  } catch {
  }
}

export interface ApiError {
  success: false
  error: string
  statusCode?: number
}

export interface ApiSuccess<T = unknown> {
  success: true
  data: T
}

export type ApiResult<T = unknown> = ApiSuccess<T> | ApiError

async function request<T = unknown>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResult<T>> {
  try {
    await ensureToken()

    let url = `${API_URL}/api${path}`
    if (params) {
      const filtered = Object.entries(params).filter(([, v]) => v !== undefined)
      if (filtered.length) {
        const qs = new URLSearchParams(
          filtered.map(([k, v]) => [k, String(v)])
        ).toString()
        url += (url.includes('?') ? '&' : '?') + qs
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5_000)

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    const text = await res.text()
    let data: any
    try { data = text ? JSON.parse(text) : null }
    catch { data = text }

    if (!res.ok) {
      const msg = data?.error || data?.message || res.statusText
      return { success: false, error: `API Error (${res.status}): ${msg}`, statusCode: res.status }
    }

    return { success: true, data: data as T }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'API Error: Request timeout' }
    }
    return { success: false, error: String(err) }
  }
}

export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResult<T>> {
  return request<T>('GET', path, undefined, params)
}

export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResult<T>> {
  return request<T>('POST', path, body)
}

export async function apiPut<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResult<T>> {
  return request<T>('PUT', path, body)
}

export async function apiDelete<T = unknown>(path: string): Promise<ApiResult<T>> {
  return request<T>('DELETE', path)
}
