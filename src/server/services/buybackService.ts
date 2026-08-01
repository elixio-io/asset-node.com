
import mongoose from 'mongoose'
import { BuybackQuote, type BuybackStatus } from '../../models/BuybackQuote'
import { Hardware } from '../../models/Hardware'
import { getBuybackPartnerBySlug, getActiveBuybackPartners } from '../config/buybackPartners'
import { sendBuybackQuoteToPartner, sendBuybackConfirmationEmail } from './emailService'
import type { BuybackEmailAsset } from './emailService'


interface EstimationInput {
  purchasePrice: number
  purchaseDateMs: number
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  category: string
}

interface EstimationResult {
  estimatedValue: number
  confidenceLevel: 'high' | 'medium' | 'low'
  depreciationPct: number
  ageYears: number
}

const CATEGORY_RETENTION: Record<string, number> = {
  'Laptops':       0.70,
  'Mobilgeräte':   0.55,
  'Desktops':      0.60,
  'Monitore':      0.75,
  'Server':        0.50,
  'Netzwerk':      0.45,
  'Drucker':       0.30,
  'Tablets':       0.60,
}
const DEFAULT_RETENTION = 0.55

const CONDITION_MULTIPLIER: Record<string, number> = {
  'excellent': 1.00,
  'good':      0.85,
  'fair':      0.65,
  'poor':      0.35,
}

export function estimateDeviceValue(input: EstimationInput): EstimationResult {
  const now = Date.now()
  const ageMs = now - input.purchaseDateMs
  const ageYears = Math.max(0, ageMs / (365.25 * 24 * 60 * 60 * 1000))

  const retention = CATEGORY_RETENTION[input.category] ?? DEFAULT_RETENTION
  const condMult = CONDITION_MULTIPLIER[input.condition] ?? 0.65

  const ageFactor = Math.pow(retention, ageYears)
  const rawValue = input.purchasePrice * ageFactor * condMult

  const minValue = input.purchasePrice * 0.05
  const estimatedValue = Math.max(minValue, Math.round(rawValue))

  const depreciationPct = Math.round((1 - estimatedValue / input.purchasePrice) * 100)

  let confidenceLevel: 'high' | 'medium' | 'low' = 'high'
  if (ageYears > 5) confidenceLevel = 'low'
  else if (ageYears > 3) confidenceLevel = 'medium'
  if (input.purchasePrice < 50) confidenceLevel = 'low'

  return {
    estimatedValue,
    confidenceLevel,
    depreciationPct,
    ageYears: Math.round(ageYears * 10) / 10
  }
}


interface CreateQuoteInput {
  orgId: string
  partnerSlug: string
  hardwareIds: string[]
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
  userId: string
}

export async function createBuybackQuote(input: CreateQuoteInput) {
  const partner = getBuybackPartnerBySlug(input.partnerSlug)
  if (!partner) {
    throw new Error(`Partner "${input.partnerSlug}" not found or inactive`)
  }

  const assets = await Hardware.find({
    _id: { $in: input.hardwareIds.map(id => new mongoose.Types.ObjectId(id)) },
    orgId: new mongoose.Types.ObjectId(input.orgId)
  })
    .populate('categoryId', 'name')
    .populate('statusId', 'name label')
    .lean()

  if (assets.length === 0) {
    throw new Error('No valid assets found for the specified IDs')
  }

  if (assets.length < partner.minQuantity) {
    throw new Error(`Partner ${partner.name} requires a minimum of ${partner.minQuantity} devices`)
  }

  const quoteAssets = assets.map((asset: any) => {
    const categoryName = asset.categoryId?.name || 'Unknown'
    const statusName = (asset.statusId?.label || asset.statusId?.name || '').toLowerCase()

    let condition: 'excellent' | 'good' | 'fair' | 'poor' = 'good'
    if (statusName.includes('neu') || statusName.includes('new') || statusName.includes('einsatzbereit')) {
      condition = 'excellent'
    } else if (statusName.includes('zugewiesen') || statusName.includes('assigned')) {
      condition = 'good'
    } else if (statusName.includes('defekt') || statusName.includes('defective') || statusName.includes('reparatur')) {
      condition = 'poor'
    } else if (statusName.includes('ausgemustert') || statusName.includes('retired') || statusName.includes('verkauf')) {
      condition = 'fair'
    }

    const estimation = estimateDeviceValue({
      purchasePrice: asset.purchasePrice || 0,
      purchaseDateMs: asset.purchaseDate ? new Date(asset.purchaseDate).getTime() : Date.now() - (2 * 365.25 * 24 * 60 * 60 * 1000),
      condition,
      category: categoryName
    })

    return {
      hardwareId: asset._id,
      model: asset.model,
      serialNumber: asset.serialNumber || undefined,
      category: categoryName,
      condition,
      purchasePrice: asset.purchasePrice,
      purchaseDate: asset.purchaseDate,
      estimatedValue: estimation.estimatedValue
    }
  })

  const totalEstimatedValue = quoteAssets.reduce((sum, a) => sum + a.estimatedValue, 0)

  const now = new Date()
  const quoteCount = await BuybackQuote.countDocuments({ orgId: new mongoose.Types.ObjectId(input.orgId) })
  const quoteRef = `AN-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(quoteCount + 1).padStart(3, '0')}`

  const quote = await BuybackQuote.create({
    orgId: new mongoose.Types.ObjectId(input.orgId),
    partnerSlug: input.partnerSlug,
    partnerName: partner.name,
    quoteRef,
    status: 'submitted',
    assets: quoteAssets,
    totalEstimatedValue,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    notes: input.notes,
    submittedBy: new mongoose.Types.ObjectId(input.userId),
    submittedAt: now
  })

  const emailAssets: BuybackEmailAsset[] = quoteAssets.map(a => ({
    model: a.model,
    serialNumber: a.serialNumber,
    category: a.category,
    condition: a.condition,
    purchasePrice: a.purchasePrice,
    purchaseDate: a.purchaseDate,
    estimatedValue: a.estimatedValue
  }))

  const Organization = mongoose.model('Organization')
  const User = mongoose.model('User')

  Promise.all([
    Organization.findById(input.orgId).select('name').lean(),
    User.findById(input.userId).select('firstName lastName email').lean()
  ]).then(async ([org, user]: any[]) => {
    const orgName = org?.name || 'Unbekannte Organisation'
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Benutzer'
    const userEmail = user?.email || input.contactEmail

    sendBuybackQuoteToPartner({
      partnerName: partner.name,
      partnerEmail: partner.contactEmail,
      orgName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      notes: input.notes,
      assets: emailAssets,
      totalEstimatedValue,
      quoteRef
    }).then(ok => {
      if (ok) console.log(`[Buyback] ✉️  Quote ${quoteRef} sent to ${partner.name} (${partner.contactEmail})`)
      else console.error(`[Buyback] ❌ Failed to send quote ${quoteRef} to ${partner.contactEmail}`)
    })

    if (userEmail) {
      sendBuybackConfirmationEmail(userEmail, userName, {
        partnerName: partner.name,
        assets: emailAssets,
        totalEstimatedValue,
        quoteRef
      }).then(ok => {
        if (ok) console.log(`[Buyback] ✉️  Confirmation for ${quoteRef} sent to ${userEmail}`)
        else console.error(`[Buyback] ❌ Failed to send confirmation to ${userEmail}`)
      })
    }
  }).catch(err => {
    console.error('[Buyback] Email dispatch failed:', err)
  })

  return {
    quote,
    partner,
    totalEstimatedValue,
    assetCount: quoteAssets.length,
    quoteRef
  }
}

