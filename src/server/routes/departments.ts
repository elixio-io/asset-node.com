import { FastifyPluginAsync } from 'fastify'
import { Department } from '../../models/Department'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const departments = await Department.find(tenantFilter)
      .populate('managerId', 'firstName lastName email')
      .populate('locationId', 'name address')
      .sort({ name: 1 })
      .lean()
    return departments
  })

  fastify.get('/:id', async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const dept = await Department.findOne({ _id: id, ...tenantFilter })
      .populate('managerId', 'firstName lastName email')
      .populate('locationId', 'name address')
      .lean()
    if (!dept) return reply.status(404).send({ error: 'Department not found' })
    return dept
  })

  fastify.post('/', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const orgId = getOrgId(request)
    const { name, managerId, locationId, description } = request.body as any
    if (!name) return reply.status(400).send({ error: 'name is required' })
    const dept = await Department.create({ orgId, name, managerId: managerId || null, locationId: locationId || null, description })
    return reply.status(201).send(dept)
  })

  fastify.put('/:id', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const updates = request.body as any
    delete updates.orgId
    const dept = await Department.findOneAndUpdate({ _id: id, ...tenantFilter }, updates, { new: true })
      .populate('managerId', 'firstName lastName email')
      .populate('locationId', 'name address')
    if (!dept) return reply.status(404).send({ error: 'Department not found' })
    return dept
  })

  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const dept = await Department.findOneAndDelete({ _id: id, ...tenantFilter })
    if (!dept) return reply.status(404).send({ error: 'Department not found' })
    return { success: true }
  })
}

export default departmentRoutes
