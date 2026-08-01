
import { FastifyPluginAsync } from 'fastify'
import { Organization } from '../../models/Organization'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { createAuditEntry } from '../middleware/auditLog'
import { checkLimit, requireFeature } from '../middleware/planLimits'
import { runFullSync } from '../services/syncOrchestrator'
import { syncKandji } from '../services/syncKandji'
import { syncIntune } from '../services/syncIntune'
import { syncAutopilot } from '../services/syncAutopilot'
import { syncJamfPro, syncJamfSchool } from '../services/syncJamf'
import { syncPersonio } from '../services/syncPersonio'
import { syncBambooHR } from '../services/syncBambooHR'
import { syncGoogleWorkspace } from '../services/syncGoogleWorkspace'
import { syncHiBob } from '../services/syncHiBob'
import { syncMosyle } from '../services/syncMosyle'
import {
  encryptSensitiveFields,
  maskSensitiveFields,
  SENSITIVE_FIELDS
} from '../services/encryption'
import { isHelpdeskConfigured } from '../services/helpdeskClient'

const CONFIG_PROVIDERS = [
  'intune', 'autopilot', 'jamf', 'kandji', 'personio', 'scim', 'sso',
  'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk'
] as const

const integrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin'))

  const SYNC_COOLDOWN_MS = 5 * 60 * 1000
  const lastSyncMap = new Map<string, number>()

  function checkSyncRateLimit(orgId: string, provider: string): string | null {
    const key = `${orgId}:${provider}`
    const lastSync = lastSyncMap.get(key)
    if (lastSync) {
      const elapsed = Date.now() - lastSync
      if (elapsed < SYNC_COOLDOWN_MS) {
        const remainingSec = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)
        return `Sync rate limited. Try again in ${remainingSec}s (max 1 sync per provider every 5 minutes).`
      }
    }
    return null
  }

  function recordSyncTime(orgId: string, provider: string): void {
    lastSyncMap.set(`${orgId}:${provider}`, Date.now())
  }

  fastify.get('/', async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const integrations = org.settings?.integrations || {}
    const safeConfig: Record<string, any> = {}
    for (const p of CONFIG_PROVIDERS) {
      const cfg = (integrations as any)?.[p]
      if (cfg) {
        const plain = cfg.toObject ? cfg.toObject() : { ...cfg }
        safeConfig[p] = maskSensitiveFields(p, plain)
      } else {
        safeConfig[p] = { enabled: false }
      }
    }
    return safeConfig
  })

  fastify.patch('/', { preHandler: [checkLimit('integrations')] }, async (request, reply) => {
    const { provider, config } = request.body as { provider: string; config: Record<string, any> }
    if (!provider || !config) return reply.code(400).send({ error: 'Missing provider or config' })
    if (!(CONFIG_PROVIDERS as readonly string[]).includes(provider)) {
      return reply.code(400).send({ error: `Unknown integration provider: ${provider}` })
    }
    if (Object.prototype.hasOwnProperty.call(config, 'enabled') && typeof config.enabled !== 'boolean') {
      return reply.code(400).send({ error: 'Integration enabled must be a boolean' })
    }

    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })



    const cleanConfig = { ...config }
    for (const field of SENSITIVE_FIELDS[provider] || []) {
      const value = cleanConfig[field]
      if (typeof value === 'string' && value.startsWith('••••••••')) {
        delete cleanConfig[field]
      }
    }
    const encryptedConfig = encryptSensitiveFields(provider, cleanConfig)
    const integrations = (org.settings as any)?.integrations || {}
    const current = integrations[provider] || {}
    Object.assign(current, encryptedConfig)



    for (const field of SENSITIVE_FIELDS[provider] || []) {
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

    if (!org.settings) (org as any).settings = {}
    if (!(org.settings as any).integrations) (org.settings as any).integrations = {}
    ;(org.settings as any).integrations[provider] = current
    org.markModified(`settings.integrations.${provider}`)
    await org.save()

    await createAuditEntry(request, 'update', 'Organization', org._id.toString(), {
      after: { action: `update_integration_${provider}`, fields: Object.keys(encryptedConfig) }
    })

    const saved = (org.settings as any).integrations[provider]
    const plain = saved?.toObject ? saved.toObject() : { ...saved }
    return maskSensitiveFields(provider, plain)
  })

  fastify.post('/sync', async (request, reply) => {
    const orgId = getOrgId(request)

    try {
      const result = await runFullSync(orgId)

      await createAuditEntry(request, 'update', 'Organization', orgId, {
        after: { action: 'full_sync', results: result.results.map(r => r.provider) }
      })

      return result
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.post('/sync/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const orgId = getOrgId(request)

    const syncMap: Record<string, () => Promise<any>> = {
      'kandji': () => syncKandji(orgId),
      'intune': () => syncIntune(orgId),
      'autopilot': () => syncAutopilot(orgId),
      'jamf-pro': () => syncJamfPro(orgId),
      'jamf-school': () => syncJamfSchool(orgId),
      'personio': () => syncPersonio(orgId),
      'bamboohr': () => syncBambooHR(orgId),
      'google-workspace': () => syncGoogleWorkspace(orgId),
      'hibob': () => syncHiBob(orgId),
      'mosyle': () => syncMosyle(orgId)
    }

    const syncFn = syncMap[provider]
    if (!syncFn) {
      return reply.code(400).send({ error: `Unknown provider: ${provider}. Valid: ${Object.keys(syncMap).join(', ')}` })
    }

    const rateLimitError = checkSyncRateLimit(orgId, provider)
    if (rateLimitError) {
      return reply.code(429).send({ error: rateLimitError, code: 'RATE_LIMITED' })
    }

    try {
      recordSyncTime(orgId, provider)
      const result = await syncFn()

      await createAuditEntry(request, 'update', 'Organization', orgId, {
        after: { action: `sync_${provider}`, created: result.created, updated: result.updated }
      })

      return result
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.get('/status', async (request, reply) => {
    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const integrations = org.settings?.integrations
    return {
      kandji: {
        enabled: integrations?.kandji?.enabled || false,
        lastSyncAt: integrations?.kandji?.lastSyncAt || null
      },
      intune: {
        enabled: integrations?.intune?.enabled || false,
        lastSyncAt: integrations?.intune?.lastSyncAt || null
      },
      jamf: {
        enabled: integrations?.jamf?.enabled || false,
        lastSyncAt: integrations?.jamf?.lastSyncAt || null
      },
      scim: {
        enabled: integrations?.scim?.enabled || false
      },
      personio: {
        enabled: integrations?.personio?.enabled || false,
        lastSyncAt: integrations?.personio?.lastSyncAt || null
      },
      sso: {
        enabled: integrations?.sso?.enabled || false
      },
      bamboohr: {
        enabled: integrations?.bamboohr?.enabled || false,
        lastSyncAt: integrations?.bamboohr?.lastSyncAt || null
      },
      googleWorkspace: {
        enabled: integrations?.googleWorkspace?.enabled || false,
        lastSyncAt: integrations?.googleWorkspace?.lastSyncAt || null
      },
      hibob: {
        enabled: integrations?.hibob?.enabled || false,
        lastSyncAt: integrations?.hibob?.lastSyncAt || null
      },
      mosyle: {
        enabled: integrations?.mosyle?.enabled || false,
        lastSyncAt: integrations?.mosyle?.lastSyncAt || null
      }
    }
  })

  fastify.post('/scim/generate-token', { preHandler: [requireFeature('scim')] }, async (request, reply) => {
    const { encrypt, generateSecureToken } = await import('../services/encryption')
    const crypto = await import('crypto')

    const org = await Organization.findById(getOrgId(request))
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const plainToken = generateSecureToken(32)
    const encryptedToken = encrypt(plainToken)
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

    return { token: plainToken, message: 'Token generated successfully.' }
  })

  fastify.get('/scim/reveal-token', async (request, reply) => {
    const { decrypt } = await import('../services/encryption')

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

export default integrationRoutes
