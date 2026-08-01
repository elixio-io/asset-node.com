
import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/auth'
import { searchMarketplace, getMarketplaceProductDetail, getMarketplaceHealth } from '../services/marketplaceService'
import { getActiveBuybackPartners } from '../config/buybackPartners'
import { PRODUCT_CATEGORIES, logMarketplaceConfig } from '../config/marketplaceConfig'
import {
  createBuybackQuote,
  listBuybackQuotes,
  updateQuoteStatus,
  estimateBatch,
  getQuoteById
} from '../services/buybackService'

const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {

  logMarketplaceConfig()

  fastify.addHook('onRequest', authenticate)


  fastify.get<{
    Querystring: { q?: string; category?: string; page?: string }
  }>('/search', async (request, reply) => {
    const { q, category, page } = request.query

    if (!q || q.trim().length < 2) {
      return reply.code(400).send({
        error: 'Search query must be at least 2 characters',
        code: 'INVALID_QUERY'
      })
    }

    const pageNum = page ? parseInt(page, 10) : 0

    const validCategories = PRODUCT_CATEGORIES.map(c => c.key)
    if (category && !validCategories.includes(category as any)) {
      return reply.code(400).send({
        error: `Invalid category. Valid: ${validCategories.join(', ')}`,
        code: 'INVALID_CATEGORY'
      })
    }

    try {
      const result = await searchMarketplace(q.trim(), category, pageNum)
      return reply.send(result)
    } catch (err) {
      request.log.error(err, 'Marketplace search failed')
      return reply.code(500).send({
        error: 'Marketplace search failed',
        code: 'SEARCH_ERROR'
      })
    }
  })


  fastify.get('/categories', async (_request, reply) => {
    return reply.send(PRODUCT_CATEGORIES)
  })

  fastify.get<{
    Params: { id: string }
  }>('/product/:id', async (request, reply) => {
    let { id } = request.params

    if (id.startsWith('icecat--')) {
      id = id.replace(/--/g, ':')
    }

    if (!id || id.length < 5) {
      return reply.code(400).send({
        error: 'Product ID is invalid',
        code: 'INVALID_PRODUCT_ID'
      })
    }

    try {
      const detail = await getMarketplaceProductDetail(id)
      if (!detail) {
        return reply.code(404).send({
          error: 'Product not found or API limit reached',
          code: 'NOT_FOUND'
        })
      }
      return reply.send(detail)
    } catch (err) {
      request.log.error(err, 'Product detail lookup failed')
      return reply.code(500).send({
        error: 'Product detail lookup failed',
        code: 'PRODUCT_DETAIL_ERROR'
      })
    }
  })

  fastify.get('/health', async (_request, reply) => {
    return reply.send(getMarketplaceHealth())
  })


  fastify.get('/buyback-partners', async (_request, reply) => {
    return reply.send(getActiveBuybackPartners())
  })

  fastify.post<{
    Body: { hardwareIds: string[] }
  }>('/estimate', async (request, reply) => {
    const { hardwareIds } = request.body || {}

    if (!hardwareIds || !Array.isArray(hardwareIds) || hardwareIds.length === 0) {
      return reply.code(400).send({
        error: 'At least one hardware ID is required',
        code: 'MISSING_HARDWARE_IDS'
      })
    }

    if (hardwareIds.length > 200) {
      return reply.code(400).send({
        error: 'Maximum 200 assets per estimate',
        code: 'TOO_MANY_ASSETS'
      })
    }

    try {
      const orgId = request.user!.orgId
      const result = await estimateBatch(orgId, hardwareIds)
      return reply.send(result)
    } catch (err) {
      request.log.error(err, 'Buyback estimate failed')
      return reply.code(500).send({
        error: 'Estimate calculation failed',
        code: 'ESTIMATE_ERROR'
      })
    }
  })

  fastify.post<{
    Body: {
      partnerSlug: string
      hardwareIds: string[]
      contactName?: string
      contactEmail?: string
      contactPhone?: string
      notes?: string
    }
  }>('/quote', async (request, reply) => {
    const { partnerSlug, hardwareIds, contactName, contactEmail, contactPhone, notes } = request.body || {}

    if (!partnerSlug || typeof partnerSlug !== 'string') {
      return reply.code(400).send({ error: 'partnerSlug is required', code: 'MISSING_PARTNER' })
    }

    if (!hardwareIds || !Array.isArray(hardwareIds) || hardwareIds.length === 0) {
      return reply.code(400).send({ error: 'At least one hardware ID is required', code: 'MISSING_HARDWARE_IDS' })
    }

    try {
      const orgId = request.user!.orgId
      const userId = request.user!.userId

      const result = await createBuybackQuote({
        orgId,
        partnerSlug,
        hardwareIds,
        contactName,
        contactEmail,
        contactPhone,
        notes,
        userId
      })

      return reply.code(201).send({
        message: `Quote submitted to ${result.partner.name}`,
        quoteId: result.quote._id,
        totalEstimatedValue: result.totalEstimatedValue,
        assetCount: result.assetCount,
        partner: result.partner.name
      })
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('not found') || msg.includes('requires a minimum')) {
        return reply.code(400).send({ error: msg, code: 'QUOTE_VALIDATION_ERROR' })
      }
      request.log.error(err, 'Buyback quote creation failed')
      return reply.code(500).send({ error: 'Quote creation failed', code: 'QUOTE_ERROR' })
    }
  })

  fastify.get<{
    Querystring: { page?: string; limit?: string }
  }>('/quotes', async (request, reply) => {
    const orgId = request.user!.orgId
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10) || 20))

    try {
      const result = await listBuybackQuotes(orgId, page, limit)
      return reply.send(result)
    } catch (err) {
      request.log.error(err, 'Failed to list buyback quotes')
      return reply.code(500).send({ error: 'Failed to list quotes', code: 'LIST_ERROR' })
    }
  })

  fastify.get<{
    Params: { id: string }
  }>('/quote/:id', async (request, reply) => {
    try {
      const orgId = request.user!.orgId
      const quote = await getQuoteById(request.params.id, orgId)
      return reply.send(quote)
    } catch (err) {
      return reply.code(404).send({ error: 'Quote not found', code: 'NOT_FOUND' })
    }
  })

  fastify.patch<{
    Params: { id: string }
    Body: {
      status: string
      actualValue?: number
      partnerNotes?: string
      partnerQuoteRef?: string
    }
  }>('/quote/:id', async (request, reply) => {
    const validStatuses = ['draft', 'submitted', 'quoted', 'accepted', 'shipped', 'completed', 'rejected', 'expired']
    const { status, actualValue, partnerNotes, partnerQuoteRef } = request.body || {}

    if (!status || !validStatuses.includes(status)) {
      return reply.code(400).send({
        error: `Invalid status. Valid: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      })
    }

    try {
      const orgId = request.user!.orgId
      const quote = await updateQuoteStatus(
        request.params.id,
        orgId,
        status as any,
        actualValue,
        partnerNotes,
        partnerQuoteRef
      )
      return reply.send(quote)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('not found')) {
        return reply.code(404).send({ error: msg, code: 'NOT_FOUND' })
      }
      request.log.error(err, 'Quote status update failed')
      return reply.code(500).send({ error: 'Quote update failed', code: 'UPDATE_ERROR' })
    }
  })
}

export default marketplaceRoutes
