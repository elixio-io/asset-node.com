import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import mongoose from 'mongoose'
import ExcelJS from 'exceljs'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { MaintenanceRecord } from '../../models/MaintenanceRecord'
import { Assignment } from '../../models/Assignment'
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'
import { requirePlan } from '../middleware/planLimits'

function getAggregateFilter(request: import('fastify').FastifyRequest) {
  const tf = getTenantFilter(request)
  return { orgId: new mongoose.Types.ObjectId(tf.orgId) }
}

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/asset-summary', async (request) => {
    const aggFilter = getAggregateFilter(request)

    const [hardware, peripherals] = await Promise.all([
      Hardware.aggregate([
        { $match: { ...aggFilter, deletedAt: null } },
        {
          $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: '_cat' }
        },
        {
          $lookup: { from: 'statuses', localField: 'statusId', foreignField: '_id', as: '_status' }
        },
        {
          $group: {
            _id: {
              category: { $arrayElemAt: ['$_cat.name', 0] },
              status: { $arrayElemAt: ['$_status.name', 0] }
            },
            count: { $sum: 1 },
            totalValue: { $sum: '$purchasePrice' }
          }
        },
        { $sort: { '_id.category': 1, '_id.status': 1 } }
      ]),
      Peripheral.aggregate([
        { $match: { ...aggFilter, deletedAt: null } },
        {
          $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: '_cat' }
        },
        {
          $lookup: { from: 'statuses', localField: 'statusId', foreignField: '_id', as: '_status' }
        },
        {
          $group: {
            _id: {
              category: { $arrayElemAt: ['$_cat.name', 0] },
              status: { $arrayElemAt: ['$_status.name', 0] }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.category': 1 } }
      ])
    ])

    return { hardware, peripherals }
  })

  fastify.get('/depreciation', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const org = await Organization.findById(getOrgId(request))
    const usefulLife = org?.settings?.depreciationYears ?? 3

    const assets = await Hardware.find({
      ...tenantFilter,
      purchasePrice: { $gt: 0 }
    })
      .populate('categoryId', 'name')
      .sort({ purchaseDate: 1 }).lean()

    const now = new Date()
    const report = assets.map(asset => {
      const purchaseDate = asset.purchaseDate || asset.createdAt
      const ageYears = (now.getTime() - new Date(purchaseDate!).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      const annualDepreciation = (asset.purchasePrice || 0) / usefulLife
      const totalDepreciation = Math.min(annualDepreciation * ageYears, asset.purchasePrice || 0)
      const currentValue = Math.max((asset.purchasePrice || 0) - totalDepreciation, 0)

      return {
        _id: asset._id,
        serialNumber: asset.serialNumber,
        model: asset.model,
        category: (asset.categoryId as any)?.name || '',
        purchasePrice: asset.purchasePrice,
        purchaseDate: purchaseDate,
        ageYears: Math.round(ageYears * 10) / 10,
        annualDepreciation: Math.round(annualDepreciation * 100) / 100,
        totalDepreciation: Math.round(totalDepreciation * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        fullyDepreciated: ageYears >= usefulLife
      }
    })

    const totals = report.reduce((acc, r) => ({
      totalPurchaseValue: acc.totalPurchaseValue + (r.purchasePrice || 0),
      totalCurrentValue: acc.totalCurrentValue + r.currentValue,
      totalDepreciation: acc.totalDepreciation + r.totalDepreciation
    }), { totalPurchaseValue: 0, totalCurrentValue: 0, totalDepreciation: 0 })

    return { usefulLife, assets: report, totals }
  })

  fastify.get('/warranty', {
    schema: {
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 90 }))
      })
    }
  }, async (request) => {
    const { days = 90 } = request.query as { days?: number }
    const tenantFilter = getTenantFilter(request)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    const [expiringSoon, expired, noWarranty] = await Promise.all([
      Hardware.find({
        ...tenantFilter,
        warrantyExpiry: { $gte: new Date(), $lte: futureDate }
      }).sort({ warrantyExpiry: 1 }).lean(),
      Hardware.find({
        ...tenantFilter,
        warrantyExpiry: { $lt: new Date() }
      }).sort({ warrantyExpiry: -1 }).lean(),
      Hardware.countDocuments({
        ...tenantFilter,
        warrantyExpiry: { $exists: false }
      })
    ])

    return { days, expiringSoon, expired, noWarranty }
  })

  fastify.get('/maintenance-costs', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const aggFilter = getAggregateFilter(request)

    const costs = await MaintenanceRecord.aggregate([
      { $match: { ...aggFilter, cost: { $gt: 0 } } },
      {
        $group: {
          _id: {
            year: { $year: '$startDate' },
            month: { $month: '$startDate' },
            type: '$type'
          },
          totalCost: { $sum: '$cost' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ])

    const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0)

    return { costs, totalCost }
  })

  fastify.get('/export/assets', { preHandler: [requirePlan('starter')] }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)

    const [hardware, peripherals] = await Promise.all([
      Hardware.find(tenantFilter)
        .populate('categoryId', 'name')
        .populate('statusId', 'name')
        .populate('manufacturerId', 'name')
        .populate('locationId', 'name')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ serialNumber: 1 })
        .lean(),
      Peripheral.find(tenantFilter)
        .populate('categoryId', 'name')
        .populate('statusId', 'name')
        .populate('manufacturerId', 'name')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean()
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AssetNode'
    workbook.created = new Date()

    const hwSheet = workbook.addWorksheet('Hardware')
    hwSheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Manufacturer', key: 'manufacturer', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Assigned To', key: 'assignedTo', width: 25 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 14 },
      { header: 'Purchase Price (€)', key: 'purchasePrice', width: 18 },
      { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 14 },
      { header: 'Notes', key: 'notes', width: 30 }
    ]

    hwSheet.getRow(1).font = { bold: true }
    hwSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }
    }
    hwSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    for (const hw of hardware) {
      const loc = hw.locationId as unknown as { name?: string } | null
      const emp = hw.assignedTo as unknown as { firstName?: string; lastName?: string } | null
      const cat = hw.categoryId as unknown as { name?: string } | null
      const mfg = hw.manufacturerId as unknown as { name?: string } | null
      const st = hw.statusId as unknown as { name?: string } | null
      hwSheet.addRow({
        serialNumber: hw.serialNumber,
        model: hw.model,
        category: cat?.name || '',
        manufacturer: mfg?.name || '',
        status: st?.name || '',
        location: loc?.name || '',
        assignedTo: emp ? `${emp.firstName} ${emp.lastName}` : '',
        purchaseDate: hw.purchaseDate ? new Date(hw.purchaseDate).toLocaleDateString('de-DE') : '',
        purchasePrice: hw.purchasePrice || '',
        warrantyExpiry: hw.warrantyExpiry ? new Date(hw.warrantyExpiry).toLocaleDateString('de-DE') : '',
        notes: hw.notes || ''
      })
    }

    const perSheet = workbook.addWorksheet('Peripherals')
    perSheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Manufacturer', key: 'manufacturer', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Assigned To', key: 'assignedTo', width: 25 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 14 },
      { header: 'Notes', key: 'notes', width: 30 }
    ]

    perSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    perSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }
    }

    for (const p of peripherals) {
      const emp = p.assignedTo as unknown as { firstName?: string; lastName?: string } | null
      const cat = p.categoryId as unknown as { name?: string } | null
      const mfg = p.manufacturerId as unknown as { name?: string } | null
      const st = p.statusId as unknown as { name?: string } | null
      perSheet.addRow({
        serialNumber: p.serialNumber,
        category: cat?.name || '',
        model: p.model,
        manufacturer: mfg?.name || '',
        status: st?.name || '',
        assignedTo: emp ? `${emp.firstName} ${emp.lastName}` : '',
        purchaseDate: p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('de-DE') : '',
        notes: p.notes || ''
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(Buffer.from(buffer as ArrayBuffer))
  })

  fastify.get('/export/depreciation', { preHandler: [requirePlan('starter')] }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const org = await Organization.findById(getOrgId(request))
    const usefulLife = org?.settings?.depreciationYears ?? 3
    const now = new Date()

    const assets = await Hardware.find({
      ...tenantFilter,
      purchasePrice: { $gt: 0 },
    })
      .populate('categoryId', 'name')
      .sort({ purchaseDate: 1 }).lean()

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Depreciation')
    sheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Purchase Price (€)', key: 'purchasePrice', width: 18 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 14 },
      { header: 'Age (Years)', key: 'ageYears', width: 12 },
      { header: 'Annual Depreciation (€)', key: 'annualDepreciation', width: 22 },
      { header: 'Total Depreciation (€)', key: 'totalDepreciation', width: 22 },
      { header: 'Current Value (€)', key: 'currentValue', width: 18 },
      { header: 'Fully Depreciated', key: 'fullyDepreciated', width: 16 }
    ]

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF27AE60' }
    }

    for (const asset of assets) {
      const purchaseDate = asset.purchaseDate || asset.createdAt
      const ageYears = (now.getTime() - new Date(purchaseDate!).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      const annualDep = (asset.purchasePrice || 0) / usefulLife
      const totalDep = Math.min(annualDep * ageYears, asset.purchasePrice || 0)
      const currentVal = Math.max((asset.purchasePrice || 0) - totalDep, 0)

      sheet.addRow({
        serialNumber: asset.serialNumber,
        model: asset.model,
        category: (asset.categoryId as any)?.name || '',
        purchasePrice: asset.purchasePrice,
        purchaseDate: purchaseDate ? new Date(purchaseDate).toLocaleDateString('de-DE') : '',
        ageYears: Math.round(ageYears * 10) / 10,
        annualDepreciation: Math.round(annualDep * 100) / 100,
        totalDepreciation: Math.round(totalDep * 100) / 100,
        currentValue: Math.round(currentVal * 100) / 100,
        fullyDepreciated: ageYears >= usefulLife ? 'Yes' : 'No'
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `depreciation-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(Buffer.from(buffer as ArrayBuffer))
  })



  fastify.get('/due-back', {
    schema: {
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 }))
      })
    }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { days = 30 } = request.query as { days?: number }

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    const assignments = await Assignment.find({
      ...tenantFilter,
      returnRequestedAt: { $exists: true, $ne: null },
      returnedAt: { $exists: false }
    })
      .populate('employeeId', 'firstName lastName email')
      .populate('hardware', 'serialNumber model category')
      .populate('peripherals', 'serialNumber model type')
      .sort({ returnRequestedAt: 1 })
      .lean()

    const now = new Date()
    const overdue = assignments.filter(a => a.returnRequestedAt && new Date(a.returnRequestedAt) < now)
    const upcoming = assignments.filter(a => a.returnRequestedAt && new Date(a.returnRequestedAt) >= now && new Date(a.returnRequestedAt) <= futureDate)

    return { days, overdue, upcoming, total: assignments.length }
  })



  fastify.get('/offboarding', {
    schema: {
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 90 }))
      })
    }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { days = 90 } = request.query as { days?: number }

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)

    const employees = await Employee.find({
      ...tenantFilter,
      isActive: false,
      endDate: { $gte: sinceDate }
    })
      .sort({ endDate: -1 })
      .lean()

    const employeeIds = employees.map(e => e._id)
    const assignments = await Assignment.find({
      ...tenantFilter,
      employeeId: { $in: employeeIds }
    })
      .populate('hardware', 'serialNumber model category status')
      .populate('peripherals', 'serialNumber model type status')
      .lean()

    const report = employees.map(emp => ({
      employee: emp,
      assignments: assignments.filter(a => a.employeeId.toString() === emp._id.toString()),
      assetsReturned: assignments
        .filter(a => a.employeeId.toString() === emp._id.toString() && a.returnedAt)
        .length,
      assetsPending: assignments
        .filter(a => a.employeeId.toString() === emp._id.toString() && !a.returnedAt)
        .length
    }))

    return { days, report, totalEmployees: employees.length }
  })



  fastify.get('/checkout-signatures', {
    schema: {
      querystring: Type.Object({
        status: Type.Optional(Type.Union([
          Type.Literal('all'),
          Type.Literal('signed'),
          Type.Literal('unsigned')
        ]))
      })
    }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { status = 'all' } = request.query as { status?: string }

    let query: any = { ...tenantFilter }
    if (status === 'signed') {
      query.acknowledgedAt = { $exists: true, $ne: null }
    } else if (status === 'unsigned') {
      query.$or = [
        { acknowledgedAt: { $exists: false } },
        { acknowledgedAt: null }
      ]
    }

    const assignments = await Assignment.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('hardware', 'serialNumber model category')
      .sort({ assignmentDate: -1 })
      .lean()

    const signed = assignments.filter(a => a.acknowledgedAt)
    const unsigned = assignments.filter(a => !a.acknowledgedAt)

    return {
      assignments: status === 'all' ? assignments : status === 'signed' ? signed : unsigned,
      summary: {
        total: assignments.length,
        signed: signed.length,
        unsigned: unsigned.length,
        signatureRate: assignments.length > 0
          ? Math.round((signed.length / assignments.length) * 100)
          : 0
      }
    }
  })



  fastify.get('/activity', {
    schema: {
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 })),
        type: Type.Optional(Type.Union([
          Type.Literal('all'),
          Type.Literal('assignment'),
          Type.Literal('return'),
          Type.Literal('maintenance')
        ]))
      })
    }
  }, async (request) => {
    const tenantFilter = getTenantFilter(request)
    const { days = 30, type = 'all' } = request.query as { days?: number; type?: string }

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)

    const events: Array<{
      type: string
      date: Date
      description: string
      employee?: string
      asset?: string
    }> = []

    if (type === 'all' || type === 'assignment') {
      const assignments = await Assignment.find({
        ...tenantFilter,
        assignmentDate: { $gte: sinceDate }
      })
        .populate('employeeId', 'firstName lastName')
        .populate('hardware', 'serialNumber model')
        .lean()

      for (const a of assignments) {
        const emp = a.employeeId as any
        const hwList = (a.hardware as any[]) || []
        events.push({
          type: 'assignment',
          date: a.assignmentDate || a.createdAt!,
          description: `${hwList.length} asset(s) assigned`,
          employee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          asset: hwList.map((h: any) => h.serialNumber || h.model).join(', ')
        })
      }
    }

    if (type === 'all' || type === 'return') {
      const returns = await Assignment.find({
        ...tenantFilter,
        returnedAt: { $gte: sinceDate }
      })
        .populate('employeeId', 'firstName lastName')
        .populate('hardware', 'serialNumber model')
        .lean()

      for (const r of returns) {
        const emp = r.employeeId as any
        const hwList = (r.hardware as any[]) || []
        events.push({
          type: 'return',
          date: r.returnedAt!,
          description: `${hwList.length} asset(s) returned`,
          employee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          asset: hwList.map((h: any) => h.serialNumber || h.model).join(', ')
        })
      }
    }

    if (type === 'all' || type === 'maintenance') {
      const records = await MaintenanceRecord.find({
        ...tenantFilter,
        startDate: { $gte: sinceDate }
      })
        .populate('hardware', 'serialNumber model')
        .lean()

      for (const m of records) {
        const hw = m.hardware as any
        events.push({
          type: 'maintenance',
          date: m.startDate,
          description: `${m.type}: ${m.description || 'No description'}`,
          asset: hw ? `${hw.serialNumber} (${hw.model})` : undefined
        })
      }
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { days, type, events, total: events.length }
  })

  fastify.get('/:type/export', {
    preHandler: [requirePlan('starter')],
    schema: {
      params: Type.Object({ type: Type.String() }),
      querystring: Type.Object({
        format: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const { format = 'csv' } = request.query as { format?: string }
    const tenantFilter = getTenantFilter(request)

    if (format === 'xlsx') {
      if (type === 'asset-summary') {
        return reply.redirect('/api/reports/export/assets')
      } else if (type === 'depreciation') {
        return reply.redirect('/api/reports/export/depreciation')
      }
    }

    let csvRows: string[][] = []
    let filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`

    switch (type) {
      case 'asset-summary': {
        const hardware = await Hardware.find({ ...tenantFilter, deletedAt: null })
          .populate('categoryId', 'name')
          .populate('statusId', 'name')
          .populate('manufacturerId', 'name')
          .populate('locationId', 'name')
          .populate('assignedTo', 'firstName lastName')
          .sort({ createdAt: -1 }).lean()

        csvRows.push(['Asset Tag', 'Serial Number', 'Model', 'Category', 'Manufacturer', 'Status', 'Location', 'Assigned To', 'Purchase Date', 'Purchase Price', 'Warranty Expiry'])
        for (const hw of hardware) {
          const cat = hw.categoryId as any
          const status = hw.statusId as any
          const mfg = hw.manufacturerId as any
          const loc = hw.locationId as any
          const emp = hw.assignedTo as any
          csvRows.push([
            hw.assetTag || '', hw.serialNumber || '', hw.model || '',
            cat?.name || '', mfg?.name || '', status?.name || '', loc?.name || '',
            emp ? `${emp.firstName} ${emp.lastName}` : '',
            hw.purchaseDate ? new Date(hw.purchaseDate).toLocaleDateString('de-DE') : '',
            String(hw.purchasePrice || ''),
            hw.warrantyExpiry ? new Date(hw.warrantyExpiry).toLocaleDateString('de-DE') : ''
          ])
        }
        break
      }
      case 'depreciation': {
        const org = await Organization.findById(getOrgId(request))
        const usefulLife = org?.settings?.depreciationYears ?? 3
        const now = new Date()
        const assets = await Hardware.find({ ...tenantFilter, purchasePrice: { $gt: 0 } }).sort({ purchaseDate: 1 }).lean()

        csvRows.push(['Serial Number', 'Model', 'Purchase Price', 'Purchase Date', 'Age (Years)', 'Annual Depreciation', 'Total Depreciation', 'Current Value', 'Fully Depreciated'])
        for (const asset of assets) {
          const purchaseDate = asset.purchaseDate || asset.createdAt
          const ageYears = (now.getTime() - new Date(purchaseDate!).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          const annualDep = (asset.purchasePrice || 0) / usefulLife
          const totalDep = Math.min(annualDep * ageYears, asset.purchasePrice || 0)
          const currentVal = Math.max((asset.purchasePrice || 0) - totalDep, 0)
          csvRows.push([
            asset.serialNumber || '', asset.model || '', String(asset.purchasePrice || 0),
            purchaseDate ? new Date(purchaseDate).toLocaleDateString('de-DE') : '',
            String(Math.round(ageYears * 10) / 10),
            String(Math.round(annualDep * 100) / 100),
            String(Math.round(totalDep * 100) / 100),
            String(Math.round(currentVal * 100) / 100),
            ageYears >= usefulLife ? 'Yes' : 'No'
          ])
        }
        break
      }
      case 'warranty': {
        const allHw = await Hardware.find({ ...tenantFilter, warrantyExpiry: { $exists: true, $ne: null } })
          .sort({ warrantyExpiry: 1 }).lean()
        const now = new Date()
        csvRows.push(['Serial Number', 'Model', 'Warranty Expiry', 'Days Remaining', 'Status'])
        for (const hw of allHw) {
          const days = Math.ceil((new Date(hw.warrantyExpiry!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          csvRows.push([
            hw.serialNumber || '', hw.model || '',
            new Date(hw.warrantyExpiry!).toLocaleDateString('de-DE'),
            String(days),
            days <= 0 ? 'Expired' : days <= 30 ? 'Expiring' : 'Active'
          ])
        }
        break
      }
      case 'due-back': {
        const assignments = await Assignment.find({ ...tenantFilter, returnRequestedAt: { $exists: true, $ne: null }, returnedAt: { $exists: false } })
          .populate('employeeId', 'firstName lastName')
          .populate('hardware', 'serialNumber model')
          .sort({ returnRequestedAt: 1 }).lean()
        csvRows.push(['Employee', 'Assets', 'Return Requested', 'Status'])
        const now = new Date()
        for (const a of assignments) {
          const emp = a.employeeId as any
          const hwList = (a.hardware as any[]) || []
          csvRows.push([
            emp ? `${emp.firstName} ${emp.lastName}` : '',
            hwList.map((h: any) => h.serialNumber || h.model).join('; '),
            a.returnRequestedAt ? new Date(a.returnRequestedAt).toLocaleDateString('de-DE') : '',
            a.returnRequestedAt && new Date(a.returnRequestedAt) < now ? 'Overdue' : 'Upcoming'
          ])
        }
        break
      }
      case 'offboarding': {
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - 90)
        const employees = await Employee.find({ ...tenantFilter, isActive: false, endDate: { $gte: sinceDate } }).sort({ endDate: -1 }).lean()
        const employeeIds = employees.map(e => e._id)
        const assignments = await Assignment.find({ ...tenantFilter, employeeId: { $in: employeeIds } }).lean()
        csvRows.push(['Employee', 'End Date', 'Assets Returned', 'Assets Pending'])
        for (const emp of employees) {
          const empAssignments = assignments.filter(a => a.employeeId.toString() === emp._id.toString())
          csvRows.push([
            `${emp.firstName} ${emp.lastName}`,
            emp.endDate ? new Date(emp.endDate).toLocaleDateString('de-DE') : '',
            String(empAssignments.filter(a => a.returnedAt).length),
            String(empAssignments.filter(a => !a.returnedAt).length)
          ])
        }
        break
      }
      case 'activity': {
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - 30)
        const assignments = await Assignment.find({ ...tenantFilter, assignmentDate: { $gte: sinceDate } })
          .populate('employeeId', 'firstName lastName')
          .populate('hardware', 'serialNumber model')
          .lean()
        csvRows.push(['Date', 'Type', 'Description', 'Employee', 'Asset'])
        for (const a of assignments) {
          const emp = a.employeeId as any
          const hwList = (a.hardware as any[]) || []
          csvRows.push([
            (a.assignmentDate || a.createdAt!) ? new Date(a.assignmentDate || a.createdAt!).toLocaleDateString('de-DE') : '',
            'Assignment',
            `${hwList.length} asset(s) assigned`,
            emp ? `${emp.firstName} ${emp.lastName}` : '',
            hwList.map((h: any) => h.serialNumber || h.model).join('; ')
          ])
        }
        break
      }
      case 'checkout-signatures': {
        const assignments = await Assignment.find(tenantFilter)
          .populate('employeeId', 'firstName lastName')
          .populate('hardware', 'serialNumber model')
          .sort({ assignmentDate: -1 }).lean()
        csvRows.push(['Employee', 'Asset', 'Assignment Date', 'Acknowledged'])
        for (const a of assignments) {
          const emp = a.employeeId as any
          const hwList = (a.hardware as any[]) || []
          csvRows.push([
            emp ? `${emp.firstName} ${emp.lastName}` : '',
            hwList.map((h: any) => h.serialNumber || h.model).join('; '),
            (a.assignmentDate || a.createdAt!) ? new Date(a.assignmentDate || a.createdAt!).toLocaleDateString('de-DE') : '',
            a.acknowledgedAt ? 'Yes' : 'No'
          ])
        }
        break
      }
      default:
        return reply.status(404).send({ error: `Unknown report type: ${type}` })
    }

    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }
    const csvContent = '\uFEFF' + csvRows.map(row => row.map(escapeCsv).join(',')).join('\r\n')

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csvContent)
  })
}

export default reportRoutes
