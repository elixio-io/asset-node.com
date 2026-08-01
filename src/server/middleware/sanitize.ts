import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/<[^>]*>/g, '')
      .trim()
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>)
  }

  return value
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue

    sanitized[key] = sanitizeValue(val)
  }

  return sanitized
}

const sanitizePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    if (request.body && typeof request.body === 'object') {
      request.body = sanitizeObject(request.body as Record<string, unknown>)
    }
    if (request.query && typeof request.query === 'object') {
      (request as any).query = sanitizeObject(request.query as Record<string, unknown>)
    }
    if (request.params && typeof request.params === 'object') {
      (request as any).params = sanitizeObject(request.params as Record<string, unknown>)
    }
  })
}

export default fp(sanitizePlugin, {
  name: 'sanitize',
  fastify: '>=4.x'
})

export { sanitizeValue, sanitizeObject }
