import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Organization } from '../../../models/Organization'
import { User } from '../../../models/User'
import { Hardware } from '../../../models/Hardware'
import { Employee } from '../../../models/Employee'
import { SoftwareLicense } from '../../../models/SoftwareLicense'
import { Peripheral } from '../../../models/Peripheral'
import { Consumable } from '../../../models/Consumable'
import { Workflow } from '../../../models/Workflow'
import { AuditLog } from '../../../models/AuditLog'
import { dispatchPlatformEvent } from '../../services/platformNotifier'
import { sendTrialStartedEmail } from '../../services/emailService'
import { DEFAULT_ENTERPRISE_TRIAL_DAYS } from '../../services/billingService'
import { buildPlanAccessOverride } from '../../services/entitlementService'
import { escapeRegex } from '../../utils/inputSanitization'
import type { PlanKey } from '../../config/plans'



const INTEGRATION_KEYS = [
  'intune', 'autopilot', 'jamf', 'kandji',
  'personio', 'scim', 'sso', 'bamboohr',
  'googleWorkspace', 'hibob', 'mosyle', 'helpdesk'
] as const

const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/organizations', {
    schema: {
      querystring: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        plan: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
        isActive: Type.Optional(Type.Boolean()),
        billingStatus: Type.Optional(Type.String())
      })
    }
  }, async (request) => {
    const { page = 1, limit = 25, plan, search, isActive, billingStatus } = request.query as {
      page?: number
      limit?: number
      plan?: string
      search?: string
      isActive?: boolean
      billingStatus?: string
    }

    const filter: Record<string, unknown> = {}
    if (plan) filter.plan = plan
    if (isActive !== undefined) filter.isActive = isActive
    if (billingStatus) filter['billing.status'] = billingStatus
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }

    const [orgs, total] = await Promise.all([
      Organization.find(filter)
        .select('name slug plan isActive notes billing.status billing.interval billing.trialEndsAt billing.currentPeriodEnd billing.accessOverride createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Organization.countDocuments(filter)
    ])

    const orgIds = orgs.map((o) => o._id)
    const userCounts = await User.aggregate([
      { $match: { orgId: { $in: orgIds }, role: { $ne: 'superAdmin' } } },
      { $group: { _id: '$orgId', count: { $sum: 1 } } }
    ])
    const countMap = new Map(userCounts.map((u: { _id: unknown; count: number }) => [String(u._id), u.count]))

    return {
      data: orgs.map((org) => ({
        ...org,
        isActive: org.isActive ?? true,
        userCount: countMap.get(String(org._id)) ?? 0,
        billingStatus: (org as any).billing?.status || 'free'
      })),
      total,
      page,
      limit
    }
  })

  fastify.get('/organizations/:id', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }







    const SAFE_ORG_FIELDS = [
      'name', 'slug', 'ssoSlug', 'plan', 'isActive', 'notes', 'createdAt', 'updatedAt',
      'billing',
      'settings.defaultCurrency', 'settings.assetTagPrefix',
      'settings.depreciationYears', 'settings.lowStockThreshold',
      'settings.customStatuses', 'settings.customFields',
      'settings.wizardCompleted',
      ...INTEGRATION_KEYS.flatMap(key => [
        `settings.integrations.${key}.enabled`,
        `settings.integrations.${key}.lastSyncAt`,
        `settings.integrations.${key}.lastDeliveryAt`,
        `settings.integrations.${key}.syncInterval`
      ])
    ].join(' ')

    const org = await Organization.findById(id)
      .select(SAFE_ORG_FIELDS)
      .lean()

    if (!org) {
      return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })
    }

    const [
      userCount,
      activeUserCount,
      hardwareCount,
      employeeCount,
      licenseCount,
      peripheralCount,
      consumableCount,
      workflowCount,
      recentUsers,
      recentAudit
    ] = await Promise.all([
      User.countDocuments({ orgId: id, role: { $ne: 'superAdmin' } }),
      User.countDocuments({ orgId: id, role: { $ne: 'superAdmin' }, isActive: true }),
      Hardware.countDocuments({ orgId: id }),
      Employee.countDocuments({ orgId: id }),
      SoftwareLicense.countDocuments({ orgId: id }),
      Peripheral.countDocuments({ orgId: id }),
      Consumable.countDocuments({ orgId: id }),
      Workflow.countDocuments({ orgId: id }),
      User.find({ orgId: id, role: { $ne: 'superAdmin' } })
        .select('email firstName lastName role isActive lastLoginAt createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({ orgId: id })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
    ])

    const integrations = extractIntegrationStatus((org as any).settings?.integrations)

    const billing = (org as any).billing || {}

    return {
      ...org,
      counts: {
        users: userCount,
        activeUsers: activeUserCount,
        hardware: hardwareCount,
        employees: employeeCount,
        licenses: licenseCount,
        peripherals: peripheralCount,
        consumables: consumableCount,
        workflows: workflowCount
      },
      billingSnapshot: {
        status: billing.status || 'free',
        plan: (org as any).plan || 'free',
        interval: billing.interval || 'monthly',
        trialEndsAt: billing.trialEndsAt,
        trialStartedAt: billing.trialStartedAt,
        currentPeriodStart: billing.currentPeriodStart,
        currentPeriodEnd: billing.currentPeriodEnd,
        lastPaymentAt: billing.lastPaymentAt,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd || false,
        canceledAt: billing.canceledAt,
        hasQontoClient: !!billing.qontoClientId
      },
      integrations,
      recentUsers,
      recentAudit
    }
  })

  fastify.patch('/organizations/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        plan: Type.Optional(Type.Union([
          Type.Literal('free'), Type.Literal('starter'),
          Type.Literal('pro'), Type.Literal('enterprise')
        ])),
        isActive: Type.Optional(Type.Boolean()),
        notes: Type.Optional(Type.String({ maxLength: 2000 }))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { plan?: string; isActive?: boolean; notes?: string }

    const org = await Organization.findById(id)
    if (!org) return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })

    const previousPlan = org.plan as string | undefined
    const wasActive = org.isActive

    if (body.plan !== undefined) (org as unknown as Record<string, unknown>).plan = body.plan
    if (body.isActive !== undefined) (org as unknown as Record<string, unknown>).isActive = body.isActive
    if (body.notes !== undefined) (org as unknown as Record<string, unknown>).notes = body.notes
    await org.save()

    if (body.isActive === false && wasActive !== false) {
      await User.updateMany({ orgId: org._id, role: { $ne: 'superAdmin' } }, {
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      })
    }

    if (body.plan !== undefined && body.plan !== previousPlan) {
      dispatchPlatformEvent('org.planChanged', {
        orgId: String(org._id),
        orgName: org.name,
        previousPlan: previousPlan ?? 'free',
        newPlan: body.plan
      }).catch(() => { })
    }

    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      plan: (org as any).plan,
      isActive: (org as any).isActive,
      notes: (org as any).notes,
      updatedAt: (org as any).updatedAt
    }
  })





  fastify.post('/organizations/:id/enterprise-trial', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365 }))
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { days = DEFAULT_ENTERPRISE_TRIAL_DAYS } = request.body as { days?: number }
    const org = await Organization.findById(id)

    if (!org) return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })

    const currentBilling = (org as any).billing || {}
    const accessOverride = buildPlanAccessOverride('enterprise', days, {
      currentExpiresAt: currentBilling.accessOverride?.expiresAt,
      grantedBy: request.user?.userId,
      reason: 'super_admin_unlock'
    })

    await Organization.findByIdAndUpdate(id, {
      $set: {
        'billing.accessOverride': accessOverride
      }
    })

    await AuditLog.create({
      orgId: id,
      userId: request.user?.userId,
      action: 'update',
      entityType: 'Organization',
      entityId: id,
      details: {
        enterpriseAccessGranted: true,
        days,
        basePlan: (org as any).plan || 'free',
        billingStatus: currentBilling.status || 'free',
        expiresAt: accessOverride.expiresAt
      },
      timestamp: new Date()
    })

    const admins = await User.find({ orgId: id, role: 'admin', isActive: true })
      .select('email firstName')
      .lean()
    for (const admin of admins) {
      sendTrialStartedEmail(
        admin.email,
        admin.firstName || 'Nutzer',
        'Enterprise',
        days
      ).catch((err) => {
        fastify.log.error({ err }, 'Trial started email failed')
      })
    }

    return {
      orgId: id,
      effectivePlan: 'enterprise',
      basePlan: (org as any).plan || 'free',
      billingStatus: currentBilling.status || 'free',
      accessOverride: {
        plan: 'enterprise',
        grantedAt: accessOverride.grantedAt,
        expiresAt: accessOverride.expiresAt,
        daysRemaining: Math.max(0, Math.ceil((accessOverride.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      }
    }
  })

  fastify.delete('/organizations/:id/enterprise-trial', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const org = await Organization.findById(id)
    if (!org) return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })

    const currentBilling = (org as any).billing || {}
    await Organization.findByIdAndUpdate(id, {
      $unset: { 'billing.accessOverride': 1 }
    })

    await AuditLog.create({
      orgId: id,
      userId: request.user?.userId,
      action: 'update',
      entityType: 'Organization',
      entityId: id,
      details: {
        enterpriseAccessRevoked: true,
        basePlan: (org as any).plan || 'free',
        billingStatus: currentBilling.status || 'free',
        previousExpiresAt: currentBilling.accessOverride?.expiresAt
      },
      timestamp: new Date()
    })

    return {
      orgId: id,
      effectivePlan: (org as any).plan || 'free',
      billingStatus: currentBilling.status || 'free',
      accessOverride: null
    }
  })

  fastify.post('/organizations', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        adminEmail: Type.String({ format: 'email' }),
        adminFirstName: Type.String({ minLength: 1, maxLength: 100 }),
        adminLastName: Type.String({ minLength: 1, maxLength: 100 }),
        adminPassword: Type.String({ minLength: 8 }),
        plan: Type.Optional(Type.Union([
          Type.Literal('free'), Type.Literal('starter'),
          Type.Literal('pro'), Type.Literal('enterprise')
        ])),
        notes: Type.Optional(Type.String({ maxLength: 2000 }))
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      adminEmail: string
      adminFirstName: string
      adminLastName: string
      adminPassword: string
      plan?: PlanKey
      notes?: string
    }

    const existingUser = await User.findOne({ email: body.adminEmail.toLowerCase() }).lean()
    if (existingUser) {
      return reply.code(409).send({
        error: 'A user with this email already exists',
        code: 'DUPLICATE_EMAIL'
      })
    }

    const baseSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    let slug = baseSlug
    let suffix = 1
    while (await Organization.findOne({ slug }).lean()) {
      slug = `${baseSlug}-${suffix}`
      suffix++
    }

    const org = await Organization.create({
      name: body.name,
      slug,
      plan: body.plan || 'free',
      isActive: true,
      notes: body.notes
    })

    const user = new User({
      email: body.adminEmail.toLowerCase(),
      firstName: body.adminFirstName,
      lastName: body.adminLastName,
      orgId: org._id,
      companyName: body.name,
      role: 'admin',
      isActive: true,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      dataProcessingConsent: true,
      hashedPassword: 'placeholder'
    })
    await user.setPassword(body.adminPassword)
    await user.save()

    dispatchPlatformEvent('org.registered', {
      orgName: body.name,
      adminEmail: body.adminEmail,
      plan: body.plan || 'free',
      source: 'super-admin-manual',
      triggeredAt: new Date().toISOString()
    }).catch(() => { })

    return {
      organization: {
        _id: org._id,
        name: org.name,
        slug: org.slug,
        plan: (org as any).plan
      },
      adminUser: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    }
  })

  fastify.delete('/organizations/:id', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const org = await Organization.findById(id)
    if (!org) return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })

    const billing = (org as any).billing || {}
    if (billing.status === 'active') {
      return reply.code(400).send({
        error: 'Cannot delete an organization with an active subscription. Cancel the subscription first.',
        code: 'ACTIVE_SUBSCRIPTION'
      })
    }

    await Organization.findByIdAndUpdate(id, {
      isActive: false,
      notes: `${(org as any).notes || ''}\n\n[DELETED by superAdmin at ${new Date().toISOString()}]`.trim()
    })

    const deactivatedUsers = await User.updateMany(
      { orgId: id, role: { $ne: 'superAdmin' } },
      {
        $set: { isActive: false },
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      }
    )

    await AuditLog.create({
      orgId: id,
      userId: request.user?.userId,
      action: 'delete',
      entityType: 'Organization',
      entityId: id,
      details: {
        orgName: org.name,
        usersDeactivated: deactivatedUsers.modifiedCount
      },
      timestamp: new Date()
    })

    return {
      deleted: true,
      orgId: id,
      orgName: org.name,
      usersDeactivated: deactivatedUsers.modifiedCount
    }
  })
}


function extractIntegrationStatus(integrations: Record<string, any> | undefined): Record<string, { enabled: boolean; lastSyncAt?: Date }> {
  if (!integrations) return {}

  const result: Record<string, { enabled: boolean; lastSyncAt?: Date }> = {}

  for (const key of INTEGRATION_KEYS) {
    const config = integrations[key]
    if (config) {
      result[key] = {
        enabled: config.enabled || false,
        ...((config.lastSyncAt || config.lastDeliveryAt)
          ? { lastSyncAt: config.lastSyncAt || config.lastDeliveryAt }
          : {})
      }
    } else {
      result[key] = { enabled: false }
    }
  }

  return result
}

export default organizationRoutes
