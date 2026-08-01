
import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { AILog } from '../../models/AILog'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'

const CHAINIQ_URL = process.env.CHAINIQ_API_URL || 'http://localhost:4000'

const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000

function buildPricingPrompt(params: {
  manufacturer: string
  model: string
  category?: string
  condition?: string
}): string {
  const condition = params.condition || 'used, good condition'
  return [
    `You are an IT hardware market pricing assistant.`,
    `Estimate the current resale market value for the following device:`,
    ``,
    `- Manufacturer: ${params.manufacturer}`,
    `- Model: ${params.model}`,
    params.category ? `- Category: ${params.category}` : '',
    `- Condition: ${condition}`,
    ``,
    `Respond ONLY with a JSON object in this exact format (no markdown, no explanation):`,
    `{"suggestedPrice": <number>, "minPrice": <number>, "maxPrice": <number>, "currency": "EUR", "sources": [{"name": "<source name>", "url": "<url>", "price": <number>}], "confidence": <number 0-1>}`,
    ``,
    `If you cannot determine a reliable price, respond with: {"unavailable": true, "reason": "<brief reason>"}`
  ].filter(Boolean).join('\n')
}

function parseAIResponse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw)
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch?.[1]) {
      try { return JSON.parse(jsonMatch[1].trim()) } catch {  }
    }
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]) } catch {  }
    }
    return null
  }
}

const marketPricingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', authenticate)
  fastify.addHook('onRequest', requireRole('admin', 'manager'))

  fastify.post<{
    Body: {
      manufacturer: string
      model: string
      category?: string
      condition?: string
    }
  }>('/market-prices', {
    schema: {
      body: Type.Object({
        manufacturer: Type.String({ minLength: 1, maxLength: 200 }),
        model: Type.String({ minLength: 1, maxLength: 200 }),
        category: Type.Optional(Type.String({ maxLength: 100 })),
        condition: Type.Optional(Type.String({ maxLength: 100 }))
      })
    }
  }, async (request, reply) => {
    const user = (request as any).user
    const userId = user?.id || request.ip
    const now = Date.now()

    const record = rateLimits.get(userId)
    if (record && record.resetAt > now) {
      if (record.count >= RATE_LIMIT) {
        return reply.code(429).send({
          error: 'Rate limit exceeded. Maximum 10 price lookups per minute.',
          code: 'TOO_MANY_REQUESTS'
        })
      }
      record.count += 1
    } else {
      rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    }

    const { manufacturer, model, category, condition } = request.body
    const prompt = buildPricingPrompt({ manufacturer, model, category, condition })

    let rawResponse = ''
    try {
      const res = await fetch(`${CHAINIQ_URL}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': String(getOrgId(request) || '')
        },
        body: JSON.stringify({
          message: prompt,
          history: [],
          context: { type: 'market-pricing', manufacturer, model }
        }),
        signal: AbortSignal.timeout(30000)
      })

      const data = await res.json().catch(() => null)
      rawResponse = data?.data?.reply || data?.reply || JSON.stringify(data) || ''

      if (!res.ok) {
        request.log.warn({ status: res.status }, 'ChainIQ returned non-OK for market pricing')
        return reply.code(200).send({
          unavailable: true,
          reason: 'AI service returned an error. Please try again later.'
        })
      }
    } catch (err) {
      request.log.error(err, 'ChainIQ unreachable for market pricing')
      return reply.code(200).send({
        unavailable: true,
        reason: 'AI pricing service is currently unavailable.'
      })
    }

    const parsed = parseAIResponse(rawResponse)

    const parsedPrices = parsed && !parsed.unavailable && Array.isArray(parsed.sources)
      ? (parsed.sources as Array<{ name: string; url: string; price: number }>).map(s => ({
          price: s.price || 0,
          source: s.name || 'Unknown',
          url: s.url || ''
        }))
      : []

    try {
      const aiLog = new AILog({
        orgId: getOrgId(request),
        prompt,
        rawResponse,
        parsedResponse: parsedPrices,
        hardware: { manufacturer, model, category: category || '' }
      })
      await aiLog.save()
    } catch (logErr) {
      request.log.warn(logErr, 'Failed to save AI log (non-blocking)')
    }

    if (!parsed || parsed.unavailable) {
      return reply.send({
        unavailable: true,
        reason: (parsed as any)?.reason || 'Could not determine market price for this item.'
      })
    }

    return reply.send({
      suggestedPrice: parsed.suggestedPrice || null,
      minPrice: parsed.minPrice || null,
      maxPrice: parsed.maxPrice || null,
      currency: parsed.currency || 'EUR',
      confidence: parsed.confidence || null,
      sources: parsedPrices
    })
  })
}

export default marketPricingRoutes
