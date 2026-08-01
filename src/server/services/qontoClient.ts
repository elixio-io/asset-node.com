
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 2_000


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


async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface QontoResponse<T = any> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

async function request<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: any,
  attempt = 1,
  extraHeaders: Record<string, string> = {}
): Promise<QontoResponse<T>> {
  const cfg = getConfig()
  const url = `${cfg.baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.ok) {
      const responseText = await res.text()
      const data = responseText ? JSON.parse(responseText) : null
      return { ok: true, status: res.status, data }
    }

    if (res.status === 429 && attempt <= MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
      console.warn(`[Qonto] Rate limited (429). Retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`)
      await sleep(backoff)
      return request<T>(method, path, body, attempt + 1, extraHeaders)
    }

    if (res.status === 302) {
      const location = res.headers.get('location')
      console.error(`[Qonto] 302 redirect (sandbox ALB auth). Location: ${location}`)
      return { ok: false, status: 302, data: null, error: 'Sandbox auth failed — check staging token/cookie' }
    }

    const errorBody = await res.text()
    console.error(`[Qonto] ${method} ${path} → ${res.status}: ${errorBody}`)
    return { ok: false, status: res.status, data: null, error: errorBody }
  } catch (err: any) {
    console.error(`[Qonto] Request failed:`, err.message)
    return { ok: false, status: 0, data: null, error: err.message }
  }
}


export async function getOrganization() {
  return request('GET', '/organization')
}


export async function createClient(params: {
  name: string
  type?: 'company' | 'individual'
  email?: string
  currency?: string
  locale?: string
  billing_address: {
    street: string
    city: string
    zip_code: string
    country_code: string
  }
  vat_number?: string
}) {
  return request('POST', '/clients', params)
}

export async function listClients(params?: Record<string, any>) {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return request('GET', `/clients${query}`)
}

export async function createClientInvoice(params: {
  client_id: string
  due_date: string
  terms?: string
  purchase_order?: string
  items: Array<{
    title: string
    description?: string
    quantity: number
    unit_price: {
      value: string
      currency: string
    }
    vat_rate?: string
  }>
}, idempotencyKey?: string) {
  return request('POST', '/client_invoices', params, 1, idempotencyKey
    ? { 'X-Qonto-Idempotency-Key': idempotencyKey }
    : {})
}

export async function finalizeClientInvoice(invoiceId: string) {
  return request('POST', `/client_invoices/${invoiceId}/finalize`, {})
}

export async function cancelClientInvoice(invoiceId: string) {
  return request('POST', `/client_invoices/${invoiceId}/cancel`, {})
}

export async function getClientInvoice(invoiceId: string) {
  return request('GET', `/client_invoices/${invoiceId}`)
}

export async function listClientInvoices(params?: Record<string, any>) {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return request('GET', `/client_invoices${query}`)
}


export async function listTransactions(params?: Record<string, any>) {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return request('GET', `/transactions${query}`)
}


export async function getAttachment(attachmentId: string) {
  return request('GET', `/attachments/${attachmentId}`)
}


export async function healthCheck(): Promise<{ connected: boolean; orgName?: string; error?: string }> {
  const result = await getOrganization()
  if (result.ok && result.data?.organization) {
    return { connected: true, orgName: result.data.organization.name }
  }
  return { connected: false, error: result.error || 'Unknown error' }
}
