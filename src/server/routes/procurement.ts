
import { FastifyPluginAsync } from 'fastify'
import { authenticate, requireRole } from '../middleware/auth'

const CHAINIQ_URL = process.env.CHAINIQ_API_URL || 'http://localhost:4000'
const CHAINIQ_TIMEOUT_MS = 90_000

function chainIqFailure(err: unknown, fallbackMessage: string) {
  const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
  return {
    status: timedOut ? 504 : 502,
    body: {
      error: timedOut
        ? 'ChainIQ did not finish within 90 seconds. Please retry; no request data was lost.'
        : fallbackMessage,
      code: timedOut ? 'CHAINIQ_TIMEOUT' : 'PROXY_ERROR'
    }
  }
}

async function proxyGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${CHAINIQ_URL}${path}`, {
    signal: AbortSignal.timeout(CHAINIQ_TIMEOUT_MS)
  })
  const body = await res.json().catch(() => ({ error: 'Invalid JSON from ChainIQ' }))
  return { status: res.status, body }
}

async function proxyPost(path: string, payload: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${CHAINIQ_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CHAINIQ_TIMEOUT_MS)
  })
  const body = await res.json().catch(() => ({ error: 'Invalid JSON from ChainIQ' }))
  return { status: res.status, body }
}

const procurementRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.addHook('onRequest', authenticate)
  fastify.addHook('onRequest', requireRole('admin', 'manager'))

  const chatRateLimits = new Map<string, { count: number; resetAt: number }>()
  const CHAT_RATE_LIMIT = 5
  const CHAT_RATE_WINDOW = 60 * 1000

  fastify.get('/health', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/health')
      return reply.code(status).send(body)
    } catch (err) {
      return reply.code(503).send({
        error: 'ChainIQ API unreachable',
        code: 'CHAINIQ_UNAVAILABLE'
      })
    }
  })

  fastify.get('/requests', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/requests')
      return reply.code(status).send(body)
    } catch (err) {
      _request.log.error(err, 'Failed to fetch procurement requests')
      return reply.code(502).send({ error: 'Failed to fetch requests', code: 'PROXY_ERROR' })
    }
  })

  fastify.get('/suppliers', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/suppliers')
      return reply.code(status).send(body)
    } catch (err) {
      _request.log.error(err, 'Failed to fetch suppliers')
      return reply.code(502).send({ error: 'Failed to fetch suppliers', code: 'PROXY_ERROR' })
    }
  })

  fastify.get('/categories', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/categories')
      return reply.code(status).send(body)
    } catch (err) {
      _request.log.error(err, 'Failed to fetch categories')
      return reply.code(502).send({ error: 'Failed to fetch categories', code: 'PROXY_ERROR' })
    }
  })

  fastify.get('/historical', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/historical')
      return reply.code(status).send(body)
    } catch (err) {
      _request.log.error(err, 'Failed to fetch historical data')
      return reply.code(502).send({ error: 'Failed to fetch historical data', code: 'PROXY_ERROR' })
    }
  })

  fastify.post<{
    Body: { text: string }
  }>('/parse', async (request, reply) => {
    const { text } = request.body || {}

    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return reply.code(400).send({
        error: 'Request text must be at least 5 characters',
        code: 'INVALID_INPUT'
      })
    }

    try {
      const { status, body } = await proxyPost('/api/parse', { text: text.trim() })
      return reply.code(status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to parse procurement text')
      return reply.code(502).send({ error: 'Failed to parse text', code: 'PROXY_ERROR' })
    }
  })

  fastify.get<{
    Params: { id: string }
  }>('/process/:id', async (request, reply) => {
    const { id } = request.params

    try {
      const { status, body } = await proxyGet(`/api/process/${encodeURIComponent(id)}`)
      return reply.code(status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to process procurement request')
      const failure = chainIqFailure(err, 'Failed to process request')
      return reply.code(failure.status).send(failure.body)
    }
  })

  fastify.post<{
    Body: Record<string, unknown>
  }>('/process-adhoc', async (request, reply) => {
    try {
      const { status, body } = await proxyPost('/api/process', request.body)
      return reply.code(status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to process adhoc request')
      const failure = chainIqFailure(err, 'Failed to process adhoc request')
      return reply.code(failure.status).send(failure.body)
    }
  })

  fastify.get('/results', async (_request, reply) => {
    try {
      const { status, body } = await proxyGet('/api/results')
      return reply.code(status).send(body)
    } catch (err) {
      _request.log.error(err, 'Failed to fetch pipeline results')
      return reply.code(502).send({ error: 'Failed to fetch results', code: 'PROXY_ERROR' })
    }
  })

  fastify.get<{
    Params: { id: string }
  }>('/results/:id', async (request, reply) => {
    const { id } = request.params
    try {
      const { status, body } = await proxyGet(`/api/results/${encodeURIComponent(id)}`)
      return reply.code(status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to fetch pipeline result')
      return reply.code(502).send({ error: 'Failed to fetch result', code: 'PROXY_ERROR' })
    }
  })

  fastify.delete<{
    Params: { id: string }
  }>('/results/:id', async (request, reply) => {
    const { id } = request.params
    try {
      const res = await fetch(`${CHAINIQ_URL}/api/results/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(CHAINIQ_TIMEOUT_MS)
      })
      const body = await res.json().catch(() => ({ error: 'Invalid JSON from ChainIQ' }))
      return reply.code(res.status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to delete pipeline result')
      return reply.code(502).send({ error: 'Failed to delete result', code: 'PROXY_ERROR' })
    }
  })

  fastify.post<{
    Body: { message: string; history?: Array<{ role: string; content: string }>; context?: Record<string, unknown> }
  }>('/agent/chat', async (request, reply) => {
    const { message, history, context } = request.body || {}
    const user = (request as any).user

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return reply.code(400).send({ error: 'Message is required', code: 'INVALID_INPUT' })
    }
    if (message.length > 2000) {
      return reply.code(400).send({ error: 'Message exceeds maximum length of 2000 characters', code: 'PAYLOAD_TOO_LARGE' })
    }

    const safeHistory = Array.isArray(history) ? history.slice(-20) : []

    const userId = user?.id || request.ip
    const now = Date.now()
    const record = chatRateLimits.get(userId)

    if (record && record.resetAt > now) {
      if (record.count >= CHAT_RATE_LIMIT) {
        return reply.code(429).send({ error: 'Rate limit exceeded. Please try again later.', code: 'TOO_MANY_REQUESTS' })
      }
      record.count += 1
    } else {
      chatRateLimits.set(userId, { count: 1, resetAt: now + CHAT_RATE_WINDOW })
    }

    const orgId = user?.orgId
    const safeContext = {
      ...(context && typeof context === 'object' ? context : {}),
      orgId: orgId || null
    }

    delete safeContext.request_id
    delete safeContext.parsed_data

    try {
      const { status, body } = await proxyPost('/api/agent/chat', {
        message: message.trim(),
        history: safeHistory,
        context: safeContext
      }, {
        'x-org-id': orgId ? String(orgId) : ''
      })
      return reply.code(status).send(body)
    } catch (err) {
      request.log.error(err, 'Failed to process agent chat')
      return reply.code(502).send({ error: 'Agent unavailable', code: 'PROXY_ERROR' })
    }
  })
}

export default procurementRoutes
