import { FastifyPluginAsync } from 'fastify'
import { Type, TSchema, TObject, TProperties } from '@sinclair/typebox'
import { Model, Document } from 'mongoose'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId, sanitizeBody } from '../middleware/tenantScope'

export interface CrudRouteConfig {
  model: Model<any>
  entityName: string
  createSchema: TObject<TProperties>
  updateSchema: TObject<TProperties>
  populateFields?: string[]
  defaultSort?: Record<string, 1 | -1>
  checkDuplicateName?: boolean
  usePut?: boolean
}

export function createCrudRoutes(config: CrudRouteConfig): FastifyPluginAsync {
  const {
    model,
    entityName,
    createSchema,
    updateSchema,
    populateFields = [],
    defaultSort = { name: 1 },
    checkDuplicateName = true,
    usePut = false,
  } = config

  const routes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', authenticate)

    fastify.get('/', async (request) => {
      const tenantFilter = getTenantFilter(request)
      let query = model.find(tenantFilter).sort(defaultSort)
      for (const field of populateFields) {
        query = query.populate(field)
      }
      return query.lean()
    })

    fastify.post('/', {
      preHandler: [requireRole('admin', 'manager')],
      schema: { body: createSchema }
    }, async (request, reply) => {
      const orgId = getOrgId(request)
      const body = sanitizeBody(request.body as any)

      if (checkDuplicateName && body.name) {
        const existing = await model.findOne({ orgId, name: body.name })
        if (existing) {
          return reply.status(409).send({ error: `${entityName} already exists` })
        }
      }

      const doc = new model({ orgId, ...body })
      await doc.save()
      return reply.status(201).send(doc)
    })

    const updateMethod = usePut ? 'put' : 'patch'
    fastify[updateMethod]('/:id', {
      preHandler: [requireRole('admin', 'manager')],
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: updateSchema,
      }
    }, async (request, reply) => {
      const tenantFilter = getTenantFilter(request)
      const { id } = request.params as { id: string }
      const body = sanitizeBody(request.body as any)

      if (checkDuplicateName && body.name) {
        const existing = await model.findOne({
          ...tenantFilter,
          name: body.name,
          _id: { $ne: id },
        })
        if (existing) {
          return reply.status(409).send({ error: `${entityName} name already taken` })
        }
      }

      const doc = await model.findOneAndUpdate(
        { ...tenantFilter, _id: id },
        { $set: body },
        { new: true }
      )
      if (!doc) {
        return reply.status(404).send({ error: `${entityName} not found` })
      }
      return doc
    })

    fastify.delete('/:id', {
      preHandler: [requireRole('admin', 'manager')],
      schema: {
        params: Type.Object({ id: Type.String() })
      }
    }, async (request, reply) => {
      const tenantFilter = getTenantFilter(request)
      const { id } = request.params as { id: string }

      const result = await model.findOneAndDelete({ ...tenantFilter, _id: id })
      if (!result) {
        return reply.status(404).send({ error: `${entityName} not found` })
      }
      return { success: true }
    })
  }

  return routes
}