export async function listBuybackQuotes(orgId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  const [quotes, total] = await Promise.all([
    BuybackQuote.find({ orgId: new mongoose.Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BuybackQuote.countDocuments({ orgId: new mongoose.Types.ObjectId(orgId) })
  ])

  return {
    quotes,
    total,
    page,
    pages: Math.ceil(total / limit)
  }
}

export async function updateQuoteStatus(
  quoteId: string,
  orgId: string,
  status: BuybackStatus,
  actualValue?: number,
  partnerNotes?: string,
  partnerQuoteRef?: string
) {
  const updateFields: any = { status }

  const now = new Date()
  if (status === 'quoted') updateFields.quotedAt = now
  if (status === 'accepted') updateFields.acceptedAt = now
  if (status === 'shipped') updateFields.shippedAt = now
  if (status === 'completed') updateFields.completedAt = now
  if (status === 'rejected') updateFields.rejectedAt = now

  if (actualValue !== undefined) updateFields.totalActualValue = actualValue
  if (partnerNotes) updateFields.partnerNotes = partnerNotes
  if (partnerQuoteRef) updateFields.partnerQuoteRef = partnerQuoteRef

  const quote = await BuybackQuote.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(quoteId),
      orgId: new mongoose.Types.ObjectId(orgId)
    },
    { $set: updateFields },
    { new: true }
  ).lean()

  if (!quote) {
    throw new Error('Quote not found')
  }

  return quote
}

export async function getQuoteById(quoteId: string, orgId: string) {
  const quote = await BuybackQuote.findOne({
    _id: new mongoose.Types.ObjectId(quoteId),
    orgId: new mongoose.Types.ObjectId(orgId)
  }).lean()

  if (!quote) throw new Error('Quote not found')
  return quote
}

export async function estimateBatch(orgId: string, hardwareIds: string[]) {
  const assets = await Hardware.find({
    _id: { $in: hardwareIds.map(id => new mongoose.Types.ObjectId(id)) },
    orgId: new mongoose.Types.ObjectId(orgId)
  })
    .populate('categoryId', 'name')
    .populate('statusId', 'name label')
    .lean()

  const estimates = assets.map((asset: any) => {
    const categoryName = asset.categoryId?.name || 'Unknown'
    const statusName = (asset.statusId?.label || asset.statusId?.name || '').toLowerCase()

    let condition: 'excellent' | 'good' | 'fair' | 'poor' = 'good'
    if (statusName.includes('neu') || statusName.includes('einsatzbereit')) condition = 'excellent'
    else if (statusName.includes('defekt') || statusName.includes('reparatur')) condition = 'poor'
    else if (statusName.includes('ausgemustert') || statusName.includes('verkauf')) condition = 'fair'

    const estimation = estimateDeviceValue({
      purchasePrice: asset.purchasePrice || 0,
      purchaseDateMs: asset.purchaseDate ? new Date(asset.purchaseDate).getTime() : Date.now() - (2 * 365.25 * 24 * 60 * 60 * 1000),
      condition,
      category: categoryName
    })

    return {
      hardwareId: asset._id.toString(),
      model: asset.model,
      serialNumber: asset.serialNumber,
      category: categoryName,
      condition,
      purchasePrice: asset.purchasePrice,
      ...estimation
    }
  })

  const totalEstimatedValue = estimates.reduce((sum, e) => sum + e.estimatedValue, 0)

  return {
    estimates,
    totalEstimatedValue,
    count: estimates.length
  }
}
