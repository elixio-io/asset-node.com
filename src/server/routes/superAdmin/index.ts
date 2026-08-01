import { FastifyPluginAsync } from 'fastify'
import { authenticate, requireSuperAdmin } from '../../middleware/auth'
import statsRoutes from './stats'
import organizationRoutes from './organizations'
import userRoutes from './users'
import billingRoutes from './billing'
import systemRoutes from './system'
import exportRoutes from './export'
import notificationRoutes from './notifications'

const superAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireSuperAdmin)

  fastify.register(statsRoutes)
  fastify.register(organizationRoutes)
  fastify.register(userRoutes)
  fastify.register(billingRoutes)
  fastify.register(systemRoutes)
  fastify.register(exportRoutes)
  fastify.register(notificationRoutes)
}

export default superAdminRoutes
