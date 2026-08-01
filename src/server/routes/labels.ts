import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'
import { Hardware } from '../../models/Hardware'
import { authenticate, requireRole } from '../middleware/auth'
import { getTenantFilter } from '../middleware/tenantScope'

const BASE_URL = process.env.APP_URL || 'http://localhost:5173'

const labelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/qr/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const hw = await Hardware.findOne({ _id: id, ...getTenantFilter(request) })
    if (!hw) return reply.code(404).send({ error: 'Hardware not found' })

    const url = `${BASE_URL}/hardware/${id}`
    const qrText = `${hw.serialNumber}\n${hw.model}\n${url}`
    const pngBuffer = await QRCode.toBuffer(qrText, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    })

    reply
      .header('Content-Type', 'image/png')
      .header('Content-Disposition', `inline; filename="qr-${hw.serialNumber}.png"`)
      .send(pngBuffer)
  })

  fastify.get('/qr-data/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const hw = await Hardware.findOne({ _id: id, ...getTenantFilter(request) })
    if (!hw) return reply.code(404).send({ error: 'Hardware not found' })

    const url = `${BASE_URL}/hardware/${id}`
    const dataUrl = await QRCode.toDataURL(`${hw.serialNumber}\n${hw.model}\n${url}`, {
      width: 200,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    })

    return { serialNumber: hw.serialNumber, model: hw.model, qrDataUrl: dataUrl }
  })

  fastify.post('/labels', {
    schema: {
      body: Type.Object({
        assetIds: Type.Array(Type.String(), { minItems: 1, maxItems: 100 })
      })
    }
  }, async (request, reply) => {
    const { assetIds } = request.body as { assetIds: string[] }
    const tenantFilter = getTenantFilter(request)

    const assets = await Hardware.find({
      _id: { $in: assetIds },
      ...tenantFilter
    })
      .populate('manufacturerId', 'name')
      .populate('categoryId', 'name')
      .lean()

    if (assets.length === 0) {
      return reply.code(404).send({ error: 'No matching assets found' })
    }

    const qrImages = await Promise.all(
      assets.map(async (asset) => ({
        asset,
        qr: await QRCode.toBuffer(
          `${asset.serialNumber}\n${asset.model}\n${BASE_URL}/hardware/${asset._id}`,
          { type: 'png', width: 120, margin: 1 }
        )
      }))
    )

    const doc = new PDFDocument({ size: 'A4', margin: 30 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const COLS = 3
    const LABEL_W = 170
    const LABEL_H = 80
    const GAP_X = 12
    const GAP_Y = 8
    const START_X = 30
    const START_Y = 30
    const LABELS_PER_PAGE = 30

    let col = 0
    let row = 0

    for (let i = 0; i < qrImages.length; i++) {
      if (i > 0 && i % LABELS_PER_PAGE === 0) {
        doc.addPage()
        col = 0
        row = 0
      }

      const x = START_X + col * (LABEL_W + GAP_X)
      const y = START_Y + row * (LABEL_H + GAP_Y)

      const { asset, qr } = qrImages[i]

      doc.image(qr, x, y, { width: 60, height: 60 })

      doc.font('Helvetica-Bold').fontSize(8)
      doc.text((asset.serialNumber || asset.assetTag || ''), x + 65, y + 2, { width: LABEL_W - 70 })

      doc.font('Helvetica').fontSize(7)
      doc.text(asset.model, x + 65, y + 14, { width: LABEL_W - 70 })
      const mfg = asset.manufacturerId as any
      doc.text(mfg?.name || '', x + 65, y + 24, { width: LABEL_W - 70 })
      const cat = asset.categoryId as any
      doc.text(cat?.name || '', x + 65, y + 34, { width: LABEL_W - 70 })

      if (asset.purchaseDate) {
        doc.fontSize(6).fillColor('#666666')
        doc.text(
          `Purchased: ${new Date(asset.purchaseDate).toLocaleDateString('de-DE')}`,
          x + 65, y + 46, { width: LABEL_W - 70 }
        )
        doc.fillColor('#000000')
      }

      doc.rect(x - 2, y - 2, LABEL_W + 4, LABEL_H).stroke('#cccccc')

      col++
      if (col >= COLS) {
        col = 0
        row++
      }
    }

    await new Promise<void>((resolve) => {
      doc.on('end', resolve)
      doc.end()
    })

    const pdfBuffer = Buffer.concat(chunks)
    const filename = `asset-labels-${new Date().toISOString().slice(0, 10)}.pdf`

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(pdfBuffer)
  })
}

export default labelRoutes
