import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Organization } from '../../../models/Organization'
import { User } from '../../../models/User'

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/export/organizations', {
    schema: {
      querystring: Type.Object({
        plan: Type.Optional(Type.String()),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const { plan, isActive } = request.query as { plan?: string; isActive?: boolean }

    const filter: Record<string, unknown> = {}
    if (plan) filter.plan = plan
    if (isActive !== undefined) filter.isActive = isActive

    const orgs = await Organization.find(filter)
      .select('name slug plan isActive billing.status billing.interval billing.trialEndsAt billing.currentPeriodEnd notes createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()

    const orgIds = orgs.map(o => o._id)
    const userCounts = await User.aggregate([
      { $match: { orgId: { $in: orgIds }, role: { $ne: 'superAdmin' } } },
      { $group: { _id: '$orgId', count: { $sum: 1 } } }
    ])
    const countMap = new Map(userCounts.map((u: { _id: unknown; count: number }) => [String(u._id), u.count]))

    const headers = [
      'ID', 'Name', 'Slug', 'Plan', 'Billing Status', 'Billing Interval',
      'Is Active', 'User Count', 'Trial Ends At', 'Current Period End',
      'Notes', 'Created At', 'Updated At'
    ]

    const rows = orgs.map(org => {
      const billing = (org as any).billing || {}
      return [
        String(org._id),
        escapeCsvField(org.name),
        (org as any).slug || '',
        (org as any).plan || 'free',
        billing.status || 'free',
        billing.interval || 'monthly',
        String((org as any).isActive ?? true),
        String(countMap.get(String(org._id)) ?? 0),
        billing.trialEndsAt ? new Date(billing.trialEndsAt).toISOString() : '',
        billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toISOString() : '',
        escapeCsvField((org as any).notes || ''),
        (org as any).createdAt ? new Date((org as any).createdAt).toISOString() : '',
        (org as any).updatedAt ? new Date((org as any).updatedAt).toISOString() : ''
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const filename = `organizations_${new Date().toISOString().split('T')[0]}.csv`

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv)
  })

  fastify.get('/export/users', {
    schema: {
      querystring: Type.Object({
        orgId: Type.Optional(Type.String()),
        role: Type.Optional(Type.String()),
        isActive: Type.Optional(Type.Boolean())
      })
    }
  }, async (request, reply) => {
    const { orgId, role, isActive } = request.query as {
      orgId?: string
      role?: string
      isActive?: boolean
    }

    const filter: Record<string, unknown> = {
      role: { $ne: 'superAdmin' }
    }
    if (orgId) filter.orgId = orgId
    if (role) filter.role = role
    if (isActive !== undefined) filter.isActive = isActive

    const users = await User.find(filter)
      .select('email firstName lastName role orgId companyName department isActive lastLoginAt createdAt')
      .populate('orgId', 'name slug plan')
      .sort({ createdAt: -1 })
      .lean()

    const headers = [
      'ID', 'Email', 'First Name', 'Last Name', 'Role',
      'Company', 'Department', 'Org Name', 'Org Slug', 'Org Plan',
      'Is Active', 'Last Login', 'Created At'
    ]

    const rows = users.map(user => {
      const org = (user as any).orgId as { name?: string; slug?: string; plan?: string } | null
      return [
        String(user._id),
        user.email,
        escapeCsvField(user.firstName),
        escapeCsvField(user.lastName),
        user.role,
        escapeCsvField((user as any).companyName || ''),
        escapeCsvField((user as any).department || ''),
        escapeCsvField(org?.name || ''),
        org?.slug || '',
        org?.plan || '',
        String(user.isActive ?? true),
        (user as any).lastLoginAt ? new Date((user as any).lastLoginAt).toISOString() : '',
        (user as any).createdAt ? new Date((user as any).createdAt).toISOString() : ''
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const filename = `users_${new Date().toISOString().split('T')[0]}.csv`

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv)
  })
}


function escapeCsvField(value: string): string {
  if (!value) return ''

  const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']
  let safe = value
  if (FORMULA_PREFIXES.some(p => safe.startsWith(p))) {
    safe = `'${safe}`
  }

  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export default exportRoutes
