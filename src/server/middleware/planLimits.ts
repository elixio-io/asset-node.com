
import { FastifyRequest, FastifyReply } from 'fastify'
import { Organization } from '../../models/Organization'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { User } from '../../models/User'
import { Workflow } from '../../models/Workflow'
import {
  type PlanKey,
  type PlanLimits,
  getLimits,
  isPlanAtLeast,
  isLimitReached,
  requiredPlanFor,
  PLANS,
} from '../config/plans'
import { resolveEffectivePlan } from '../services/entitlementService'


async function getOrgPlan(request: FastifyRequest): Promise<{ plan: PlanKey; orgId: string; billing: any }> {
  const user = (request as any).user
  if (!user?.orgId) {
    throw { statusCode: 401, message: 'Not authenticated' }
  }

  const org = await Organization.findById(user.orgId).select('plan billing').lean()
  if (!org) {
    throw { statusCode: 404, message: 'Organization not found' }
  }

  const billing = (org as any).billing || {}
  const now = new Date()
  const effectivePlan = resolveEffectivePlan((org.plan as PlanKey) || 'free', billing, now)

  if (billing.status === 'trialing' && billing.trialEndsAt && new Date(billing.trialEndsAt) <= now) {
    const downgrade = await Organization.updateOne({
      _id: user.orgId,
      'billing.status': 'trialing',
      'billing.trialEndsAt': { $lte: now },
      $or: [
        { 'billing.lastPaymentAt': { $exists: false } },
        { 'billing.lastPaymentAt': null }
      ]
    }, {
      $set: { plan: 'free', 'billing.status': 'free' }
    })
    if (downgrade.modifiedCount === 1) {
      return {
        plan: effectivePlan,
        orgId: user.orgId,
        billing: { ...billing, status: 'free' }
      }
    }



    const current = await Organization.findById(user.orgId).select('plan billing').lean()
    if (!current) throw { statusCode: 404, message: 'Organization not found' }
    const currentBilling = (current as any).billing || {}
    return {
      plan: resolveEffectivePlan(((current as any).plan as PlanKey) || 'free', currentBilling, now),
      orgId: user.orgId,
      billing: currentBilling
    }
  }

  return {
    plan: effectivePlan,
    orgId: user.orgId,
    billing,
  }
}








export function requirePlan(minimumPlan: PlanKey) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { plan } = await getOrgPlan(request)

    if (!isPlanAtLeast(plan, minimumPlan)) {
      return reply.code(403).send({
        error: 'Upgrade required',
        code: 'PLAN_UPGRADE_REQUIRED',
        currentPlan: plan,
        requiredPlan: minimumPlan,
        message: `This feature requires the ${PLANS[minimumPlan].name} plan or higher.`,
      })
    }
  }
}








export function requireFeature(feature: 'api' | 'scim' | 'sso') {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { plan } = await getOrgPlan(request)
    const limits = getLimits(plan)

    if (!limits[feature]) {
      const required = requiredPlanFor(feature)
      return reply.code(403).send({
        error: 'Feature not available',
        code: 'FEATURE_NOT_AVAILABLE',
        currentPlan: plan,
        requiredPlan: required,
        feature,
        message: `${feature.toUpperCase()} requires the ${PLANS[required].name} plan or higher.`,
      })
    }
  }
}









export function checkLimit(resource: 'assets' | 'users' | 'integrations' | 'workflows' | 'customFields') {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { plan, orgId } = await getOrgPlan(request)
    const limits = getLimits(plan)
    const limit = limits[resource]

    if (limit === -1) return

    let current = 0
    switch (resource) {
      case 'assets': {
        const [hw, per] = await Promise.all([
          Hardware.countDocuments({ orgId, deletedAt: null }),
          Peripheral.countDocuments({ orgId, deletedAt: null }),
        ])
        current = hw + per
        break
      }
      case 'users':
        current = await User.countDocuments({ orgId })
        break
      case 'workflows':
        current = await Workflow.countDocuments({ orgId })
        break
      case 'customFields': {
        const org = await Organization.findById(orgId).select('settings.customFields').lean()
        current = (org as any)?.settings?.customFields?.length || 0
        break
      }
      case 'integrations': {
        const org = await Organization.findById(orgId).select('settings.integrations').lean()
        const ints = (org as any)?.settings?.integrations || {}
        const body = (request.body || {}) as any
        const provider = typeof body.provider === 'string' ? body.provider : ''
        if (provider && body.config && typeof body.config === 'object') {
          const alreadyEnabled = ints[provider]?.enabled === true
          const enabling = body.config.enabled === true



          if (alreadyEnabled || !enabling) return
        }
        current = Object.values(ints).filter((i: any) => i?.enabled === true).length
        break
      }
    }

    if (isLimitReached(current, limit as number)) {
      const planOrder: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']
      const currentIdx = planOrder.indexOf(plan)
      const upgradeTo = planOrder.slice(currentIdx + 1).find(p => {
        const l = getLimits(p)[resource]
        return l === -1 || (typeof l === 'number' && l > (limit as number))
      }) || 'enterprise'

      return reply.code(403).send({
        error: 'Plan limit reached',
        code: 'PLAN_LIMIT_REACHED',
        resource,
        current,
        limit,
        currentPlan: plan,
        upgradeTo,
        message: `You've reached the ${resource} limit (${current}/${limit}) for the ${PLANS[plan].name} plan. Upgrade to ${PLANS[upgradeTo].name} for more.`,
      })
    }
  }
}






export async function getOrgUsageSummary(orgId: string, plan: PlanKey) {
  const limits = getLimits(plan)

  const [hardwareCount, peripheralCount, userCount, workflowCount, org] = await Promise.all([
    Hardware.countDocuments({ orgId, deletedAt: null }),
    Peripheral.countDocuments({ orgId, deletedAt: null }),
    User.countDocuments({ orgId }),
    Workflow.countDocuments({ orgId }),
    Organization.findById(orgId).select('settings.customFields settings.integrations').lean(),
  ])

  const customFieldCount = (org as any)?.settings?.customFields?.length || 0
  const integrations = (org as any)?.settings?.integrations || {}
  const integrationCount = Object.values(integrations).filter((i: any) => i?.enabled === true).length

  return {
    assets: { current: hardwareCount + peripheralCount, limit: limits.assets },
    users: { current: userCount, limit: limits.users },
    integrations: { current: integrationCount, limit: limits.integrations },
    workflows: { current: workflowCount, limit: limits.workflows },
    customFields: { current: customFieldCount, limit: limits.customFields },
    features: {
      api: limits.api,
      scim: limits.scim,
      sso: limits.sso,
      reports: limits.reports,
    },
  }
}
