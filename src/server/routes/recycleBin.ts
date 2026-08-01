import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import mongoose from 'mongoose'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Consumable } from '../../models/Consumable'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Employee } from '../../models/Employee'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'
import { getLimits, isLimitReached } from '../config/plans'
import type { PlanKey } from '../config/plans'
import { Organization } from '../../models/Organization'
import { resolveEffectivePlan } from '../services/entitlementService'

const MODELS: Record<string, any> = {
  hardware: Hardware,
  peripheral: Peripheral,
  consumable: Consumable,
  license: SoftwareLicense,
  employee: Employee
}

const recycleBinRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)

    const results: Record<string, any[]> = {}
    for (const [key, Model] of Object.entries(MODELS)) {
      results[key] = await Model.find({
        ...tenantFilter,
        deletedAt: { $ne: null }
      })
        .sort({ deletedAt: -1 })
        .lean()
    }

    return results
  })

  fastify.get('/:type', {
    schema: { params: Type.Object({ type: Type.String() }) }
  }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const Model = MODELS[type]
    if (!Model) return reply.status(400).send({ error: `Unknown type: ${type}` })

    const tenantFilter = getTenantFilter(request)
    const items = await Model.find({
      ...tenantFilter,
      deletedAt: { $ne: null }
    })
      .sort({ deletedAt: -1 })
      .lean()

    return items
  })

  fastify.post('/:type/:id/restore', {
    schema: {
      params: Type.Object({ type: Type.String(), id: Type.String() })
    }
  }, async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string }
    const Model = MODELS[type]
    if (!Model) return reply.status(400).send({ error: `Unknown type: ${type}` })

    const tenantFilter = getTenantFilter(request)

    if (type === 'hardware' || type === 'peripheral') {
      const orgId = getOrgId(request)
      const org = await Organization.findById(orgId).select('plan billing').lean()
      const billing = (org as any)?.billing || {}
      const effectivePlan = resolveEffectivePlan((org as any)?.plan as PlanKey || 'free', billing)
      const limits = getLimits(effectivePlan)
      if (limits.assets !== -1) {
        const [hwCount, perCount] = await Promise.all([
          Hardware.countDocuments({ orgId, deletedAt: null }),
          Peripheral.countDocuments({ orgId, deletedAt: null }),
        ])
        if (isLimitReached(hwCount + perCount, limits.assets)) {
          return reply.status(403).send({
            error: 'Asset limit reached. Upgrade your plan before restoring items.',
            code: 'PLAN_LIMIT_REACHED',
          })
        }
      }
    }

    const item = await Model.findOneAndUpdate(
      { ...tenantFilter, _id: id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true }
    )
    if (!item) return reply.status(404).send({ error: 'Item not found in recycle bin' })

    await createAuditEntry(request, 'update', type, id, {
      after: { action: 'restored' }
    })

    return { success: true, item }
  })

  fastify.delete('/:type/:id', {
    schema: {
      params: Type.Object({ type: Type.String(), id: Type.String() })
    }
  }, async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string }
    const Model = MODELS[type]
    if (!Model) return reply.status(400).send({ error: `Unknown type: ${type}` })

    const tenantFilter = getTenantFilter(request)

    const result = await Model.collection.deleteOne({
      ...tenantFilter,
      _id: new mongoose.Types.ObjectId(id)
    })

    if (result.deletedCount === 0) {
      return reply.status(404).send({ error: 'Item not found' })
    }

    await createAuditEntry(request, 'delete', type, id, {
      after: { action: 'permanently deleted' }
    })

    return { success: true }
  })

  fastify.delete('/', {
    preHandler: [requireRole('admin')]
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const counts: Record<string, number> = {}

    for (const [key, Model] of Object.entries(MODELS)) {
      const result = await Model.collection.deleteMany({
        ...tenantFilter,
        deletedAt: { $ne: null }
      })
      counts[key] = result.deletedCount
    }

    await createAuditEntry(request, 'delete', 'RecycleBin', 'all', {
      after: { action: 'emptied', counts }
    })

    return { success: true, counts }
  })
}

export default recycleBinRoutes
