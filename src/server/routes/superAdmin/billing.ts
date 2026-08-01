import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Organization } from '../../../models/Organization'
import { AuditLog } from '../../../models/AuditLog'
import { PLANS, type PlanKey } from '../../config/plans'

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/billing/overview', async () => {
    const statusCounts = await Organization.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$billing.status', 'free'] },
          count: { $sum: 1 }
        }
      }
    ])

    const byStatus: Record<string, number> = {
      free: 0,
      trialing: 0,
      active: 0,
      past_due: 0,
      canceled: 0
    }
    statusCounts.forEach((s: { _id: string; count: number }) => {
      if (s._id in byStatus) byStatus[s._id] = s.count
    })

    const recentChanges = await AuditLog.find({
      $or: [
        { entityType: 'Organization', action: 'update', 'details.plan': { $exists: true } },
        { entityType: 'Billing' }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(15)
      .lean()

    return { byStatus, recentChanges }
  })

  fastify.get('/billing/orgs/:id', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const org = await Organization.findById(id)
      .select('name slug plan billing')
      .lean()

    if (!org) {
      return reply.code(404).send({ error: 'Organization not found', code: 'NOT_FOUND' })
    }

    const billing = (org as any).billing || {}
    const plan = ((org as any).plan as PlanKey) || 'free'
    const planDef = PLANS[plan]

    let trialDaysRemaining: number | null = null
    if (billing.status === 'trialing' && billing.trialEndsAt) {
      const msRemaining = new Date(billing.trialEndsAt).getTime() - Date.now()
      trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
    }

    let periodDaysRemaining: number | null = null
    if (billing.currentPeriodEnd) {
      const msRemaining = new Date(billing.currentPeriodEnd).getTime() - Date.now()
      periodDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
    }

    return {
      orgId: id,
      orgName: org.name,
      slug: (org as any).slug,
      plan,
      planName: planDef?.name || plan,
      pricing: planDef?.pricing || null,
      billing: {
        status: billing.status || 'free',
        interval: billing.interval || 'monthly',
        trialStartedAt: billing.trialStartedAt,
        trialEndsAt: billing.trialEndsAt,
        trialDaysRemaining,
        trialWarningsSent: billing.trialWarningsSent || [],
        currentPeriodStart: billing.currentPeriodStart,
        currentPeriodEnd: billing.currentPeriodEnd,
        periodDaysRemaining,
        lastPaymentAt: billing.lastPaymentAt,
        lastInvoiceId: billing.lastInvoiceId ? '[exists]' : null,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd || false,
        canceledAt: billing.canceledAt,
        hasQontoClient: !!billing.qontoClientId
      }
    }
  })

  fastify.get('/billing/trials', async () => {
    const trials = await Organization.find({
      'billing.status': 'trialing'
    })
      .select('name slug plan billing.trialStartedAt billing.trialEndsAt billing.interval createdAt')
      .sort({ 'billing.trialEndsAt': 1 })
      .lean()

    const now = Date.now()

    return {
      total: trials.length,
      data: trials.map(org => {
        const billing = (org as any).billing || {}
        const endsAt = billing.trialEndsAt ? new Date(billing.trialEndsAt).getTime() : 0
        const daysRemaining = Math.max(0, Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24)))

        return {
          _id: org._id,
          name: org.name,
          slug: (org as any).slug,
          plan: (org as any).plan,
          trialStartedAt: billing.trialStartedAt,
          trialEndsAt: billing.trialEndsAt,
          daysRemaining,
          isExpiringSoon: daysRemaining <= 3,
          createdAt: (org as any).createdAt
        }
      })
    }
  })

  fastify.get('/billing/past-due', async () => {
    const pastDue = await Organization.find({
      'billing.status': 'past_due'
    })
      .select('name slug plan billing.currentPeriodEnd billing.lastPaymentAt billing.interval createdAt')
      .sort({ 'billing.currentPeriodEnd': 1 })
      .lean()

    const now = Date.now()

    return {
      total: pastDue.length,
      data: pastDue.map(org => {
        const billing = (org as any).billing || {}
        const periodEnd = billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).getTime() : 0
        const daysOverdue = periodEnd ? Math.max(0, Math.ceil((now - periodEnd) / (1000 * 60 * 60 * 24))) : 0

        return {
          _id: org._id,
          name: org.name,
          slug: (org as any).slug,
          plan: (org as any).plan,
          interval: billing.interval || 'monthly',
          currentPeriodEnd: billing.currentPeriodEnd,
          lastPaymentAt: billing.lastPaymentAt,
          daysOverdue,
          createdAt: (org as any).createdAt
        }
      })
    }
  })
}

export default billingRoutes
