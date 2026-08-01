import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Organization } from '../../models/Organization'
import { User } from '../../models/User'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Status } from '../../models/Status'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { getOrgId, getTenantFilter } from '../middleware/tenantScope'
import { checkLimit, requireFeature } from '../middleware/planLimits'
import {
  encrypt,
  decrypt,
  encryptSensitiveFields,
  maskSensitiveFields,
  generateSecureToken,
  SENSITIVE_FIELDS
} from '../services/encryption'
import { isHelpdeskConfigured } from '../services/helpdeskClient'
import { SSO_LOGIN_AVAILABLE, validateSsoConfiguration } from '../services/sso'

export function publicOrganization(org: any) {
  const source = org.toObject ? org.toObject() : org
  const result = { ...source }
  if (source.settings) {
    result.settings = { ...source.settings }
    delete result.settings.integrations
  }
  return result
}

export function auditableOrganizationSettings(org: any) {
  const settings = org.settings || {}
  const smartAutomations = settings.smartAutomations || {}
  return {
    name: org.name,
    settings: {
      defaultCurrency: settings.defaultCurrency,
      depreciationYears: settings.depreciationYears,
      lowStockThreshold: settings.lowStockThreshold,
      smartAutomations: {
        returnReminders: smartAutomations.returnReminders,
        onboardingEmails: smartAutomations.onboardingEmails,
        offboardingCleanup: smartAutomations.offboardingCleanup
      }
    }
  }
}

const orgSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin'))

  fastify.get('/', async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    if (!org.ssoSlug) {
      await org.save()
    }



    return publicOrganization(org)
  })

  fastify.patch('/', {
    schema: {
      body: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        settings: Type.Optional(Type.Object({
          defaultCurrency: Type.Optional(Type.String()),
          depreciationYears: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
          lowStockThreshold: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
          smartAutomations: Type.Optional(Type.Object({
            returnReminders: Type.Optional(Type.Object({
              enabled: Type.Optional(Type.Boolean()),
              daysBefore: Type.Optional(Type.Number())
            })),
            onboardingEmails: Type.Optional(Type.Object({
              enabled: Type.Optional(Type.Boolean())
            })),
            offboardingCleanup: Type.Optional(Type.Object({
              enabled: Type.Optional(Type.Boolean())
            }))
          }))
        }))
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      name?: string
      settings?: {
        defaultCurrency?: string
        depreciationYears?: number
        lowStockThreshold?: number
        smartAutomations?: any
      }
    }

    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })




    const before = auditableOrganizationSettings(org)

    if (body.name) org.name = body.name
    if (body.settings) {
      if (body.settings.defaultCurrency) org.set('settings.defaultCurrency', body.settings.defaultCurrency)
      if (body.settings.depreciationYears != null) org.set('settings.depreciationYears', body.settings.depreciationYears)
      if (body.settings.lowStockThreshold != null) org.set('settings.lowStockThreshold', body.settings.lowStockThreshold)
      if (body.settings.smartAutomations != null) {
        const sa = body.settings.smartAutomations
        if (sa.returnReminders) {
          org.set('settings.smartAutomations.returnReminders', {
            ...(org.settings as any)?.smartAutomations?.returnReminders,
            ...sa.returnReminders
          })
        }
        if (sa.onboardingEmails) {
          org.set('settings.smartAutomations.onboardingEmails', {
            ...(org.settings as any)?.smartAutomations?.onboardingEmails,
            ...sa.onboardingEmails
          })
        }
        if (sa.offboardingCleanup) {
          org.set('settings.smartAutomations.offboardingCleanup', {
            ...(org.settings as any)?.smartAutomations?.offboardingCleanup,
            ...sa.offboardingCleanup
          })
        }
      }
    }

    await org.save()

    await createAuditEntry(request, 'update', 'Organization', String(org._id), {
      before,
      after: auditableOrganizationSettings(org)
    })



    return publicOrganization(org)
  })


  fastify.post('/custom-statuses', {
    schema: {
      body: Type.Object({
        status: Type.String({ minLength: 1, maxLength: 50 })
      })
    }
  }, async (request, reply) => {
    const { status } = request.body as { status: string }
    const slug = status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const orgId = getOrgId(request)
    const org = await Organization.findById(orgId)
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const existing = org.settings?.customStatuses || []
    if (existing.includes(slug)) {
      return reply.code(409).send({ error: 'Status already exists' })
    }

    await Organization.findByIdAndUpdate(orgId, {
      $push: { 'settings.customStatuses': slug }
    })

    return { customStatuses: [...existing, slug] }
  })

  fastify.delete('/custom-statuses/:status', {
    schema: { params: Type.Object({ status: Type.String() }) }
  }, async (request, _reply) => {
    const { status } = request.params as { status: string }
    const orgId = getOrgId(request)

    await Organization.findByIdAndUpdate(orgId, {
      $pull: { 'settings.customStatuses': status }
    })

    const org = await Organization.findById(orgId)
    return { customStatuses: org?.settings?.customStatuses || [] }
  })


  fastify.post('/custom-fields', {
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 100 }),
        fieldType: Type.Union([
          Type.Literal('text'), Type.Literal('number'),
          Type.Literal('date'), Type.Literal('boolean'),
          Type.Literal('select')
        ]),
        required: Type.Optional(Type.Boolean()),
        options: Type.Optional(Type.Array(Type.String()))
      })
    }
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      fieldType: string
      required?: boolean
      options?: string[]
    }

    const orgId = getOrgId(request)
    const org = await Organization.findById(orgId)
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const existingFields = org.settings?.customFields || []
    const duplicate = existingFields.find(
      (f) => f.name.toLowerCase() === body.name.toLowerCase()
    )
    if (duplicate) {
      return reply.code(409).send({ error: `Custom field "${body.name}" already exists` })
    }

    await Organization.findByIdAndUpdate(orgId, {
      $push: { 'settings.customFields': body }
    })

    const updated = await Organization.findById(orgId)
    return { customFields: updated?.settings?.customFields || [] }
  })

  fastify.delete('/custom-fields/:name', {
    schema: { params: Type.Object({ name: Type.String() }) }
  }, async (request, _reply) => {
    const { name } = request.params as { name: string }
    const orgId = getOrgId(request)

    await Organization.findByIdAndUpdate(orgId, {
      $pull: { 'settings.customFields': { name: decodeURIComponent(name) } }
    })

    const org = await Organization.findById(orgId)
    return { customFields: org?.settings?.customFields || [] }
  })

  fastify.get('/low-stock', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const org = await Organization.findById(getOrgId(request))
    const threshold = org?.settings?.lowStockThreshold ?? 3

    const deployableStatuses = await Status.find({ ...tenantFilter, type: 'deployable' }).select('_id').lean()
    const deployableIds = deployableStatuses.map(s => s._id)

    const hardwareLowStock = await Hardware.aggregate([
      { $match: { ...tenantFilter, statusId: { $in: deployableIds }, deletedAt: null } },
      {
        $group: {
          _id: '$categoryId',
          availableCount: { $sum: 1 },
          models: { $addToSet: '$model' }
        }
      },
      { $match: { availableCount: { $lte: threshold } } },
      { $sort: { availableCount: 1 } }
    ])

    const peripheralLowStock = await Peripheral.aggregate([
      { $match: { ...tenantFilter, statusId: { $in: deployableIds }, deletedAt: null } },
      {
        $group: {
          _id: '$type',
          availableCount: { $sum: 1 },
          models: { $addToSet: '$model' }
        }
      },
      { $match: { availableCount: { $lte: threshold } } },
      { $sort: { availableCount: 1 } }
    ])

    return {
      threshold,
      hardware: hardwareLowStock.map(a => ({
        category: a._id,
        available: a.availableCount,
        models: a.models
      })),
      peripherals: peripheralLowStock.map(a => ({
        type: a._id,
        available: a.availableCount,
        models: a.models
      })),
      totalAlerts: hardwareLowStock.length + peripheralLowStock.length
    }
  })

  fastify.get('/integrations', async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const raw = (org.settings as any)?.integrations || {}
    const masked: Record<string, any> = {}

    for (const provider of Object.keys(raw)) {
      const obj = raw[provider]?.toObject ? raw[provider].toObject() : { ...raw[provider] }
      masked[provider] = maskSensitiveFields(provider, obj)
    }

    return masked
  })

  fastify.patch('/integrations', {
    preHandler: [checkLimit('integrations')],
    schema: {
      body: Type.Object({
        provider: Type.String(),
        config: Type.Record(Type.String(), Type.Any())
      })
    }
  }, async (request, reply) => {
    const { provider, config } = request.body as { provider: string; config: Record<string, unknown> }

    const VALID_PROVIDERS = ['intune', 'autopilot', 'jamf', 'kandji', 'personio', 'scim', 'sso', 'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk']
    if (!VALID_PROVIDERS.includes(provider)) {
      return reply.code(400).send({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` })
    }

    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const sensitiveFields = SENSITIVE_FIELDS[provider] || []
    const cleanConfig = { ...config }
    for (const field of sensitiveFields) {
      const val = cleanConfig[field]
      if (typeof val === 'string' && val.startsWith('••••••••')) {
        delete cleanConfig[field]
      }
    }

    const encryptedConfig = encryptSensitiveFields(provider, cleanConfig)

    if (encryptedConfig.enabled === true) {
      encryptedConfig.enabledBy = request.user?.userId
      encryptedConfig.enabledAt = new Date().toISOString()
    }

    const integrations = (org.settings as any)?.integrations || {}
    const current = integrations[provider] || {}
    const wasForceSso = provider === 'sso' && current.enabled === true && current.forceSso === true
    Object.assign(current, encryptedConfig)


    for (const field of sensitiveFields) {
      const value = current[field]
      if (typeof value !== 'string' || value.length === 0) continue
      const migrated = encryptSensitiveFields(provider, { [field]: value })
      if (typeof migrated[field] === 'string') current[field] = migrated[field]
    }

    if (provider === 'helpdesk' && current.enabled === true && !isHelpdeskConfigured(current)) {
      return reply.code(400).send({
        error: 'Helpdesk requires a provider, valid tenant subdomain, API token, and a Zendesk agent email.'
      })
    }

    if (provider === 'sso') {



      if (current.enabled === true) {
        let certificate = ''
        try {
          certificate = current.certificate ? decrypt(current.certificate) : ''
        } catch {
          return reply.code(400).send({
            error: 'The configured IdP certificate cannot be decrypted.',
            code: 'INVALID_SSO_CONFIG'
          })
        }

        const validation = validateSsoConfiguration({ ...current, certificate })
        if (!validation.valid) {
          return reply.code(400).send({ error: validation.error, code: 'INVALID_SSO_CONFIG' })
        }
        current.provider = 'saml'
        current.allowedDomains = validation.normalizedDomains



        if (!SSO_LOGIN_AVAILABLE) {
          return reply.code(503).send({
            error: 'SAML sign-in cannot be enabled until a standards-complete validator is configured.',
            code: 'SSO_NOT_CONFIGURED'
          })
        }
      }
    }

    if (!org.settings) (org as any).settings = {}
    if (!(org.settings as any).integrations) (org.settings as any).integrations = {}
      ; (org.settings as any).integrations[provider] = current

    org.markModified(`settings.integrations.${provider}`)
    await org.save()

    if (provider === 'sso' && !wasForceSso && current.enabled === true && current.forceSso === true) {


      await User.updateMany({ orgId: org._id, role: { $ne: 'superAdmin' } }, {
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      })
    }

    await createAuditEntry(request, 'update', 'Organization', String(org._id), {
      after: { [`integrations.${provider}`]: '***' }
    })

    const saved = (org.settings as any).integrations[provider]
    const obj = saved?.toObject ? saved.toObject() : { ...saved }
    return maskSensitiveFields(provider, obj)
  })

  fastify.post('/integrations/scim/generate-token', { preHandler: [requireFeature('scim')] }, async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const plainToken = generateSecureToken(32)
    const encryptedToken = encrypt(plainToken)

    const crypto = await import('crypto')
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex')

    if (!org.settings) (org as any).settings = {}
    if (!(org.settings as any).integrations) (org.settings as any).integrations = {}
    if (!(org.settings as any).integrations.scim) (org.settings as any).integrations.scim = {}
    const scimConfig = (org.settings as any).integrations.scim
    scimConfig.bearerToken = encryptedToken
    scimConfig.tokenHash = tokenHash
    scimConfig.enabled = true
    if (scimConfig.provisionUsers === undefined) scimConfig.provisionUsers = true
    if (scimConfig.deprovisionUsers === undefined) scimConfig.deprovisionUsers = false

    org.markModified('settings.integrations.scim')
    await org.save()

    await createAuditEntry(request, 'update', 'Organization', String(org._id), {
      after: { 'integrations.scim.bearerToken': '*** regenerated ***' }
    })

    return {
      token: plainToken,
      message: 'Token generated successfully.'
    }
  })

  fastify.get('/integrations/scim/reveal-token', async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const encryptedToken = (org.settings as any)?.integrations?.scim?.bearerToken
    if (!encryptedToken) {
      return reply.code(404).send({ error: 'No SCIM token configured' })
    }

    try {
      const plainToken = decrypt(encryptedToken)
      return { token: plainToken }
    } catch {
      return { token: encryptedToken }
    }
  })
}

export default orgSettingsRoutes
