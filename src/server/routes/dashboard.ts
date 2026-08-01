import { FastifyPluginAsync } from 'fastify'
import mongoose from 'mongoose'
import { Hardware } from '../../models/Hardware'
import { Status } from '../../models/Status'
import { MaintenanceRecord } from '../../models/MaintenanceRecord'
import { Employee } from '../../models/Employee'
import { Assignment } from '../../models/Assignment'
import { Audit } from '../../models/Audit'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Consumable } from '../../models/Consumable'
import { AuditLog } from '../../models/AuditLog'
import { authenticate } from '../middleware/auth'
import { getTenantFilter } from '../middleware/tenantScope'

function getAggregateFilter(request: import('fastify').FastifyRequest) {
  const tf = getTenantFilter(request)
  return { orgId: new mongoose.Types.ObjectId(tf.orgId) }
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/stats', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const aggFilter = getAggregateFilter(request)
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)


    const [
      statusEntries,
      categoryBreakdown,
      dueForReturn,
      overdueReturn,
      upcomingAudits,
      overdueAudits,
      expiringWarranties,
      expiredWarranties,
      expiringLicenses,
      expiredLicenses,
      lowStockCount,
      openMaintenance,
      pendingOffboarding,
      totalDevices,
      totalAssetValue,
      assignedDevices,
      totalEmployees,
      activeAssignments,
      recentActivity
    ] = await Promise.all([
      Hardware.aggregate([
        { $match: { ...aggFilter, deletedAt: null } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } }
      ]),

      Hardware.aggregate([
        { $match: { ...aggFilter, deletedAt: null } },
        { $group: { _id: '$categoryId', count: { $sum: 1 }, totalValue: { $sum: '$purchasePrice' } } },
        { $sort: { count: -1 } }
      ]),

      Assignment.countDocuments({
        ...tenantFilter,
        status: 'pendingReturn',
        returnRequestedAt: { $gte: now }
      }),

      Assignment.countDocuments({
        ...tenantFilter,
        status: 'pendingReturn',
        returnRequestedAt: { $lt: now }
      }),

      Audit.countDocuments({
        ...tenantFilter,
        status: { $in: ['scheduled', 'inProgress'] },
        dueDate: { $gte: now, $lte: thirtyDays }
      }),

      Audit.countDocuments({
        ...tenantFilter,
        status: { $in: ['scheduled', 'inProgress'] },
        dueDate: { $lt: now }
      }),

      Hardware.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        warrantyExpiry: { $gte: now, $lte: ninetyDays }
      }),

      Hardware.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        warrantyExpiry: { $lt: now, $ne: null }
      }),

      SoftwareLicense.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        isActive: true,
        expirationDate: { $gte: now, $lte: thirtyDays }
      }),

      SoftwareLicense.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        isActive: true,
        expirationDate: { $lt: now, $ne: null }
      }),

      Consumable.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        isActive: true,
        $expr: { $lt: ['$totalQuantity', '$minimumQuantity'] }
      }),

      MaintenanceRecord.countDocuments({
        ...tenantFilter,
        status: { $in: ['scheduled', 'inProgress'] }
      }),

      Employee.countDocuments({
        ...tenantFilter,
        deletedAt: null,
        offboardingStatus: 'pending'
      }),

      Hardware.countDocuments({ ...tenantFilter, deletedAt: null }),

      Hardware.aggregate([
        { $match: { ...aggFilter, deletedAt: null, purchasePrice: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$purchasePrice' } } }
      ]),

      Hardware.countDocuments({ ...tenantFilter, deletedAt: null, assignedTo: { $ne: null } }),

      Employee.countDocuments({ ...tenantFilter, deletedAt: null, isActive: true }),

      Assignment.countDocuments({ ...tenantFilter, status: 'active' }),

      AuditLog.find({ ...tenantFilter, action: { $ne: 'impersonate' } })
        .sort({ timestamp: -1 })
        .limit(20)
        .select('action entityType entityId userEmail changes timestamp metadata')
        .lean()
    ])


    const statusCounts: Record<string, number> = {}
    const statusIds = statusEntries.map((s: any) => s._id).filter(Boolean)
    const statusDocs = await Status.find({ _id: { $in: statusIds } }).select('name slug type').lean()
    const statusMap = new Map(statusDocs.map(s => [String(s._id), { name: s.name, slug: (s as any).slug }]))
    for (const entry of statusEntries as any[]) {
      const status = statusMap.get(String(entry._id))
      const key = status?.slug || status?.name || 'unknown'
      statusCounts[key] = entry.count
    }

    const { Category } = await import('../../models/Category')
    const categoryIds = categoryBreakdown.map((c: any) => c._id).filter(Boolean)
    const categoryDocs = await Category.find({ _id: { $in: categoryIds } }).select('name').lean()
    const categoryMap = new Map(categoryDocs.map(c => [String(c._id), c.name]))

    const assetValue = totalAssetValue[0]?.total || 0
    const utilization = totalDevices > 0
      ? Math.round((assignedDevices / totalDevices) * 100)
      : 0

    return {
      cards: {
        dueForReturn,
        overdueReturn,
        upcomingAudits,
        overdueAudits,
        expiringWarranties,
        expiredWarranties,
        expiringLicenses,
        expiredLicenses,
        lowStockCount,
        openMaintenance,
        pendingOffboarding,
        totalDevices
      },

      statusCounts,
      categoryBreakdown: categoryBreakdown.map((c: any) => ({
        category: categoryMap.get(String(c._id)) || String(c._id),
        count: c.count,
        totalValue: c.totalValue || 0
      })),

      summary: {
        totalAssetValue: assetValue,
        utilization,
        totalEmployees,
        activeAssignments,
        totalDevices
      },

      recentActivity: recentActivity.map(a => ({
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        userEmail: a.userEmail,
        timestamp: a.timestamp,
        details: a.changes?.after ? `${Object.keys(a.changes.after).length} fields` : undefined
      })),

      totalDevices,
      warningWarranty: expiringWarranties,
      openMaintenance
    }
  })
}

export default dashboardRoutes
