import { FastifyPluginAsync } from 'fastify'
import { Organization } from '../../models/Organization'
import { Hardware } from '../../models/Hardware'
import { Employee } from '../../models/Employee'
import { NotificationPreference } from '../../models/NotificationPreference'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId, getTenantFilter } from '../middleware/tenantScope'
import {
  DemoDataConflictError,
  exitDemoMode,
  removeDemoData,
  resetDemoData,
  seedDemoData
} from '../services/demoDataService'

const getStartedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/status', async (request) => {
    const orgId = getOrgId(request)
    const tenantFilter = getTenantFilter(request)

    const [org, employeeCount, hardwareCount, notifPrefs] = await Promise.all([
      Organization.findById(orgId).lean(),
      Employee.countDocuments({ ...tenantFilter, deletedAt: null }),
      Hardware.countDocuments({ ...tenantFilter, deletedAt: null }),
      NotificationPreference.findOne({ orgId }).lean()
    ])

    if (!org) return { wizardCompleted: true }

    const integrations = (org.settings as any)?.integrations || {}

    const scimSetup = integrations.scim?.enabled === true
    const employeesComplete = scimSetup || employeeCount > 1

    const mdmSetup = integrations.intune?.enabled ||
      integrations.jamf?.enabled ||
      integrations.kandji?.enabled
    const assetsComplete = mdmSetup || hardwareCount > 0

    const ssoSetup = integrations.sso?.enabled === true
    const usersComplete = ssoSetup

    const emailSetup = !!(notifPrefs as any)?.channels?.email?.enabled
    const slackSetup = !!(notifPrefs as any)?.channels?.slack?.enabled
    const teamsSetup = !!(notifPrefs as any)?.channels?.teams?.enabled
    const notifsComplete = emailSetup || slackSetup || teamsSetup

    const steps = [
      { key: 'employees', title: 'Employees', completed: employeesComplete },
      { key: 'assets', title: 'Assets', completed: assetsComplete },
      { key: 'users', title: 'Users', completed: usersComplete },
      { key: 'notifications', title: 'Notifications', completed: notifsComplete }
    ]

    const completedCount = steps.filter(s => s.completed).length
    const wizardCompleted = (org.settings as any)?.wizardCompleted === true

    const demoMode = (org.settings as any)?.demoMode || {}
    const demoRecords = demoMode.records || {}
    const hasDemoData = Boolean(demoMode.seededAt) || Object.values(demoRecords).some(value => Array.isArray(value) && value.length > 0)

    return {
      steps,
      completedCount,
      totalSteps: steps.length,
      wizardCompleted,
      demo: {
        enabled: demoMode.enabled === true,
        hasData: hasDemoData,
        seededAt: demoMode.seededAt,
        seedVersion: demoMode.seedVersion || 0,


        eligible: employeeCount <= 1 && hardwareCount === 0,
        hasExistingTenantData: employeeCount > 1 || hardwareCount > 0,
        tourRecommended: demoMode.enabled === true
      },
      scim: {
        endpointUrl: (process.env.API_URL || process.env.APP_URL) ? `${(process.env.API_URL || process.env.APP_URL)?.replace(/\/$/, '')}/api/scim/v2` : '',
        hasToken: !!integrations.scim?.bearerToken,
        enabled: integrations.scim?.enabled || false,
        appUrlMissing: !process.env.APP_URL
      },
      sso: {
        ssoId: org.slug || orgId,
        enabled: integrations.sso?.enabled || false
      },
      integrations: {
        intune: integrations.intune?.enabled || false,
        jamf: integrations.jamf?.enabled || false,
        kandji: integrations.kandji?.enabled || false
      }
    }
  })

  fastify.post('/complete', async (request) => {
    const orgId = getOrgId(request)
    await Organization.findByIdAndUpdate(orgId, {
      $set: { 'settings.wizardCompleted': true }
    })
    return { success: true }
  })

  fastify.post('/demo', {
    preHandler: requireRole('admin')
  }, async (request, reply) => {
    try {
      const result = await seedDemoData(getOrgId(request), request.user!.userId)
      return reply.code(201).send(result)
    } catch (err: any) {
      if (err instanceof DemoDataConflictError) {
        return reply.code(409).send({ error: err.message, code: err.code, dependencies: err.dependencies })
      }
      request.log.error(err, 'Failed to seed demo data')
      return reply.code(500).send({ error: 'Demo data could not be created', code: 'DEMO_SEED_FAILED' })
    }
  })



  fastify.post('/demo/exit', {
    preHandler: requireRole('admin')
  }, async (request, reply) => {
    try {
      return await exitDemoMode(getOrgId(request))
    } catch (err) {
      request.log.error(err, 'Failed to exit demo mode')
      return reply.code(500).send({ error: 'Demo mode could not be exited', code: 'DEMO_EXIT_FAILED' })
    }
  })

  fastify.post('/demo/reset', {
    preHandler: requireRole('admin')
  }, async (request, reply) => {
    try {
      return await resetDemoData(getOrgId(request), request.user!.userId)
    } catch (err: any) {
      if (err instanceof DemoDataConflictError) {
        return reply.code(409).send({ error: err.message, code: err.code, dependencies: err.dependencies })
      }
      request.log.error(err, 'Failed to reset demo data')
      return reply.code(500).send({ error: 'Demo data could not be reset', code: 'DEMO_RESET_FAILED' })
    }
  })

  fastify.delete('/demo', {
    preHandler: requireRole('admin')
  }, async (request, reply) => {
    try {
      return await removeDemoData(getOrgId(request))
    } catch (err: any) {
      if (err instanceof DemoDataConflictError) {
        return reply.code(409).send({ error: err.message, code: err.code, dependencies: err.dependencies })
      }
      request.log.error(err, 'Failed to remove demo data')
      return reply.code(500).send({ error: 'Demo data could not be removed', code: 'DEMO_DELETE_FAILED' })
    }
  })

  fastify.post('/reopen', async (request) => {
    const orgId = getOrgId(request)
    await Organization.findByIdAndUpdate(orgId, {
      $set: { 'settings.wizardCompleted': false }
    })
    return { success: true }
  })
}

export default getStartedRoutes
