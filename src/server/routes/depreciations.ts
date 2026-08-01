import { FastifyPluginAsync } from 'fastify'
import { Depreciation } from '../../models/Depreciation'
import { Hardware } from '../../models/Hardware'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter, getOrgId } from '../middleware/tenantScope'



function calculateStraightLine(
  purchasePrice: number,
  salvageValue: number,
  usefulLifeMonths: number,
  monthsElapsed: number
) {
  const depreciableAmount = purchasePrice - salvageValue
  const monthlyDepreciation = depreciableAmount / usefulLifeMonths
  const months = Math.min(monthsElapsed, usefulLifeMonths)
  const accumulated = monthlyDepreciation * months
  const currentValue = Math.max(purchasePrice - accumulated, salvageValue)

  return {
    method: 'straightLine' as const,
    monthlyDepreciation: Math.round(monthlyDepreciation * 100) / 100,
    annualDepreciation: Math.round(monthlyDepreciation * 12 * 100) / 100,
    accumulated: Math.round(accumulated * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    percentDepreciated: Math.round((accumulated / depreciableAmount) * 100),
    fullyDepreciated: months >= usefulLifeMonths,
    monthsRemaining: Math.max(usefulLifeMonths - months, 0)
  }
}

function calculateDecliningBalance(
  purchasePrice: number,
  salvageValue: number,
  monthsElapsed: number,
  annualRate: number
) {
  const monthlyRate = annualRate / 100 / 12
  let currentValue = purchasePrice

  for (let m = 0; m < monthsElapsed; m++) {
    const depreciation = currentValue * monthlyRate
    currentValue -= depreciation
    if (currentValue <= salvageValue) {
      currentValue = salvageValue
      break
    }
  }

  const accumulated = purchasePrice - currentValue

  return {
    method: 'decliningBalance' as const,
    monthlyDepreciation: Math.round(currentValue * monthlyRate * 100) / 100,
    annualDepreciation: Math.round(currentValue * (annualRate / 100) * 100) / 100,
    accumulated: Math.round(accumulated * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    percentDepreciated: Math.round((accumulated / purchasePrice) * 100),
    fullyDepreciated: currentValue <= salvageValue,
    monthsRemaining: null as number | null
  }
}

function getMonthsElapsed(purchaseDate: Date): number {
  const now = new Date()
  return (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
    (now.getMonth() - purchaseDate.getMonth())
}


const depreciationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const records = await Depreciation.find(tenantFilter)
      .populate('hardwareId', 'serialNumber model category purchasePrice')
      .sort({ createdAt: -1 })
      .lean()

    return records.map((r: any) => {
      const months = getMonthsElapsed(new Date(r.purchaseDate))
      const calc = r.method === 'decliningBalance'
        ? calculateDecliningBalance(r.purchasePrice, r.salvageValue, months, r.depreciationRate)
        : calculateStraightLine(r.purchasePrice, r.salvageValue, r.usefulLifeMonths, months)

      return { ...r, calculation: calc }
    })
  })

  fastify.get('/hardware/:hardwareId', async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { hardwareId } = request.params as { hardwareId: string }

    const record = await Depreciation.findOne({ ...tenantFilter, hardwareId })
      .populate('hardwareId', 'serialNumber model category purchasePrice')
      .lean()

    if (!record) return reply.status(404).send({ error: 'No depreciation record for this asset' })

    const months = getMonthsElapsed(new Date(record.purchaseDate))
    const calc = record.method === 'decliningBalance'
      ? calculateDecliningBalance(record.purchasePrice, record.salvageValue, months, record.depreciationRate || 20)
      : calculateStraightLine(record.purchasePrice, record.salvageValue, record.usefulLifeMonths, months)

    return { ...record, calculation: calc }
  })

  fastify.post('/', { preHandler: requireRole('admin', 'manager') }, async (request, reply) => {
    const orgId = getOrgId(request)
    const body = request.body as any

    const hw = await Hardware.findOne({ _id: body.hardwareId, orgId, deletedAt: null })
    if (!hw) return reply.status(404).send({ error: 'Hardware asset not found' })

    const data = {
      orgId,
      hardwareId: body.hardwareId,
      method: body.method || 'straightLine',
      purchasePrice: body.purchasePrice ?? hw.purchasePrice ?? 0,
      salvageValue: body.salvageValue ?? 0,
      usefulLifeMonths: body.usefulLifeMonths ?? 36,
      purchaseDate: body.purchaseDate ?? hw.purchaseDate ?? new Date(),
      depreciationRate: body.depreciationRate ?? 20,
      notes: body.notes
    }

    const record = await Depreciation.findOneAndUpdate(
      { orgId, hardwareId: body.hardwareId },
      data,
      { upsert: true, new: true }
    )

    return reply.status(201).send(record)
  })

  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const tenantFilter = getTenantFilter(request)
    const { id } = request.params as { id: string }
    const record = await Depreciation.findOneAndDelete({ _id: id, ...tenantFilter })
    if (!record) return reply.status(404).send({ error: 'Record not found' })
    return { success: true }
  })

  fastify.get('/summary', async (request) => {
    const tenantFilter = getTenantFilter(request)
    const records = await Depreciation.find(tenantFilter).lean()

    let totalOriginalValue = 0
    let totalCurrentValue = 0
    let totalAccumulatedDepreciation = 0
    let fullyDepreciatedCount = 0

    for (const r of records) {
      const months = getMonthsElapsed(new Date(r.purchaseDate))
      const calc = r.method === 'decliningBalance'
        ? calculateDecliningBalance(r.purchasePrice, r.salvageValue || 0, months, r.depreciationRate || 20)
        : calculateStraightLine(r.purchasePrice, r.salvageValue || 0, r.usefulLifeMonths, months)

      totalOriginalValue += r.purchasePrice
      totalCurrentValue += calc.currentValue
      totalAccumulatedDepreciation += calc.accumulated
      if (calc.fullyDepreciated) fullyDepreciatedCount++
    }

    return {
      totalAssets: records.length,
      totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
      fullyDepreciatedCount,
      averageDepreciation: records.length > 0
        ? Math.round((totalAccumulatedDepreciation / totalOriginalValue) * 100)
        : 0
    }
  })
}

export default depreciationRoutes
