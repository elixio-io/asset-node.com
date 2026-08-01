import { FastifyPluginAsync } from 'fastify'
import { Organization } from '../../../models/Organization'
import { User } from '../../../models/User'
import { PLANS, type PlanKey } from '../../config/plans'

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async () => {
    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      todayOrgs,
      todayUsers,
      planCounts
    ] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $ne: 'superAdmin' } }),
      User.countDocuments({ isActive: true, role: { $ne: 'superAdmin' } }),
      Organization.countDocuments({ createdAt: { $gte: startOfDay() } }),
      User.countDocuments({ createdAt: { $gte: startOfDay() }, role: { $ne: 'superAdmin' } }),
      Organization.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ])
    ])

    const plans: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 }
    planCounts.forEach((p: { _id: string; count: number }) => {
      if (p._id) plans[p._id] = p.count
    })

    return {
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      todayOrgs,
      todayUsers,
      plans
    }
  })

  fastify.get('/stats/revenue', async () => {
    const orgs = await Organization.find({})
      .select('plan billing.status billing.interval billing.canceledAt isActive')
      .lean()

    let totalMrr = 0
    let activeSubscriptions = 0
    let trialingOrgs = 0
    let pastDueOrgs = 0
    let churnedLast30Days = 0

    const revenueByPlan: Record<string, { count: number; mrr: number }> = {
      starter: { count: 0, mrr: 0 },
      pro: { count: 0, mrr: 0 },
      enterprise: { count: 0, mrr: 0 }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    for (const org of orgs) {
      const billing = (org as any).billing || {}
      const plan = ((org as any).plan as PlanKey) || 'free'
      const status = billing.status || 'free'

      if (status === 'trialing') {
        trialingOrgs++
      }

      if (status === 'past_due') {
        pastDueOrgs++
      }

      if (status === 'canceled' && billing.canceledAt && new Date(billing.canceledAt) >= thirtyDaysAgo) {
        churnedLast30Days++
      }

      if (['active', 'trialing', 'past_due'].includes(status) && plan !== 'free') {
        const planDef = PLANS[plan]
        if (planDef?.pricing) {
          const interval = billing.interval || 'monthly'
          const monthlyRevenue = interval === 'annual'
            ? Math.round(planDef.pricing.annual / 12)
            : planDef.pricing.monthly

          totalMrr += monthlyRevenue
          activeSubscriptions++

          if (revenueByPlan[plan]) {
            revenueByPlan[plan].count++
            revenueByPlan[plan].mrr += monthlyRevenue
          }
        }
      }
    }

    return {
      mrr: totalMrr,
      arr: totalMrr * 12,
      mrrFormatted: formatCents(totalMrr),
      arrFormatted: formatCents(totalMrr * 12),
      activeSubscriptions,
      trialingOrgs,
      pastDueOrgs,
      churnedLast30Days,
      revenueByPlan
    }
  })

  fastify.get('/stats/growth', async () => {
    const now = new Date()

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [dailyOrgs, dailyUsers] = await Promise.all([
      Organization.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, role: { $ne: 'superAdmin' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ])

    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000)
    const [weeklyOrgs, weeklyUsers] = await Promise.all([
      Organization.aggregate([
        { $match: { createdAt: { $gte: twelveWeeksAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: twelveWeeksAgo }, role: { $ne: 'superAdmin' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ])

    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const [monthlyOrgs, monthlyUsers] = await Promise.all([
      Organization.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo }, role: { $ne: 'superAdmin' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ])

    return {
      daily: mergeCounts(dailyOrgs, dailyUsers),
      weekly: mergeCounts(weeklyOrgs, weeklyUsers),
      monthly: mergeCounts(monthlyOrgs, monthlyUsers)
    }
  })
}


function startOfDay(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

function mergeCounts(
  orgBuckets: Array<{ _id: string; count: number }>,
  userBuckets: Array<{ _id: string; count: number }>
): Array<{ date: string; orgs: number; users: number }> {
  const map = new Map<string, { orgs: number; users: number }>()

  for (const b of orgBuckets) {
    map.set(b._id, { orgs: b.count, users: 0 })
  }
  for (const b of userBuckets) {
    const existing = map.get(b._id) || { orgs: 0, users: 0 }
    existing.users = b.count
    map.set(b._id, existing)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
}

export default statsRoutes
