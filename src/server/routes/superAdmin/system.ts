import { FastifyPluginAsync } from 'fastify'
import mongoose from 'mongoose'
import { Organization } from '../../../models/Organization'

const systemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/system/health', async () => {
    const mem = process.memoryUsage()
    const dbState = mongoose.connection.readyState

    const dbStates: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }

    return {
      status: dbState === 1 ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      uptimeFormatted: formatUptime(process.uptime()),
      memory: {
        rss: formatBytes(mem.rss),
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        external: formatBytes(mem.external),
        rawBytes: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external
        }
      },
      db: {
        status: dbStates[dbState] || 'unknown',
        name: mongoose.connection.name || 'unknown'
      },
      timestamp: new Date().toISOString()
    }
  })

  fastify.get('/system/db-stats', async (_request, reply) => {
    const db = mongoose.connection.db
    if (!db) {
      return reply.code(503).send({
        error: 'Database not connected',
        code: 'DB_UNAVAILABLE'
      })
    }

    try {
      const collections = await db.listCollections().toArray()
      const stats = []

      for (const col of collections) {
        try {
          const collStats = await db.collection(col.name).stats()
          stats.push({
            name: col.name,
            count: collStats.count,
            avgObjSize: collStats.avgObjSize || 0,
            storageSize: collStats.storageSize || 0,
            storageSizeFormatted: formatBytes(collStats.storageSize || 0),
            totalIndexSize: collStats.totalIndexSize || 0,
            indexCount: collStats.nindexes || 0
          })
        } catch {
          stats.push({
            name: col.name,
            count: 0,
            avgObjSize: 0,
            storageSize: 0,
            storageSizeFormatted: '0 B',
            totalIndexSize: 0,
            indexCount: 0
          })
        }
      }

      stats.sort((a, b) => b.count - a.count)

      const totalDocuments = stats.reduce((sum, s) => sum + s.count, 0)
      const totalStorage = stats.reduce((sum, s) => sum + s.storageSize, 0)

      return {
        dbName: mongoose.connection.name,
        totalCollections: stats.length,
        totalDocuments,
        totalStorage,
        totalStorageFormatted: formatBytes(totalStorage),
        collections: stats
      }
    } catch {
      return reply.code(500).send({
        error: 'Failed to fetch database statistics',
        code: 'DB_STATS_ERROR'
      })
    }
  })

  fastify.get('/system/integrations', async () => {


    const selectFields = ['name', 'slug']
    const INTEGRATION_KEYS = [
      'intune', 'autopilot', 'jamf', 'kandji',
      'personio', 'scim', 'sso', 'bamboohr',
      'googleWorkspace', 'hibob', 'mosyle', 'helpdesk'
    ]
    for (const key of INTEGRATION_KEYS) {
      selectFields.push(`settings.integrations.${key}.enabled`)
      selectFields.push(`settings.integrations.${key}.lastSyncAt`)
      selectFields.push(`settings.integrations.${key}.lastDeliveryAt`)
    }

    const orgs = await Organization.find({
      $or: INTEGRATION_KEYS.map(key => ({ [`settings.integrations.${key}.enabled`]: true }))
    })
      .select(selectFields.join(' '))
      .lean()


    const summary: Record<string, { enabled: number; lastSyncAgo?: string }> = {}
    for (const key of INTEGRATION_KEYS) {
      summary[key] = { enabled: 0 }
    }

    const orgDetails = orgs.map(org => {
      const integrations = (org as any).settings?.integrations || {}
      const active: Array<{ name: string; lastSyncAt?: Date; stale: boolean }> = []

      for (const key of INTEGRATION_KEYS) {
        const config = integrations[key]
        if (config?.enabled) {
          summary[key].enabled++

          const lastActivityAt = config.lastSyncAt || config.lastDeliveryAt
          const lastSync = lastActivityAt ? new Date(lastActivityAt) : null
          const stale = lastSync
            ? (Date.now() - lastSync.getTime()) > 24 * 60 * 60 * 1000
            : true

          active.push({
            name: key,
            lastSyncAt: lastSync || undefined,
            stale
          })
        }
      }

      return {
        orgId: org._id,
        orgName: org.name,
        slug: (org as any).slug,
        activeIntegrations: active
      }
    })

    return {
      totalOrgsWithIntegrations: orgs.length,
      summary,
      organizations: orgDetails
    }
  })
}


function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export default systemRoutes
