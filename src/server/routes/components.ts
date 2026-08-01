import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Component } from '../../models/Component'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

const componentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    return Component.find(tenantFilter)
      .populate('hardwareId', 'serialNumber model assetTag')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
      .sort({ name: 1 })
      .lean()
  })

  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const component = await Component.findOne({ ...tenantFilter, _id: id })
      .populate('hardwareId', 'serialNumber model assetTag')
      .populate('categoryId', 'name icon color')
      .populate('manufacturerId', 'name')
      .populate('supplierId', 'name')
      .lean()
    if (!component) return reply.status(404).send({ error: 'Component not found' })
    return component
  })

  fastify.post('/', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1 }),
        categoryId: Type.Optional(Type.String()),
        serialNumber: Type.Optional(Type.String()),
        manufacturerId: Type.Optional(Type.String()),
        model: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number({ minimum: 1 })),
        minimumQuantity: Type.Optional(Type.Number({ minimum: 0 })),
        purchasePrice: Type.Optional(Type.Number({ minimum: 0 })),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        purchaseDate: Type.Optional(Type.String()),
        supplierId: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = sanitizeBody(request.body as any)
    const component = new Component({ orgId, ...body })
    await component.save()
    return reply.status(201).send(component)
  })

  fastify.patch('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1 })),
        categoryId: Type.Optional(Type.String()),
        serialNumber: Type.Optional(Type.String()),
        manufacturerId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        model: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number({ minimum: 1 })),
        minimumQuantity: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        purchasePrice: Type.Optional(Type.Number({ minimum: 0 })),
        currency: Type.Optional(Type.String({ maxLength: 3 })),
        purchaseDate: Type.Optional(Type.String()),
        supplierId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        notes: Type.Optional(Type.String()),
        status: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const body = sanitizeBody(request.body as any)

    const component = await Component.findOneAndUpdate(
      { ...tenantFilter, _id: id },
      { $set: body },
      { new: true }
    )
    if (!component) return reply.status(404).send({ error: 'Component not found' })
    return component
  })

  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const result = await Component.findOneAndDelete({ ...tenantFilter, _id: id })
    if (!result) return reply.status(404).send({ error: 'Component not found' })
    return { success: true }
  })

  fastify.post('/:id/attach', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({ hardwareId: Type.String() })
    }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const { hardwareId } = request.body as { hardwareId: string }

    const component = await Component.findOne({ ...tenantFilter, _id: id })
    if (!component) return reply.status(404).send({ error: 'Component not found' })
    if (component.status === 'installed') {
      return reply.status(409).send({ error: 'Component is already installed in another asset' })
    }

    component.hardwareId = hardwareId as any
    component.installedAt = new Date()
    component.status = 'installed'
    await component.save()

    return component
  })

  fastify.post('/:id/detach', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }

    const component = await Component.findOne({ ...tenantFilter, _id: id })
    if (!component) return reply.status(404).send({ error: 'Component not found' })
    if (component.status !== 'installed') {
      return reply.status(400).send({ error: 'Component is not installed' })
    }

    component.hardwareId = null as any
    component.installedAt = undefined
    component.status = 'available'
    await component.save()

    return component
  })

  fastify.get('/by-hardware/:hardwareId', {
    schema: { params: Type.Object({ hardwareId: Type.String() }) }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { hardwareId } = request.params as { hardwareId: string }
    return Component.find({ ...tenantFilter, hardwareId }).lean()
  })
}

export default componentRoutes
