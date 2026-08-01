import { FastifyPluginAsync } from 'fastify'
import ExcelJS from 'exceljs'
import { Hardware } from '../../models/Hardware'
import { Peripheral } from '../../models/Peripheral'
import { Employee } from '../../models/Employee'
import { Consumable } from '../../models/Consumable'
import { SoftwareLicense } from '../../models/SoftwareLicense'
import { Component } from '../../models/Component'
import { Location } from '../../models/Location'
import { Manufacturer } from '../../models/Manufacturer'
import { Supplier } from '../../models/Supplier'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { checkLimit } from '../middleware/planLimits'



interface FieldDef {
  key: string
  label: string
  required: boolean
  type: 'text' | 'number' | 'date' | 'enum' | 'boolean'
  options?: readonly string[] | string[]
}


const ENTITY_FIELDS: Record<string, FieldDef[]> = {
  hardware: [
    { key: 'serialNumber', label: 'Serial Number', required: false, type: 'text' },
    { key: 'model', label: 'Model', required: true, type: 'text' },
    { key: 'category', label: 'Category (name)', required: false, type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer (name)', required: false, type: 'text' },
    { key: 'status', label: 'Status (name)', required: false, type: 'text' },
    { key: 'purchasePrice', label: 'Purchase Price', required: false, type: 'number' },
    { key: 'purchaseDate', label: 'Purchase Date', required: false, type: 'date' },
    { key: 'warrantyExpiry', label: 'Warranty Expiry', required: false, type: 'date' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  peripherals: [
    { key: 'model', label: 'Model', required: true, type: 'text' },
    { key: 'category', label: 'Category (name)', required: false, type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer (name)', required: false, type: 'text' },
    { key: 'serialNumber', label: 'Serial Number', required: false, type: 'text' },
    { key: 'status', label: 'Status (name)', required: false, type: 'text' },
    { key: 'purchasePrice', label: 'Purchase Price', required: false, type: 'number' },
    { key: 'purchaseDate', label: 'Purchase Date', required: false, type: 'date' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  employees: [
    { key: 'firstName', label: 'First Name', required: true, type: 'text' },
    { key: 'lastName', label: 'Last Name', required: true, type: 'text' },
    { key: 'email', label: 'Email', required: true, type: 'text' },
    { key: 'department', label: 'Department (name)', required: false, type: 'text' },
    { key: 'jobTitle', label: 'Job Title', required: false, type: 'text' },
    { key: 'phone', label: 'Phone', required: false, type: 'text' },
    { key: 'startDate', label: 'Start Date', required: false, type: 'date' }
  ],

  consumables: [
    { key: 'name', label: 'Name', required: true, type: 'text' },
    { key: 'category', label: 'Category (name)', required: false, type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer (name)', required: false, type: 'text' },
    { key: 'modelNumber', label: 'Model Number', required: false, type: 'text' },
    { key: 'totalQuantity', label: 'Quantity', required: true, type: 'number' },
    { key: 'minimumQuantity', label: 'Minimum Stock', required: false, type: 'number' },
    { key: 'unitCost', label: 'Unit Cost', required: false, type: 'number' },
    { key: 'purchaseDate', label: 'Purchase Date', required: false, type: 'date' },
    { key: 'supplier', label: 'Supplier (name)', required: false, type: 'text' },
    { key: 'orderNumber', label: 'Order Number', required: false, type: 'text' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  licenses: [
    { key: 'name', label: 'Software Name', required: true, type: 'text' },
    { key: 'publisher', label: 'Publisher', required: false, type: 'text' },
    { key: 'category', label: 'Category (name)', required: false, type: 'text' },
    { key: 'licenseType', label: 'License Type', required: false, type: 'enum', options: ['perpetual', 'subscription', 'oem', 'volume', 'freeware', 'open-source'] },
    { key: 'licenseKey', label: 'License Key', required: false, type: 'text' },
    { key: 'totalSeats', label: 'Total Seats', required: true, type: 'number' },
    { key: 'costPerSeat', label: 'Cost per Seat', required: false, type: 'number' },
    { key: 'billingCycle', label: 'Billing Cycle', required: false, type: 'enum', options: ['monthly', 'annual', 'one-time', 'other'] },
    { key: 'purchaseDate', label: 'Purchase Date', required: false, type: 'date' },
    { key: 'expirationDate', label: 'Expiration Date', required: false, type: 'date' },
    { key: 'version', label: 'Version', required: false, type: 'text' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  components: [
    { key: 'name', label: 'Name', required: true, type: 'text' },
    { key: 'category', label: 'Category (name)', required: false, type: 'text' },
    { key: 'serialNumber', label: 'Serial Number', required: false, type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer (name)', required: false, type: 'text' },
    { key: 'model', label: 'Model', required: false, type: 'text' },
    { key: 'purchasePrice', label: 'Purchase Price', required: false, type: 'number' },
    { key: 'purchaseDate', label: 'Purchase Date', required: false, type: 'date' },
    { key: 'status', label: 'Status', required: false, type: 'enum', options: ['available', 'installed', 'defective', 'retired'] },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  locations: [
    { key: 'name', label: 'Name', required: true, type: 'text' },
    { key: 'address', label: 'Address', required: false, type: 'text' },
    { key: 'contactEmail', label: 'Contact Email', required: false, type: 'text' }
  ],

  manufacturers: [
    { key: 'name', label: 'Name', required: true, type: 'text' },
    { key: 'url', label: 'Website', required: false, type: 'text' },
    { key: 'supportUrl', label: 'Support URL', required: false, type: 'text' },
    { key: 'supportEmail', label: 'Support Email', required: false, type: 'text' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ],

  suppliers: [
    { key: 'name', label: 'Name', required: true, type: 'text' },
    { key: 'contactName', label: 'Contact Name', required: false, type: 'text' },
    { key: 'email', label: 'Email', required: false, type: 'text' },
    { key: 'phone', label: 'Phone', required: false, type: 'text' },
    { key: 'url', label: 'Website', required: false, type: 'text' },
    { key: 'notes', label: 'Notes', required: false, type: 'text' }
  ]
}

const ENTITY_MODELS: Record<string, any> = {
  hardware: Hardware,
  peripherals: Peripheral,
  employees: Employee,
  consumables: Consumable,
  licenses: SoftwareLicense,
  components: Component,
  locations: Location,
  manufacturers: Manufacturer,
  suppliers: Supplier
}


function cellValue(cell: any): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'object' && cell.result !== undefined) return String(cell.result)
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text)
  return String(cell).trim()
}

async function parseSheet(buffer: Buffer | any): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Empty workbook')
  return sheet
}

function parseNumber(raw: string): number | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[^0-9.,\-]/g, '').replace(',', '.')
  const num = Number(cleaned)
  return isNaN(num) ? undefined : num
}

function parseDate(raw: string): Date | undefined {
  if (!raw) return undefined
  const d = new Date(raw)
  return isNaN(d.getTime()) ? undefined : d
}

function buildRow(
  fields: FieldDef[],
  mapping: Record<string, number>,
  row: ExcelJS.Row,
  orgId: any
): { data: Record<string, any>; errors: string[] } {
  const data: Record<string, any> = { orgId }
  const errors: string[] = []

  for (const field of fields) {
    const colIdx = mapping[field.key]
    if (!colIdx) continue

    const raw = cellValue(row.getCell(colIdx).value)
    if (!raw) continue

    switch (field.type) {
      case 'number':
        data[field.key] = parseNumber(raw)
        break
      case 'date':
        data[field.key] = parseDate(raw)
        break
      case 'enum':
        const normalized = raw.toLowerCase().trim()
        if (field.options && !field.options.includes(normalized)) {
          errors.push(`invalid ${field.label}: "${raw}" — valid: ${field.options.join(', ')}`)
        } else {
          data[field.key] = normalized
        }
        break
      case 'boolean':
        data[field.key] = ['true', '1', 'yes', 'ja'].includes(raw.toLowerCase())
        break
      default:
        data[field.key] = raw
    }
  }

  for (const field of fields) {
    if (field.required && !data[field.key]) {
      errors.push(`missing required field: ${field.label}`)
    }
  }

  return { data, errors }
}


const importRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', requireRole('admin', 'manager'))

  fastify.get('/fields/:entityType', async (request, reply) => {
    const { entityType } = request.params as { entityType: string }
    const fields = ENTITY_FIELDS[entityType]
    if (!fields) {
      return reply.status(400).send({
        error: `Unknown entity type: ${entityType}`,
        availableTypes: Object.keys(ENTITY_FIELDS)
      })
    }
    return { entityType, fields }
  })

  fastify.get('/entities', async () => {
    return Object.entries(ENTITY_FIELDS).map(([key, fields]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      fieldCount: fields.length,
      requiredCount: fields.filter(f => f.required).length
    }))
  })

  fastify.post('/parse', async (request, reply) => {
    const file = await (request as any).file()
    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    const buffer = await file.toBuffer()
    let sheet: ExcelJS.Worksheet

    try {
      sheet = await parseSheet(buffer)
    } catch {
      return reply.status(400).send({ error: 'Could not parse XLSX file' })
    }

    const headerRow = sheet.getRow(1).values as any[]
    const headers: { index: number; name: string }[] = []
    headerRow.forEach((val, i) => {
      if (i === 0) return
      const name = cellValue(val)
      if (name) headers.push({ index: i, name })
    })

    if (headers.length === 0) {
      return reply.status(400).send({ error: 'No headers found in the first row' })
    }

    const previewRows: Record<string, string>[] = []
    const totalRows = sheet.rowCount
    const previewEnd = Math.min(totalRows, 6)

    for (let r = 2; r <= previewEnd; r++) {
      const row = sheet.getRow(r)
      const obj: Record<string, string> = {}
      for (const h of headers) {
        obj[h.name] = cellValue(row.getCell(h.index).value)
      }
      previewRows.push(obj)
    }

    return {
      headers,
      previewRows,
      totalRows: totalRows - 1,
      sheetName: sheet.name
    }
  })

  fastify.post('/:entityType', async (request, reply) => {
    const { entityType } = request.params as { entityType: string }

    const LIMIT_MAP: Record<string, 'assets' | 'users'> = {
      hardware: 'assets',
      peripherals: 'assets',
    }
    const limitResource = LIMIT_MAP[entityType]
    if (limitResource) {
      const guard = checkLimit(limitResource)
      const blocked = await guard(request, reply)
      if (reply.sent) return
    }

    const fields = ENTITY_FIELDS[entityType]
    const Model = ENTITY_MODELS[entityType]

    if (!fields || !Model) {
      return reply.status(400).send({
        error: `Unknown entity type: ${entityType}`,
        availableTypes: Object.keys(ENTITY_FIELDS)
      })
    }

    const orgId = getOrgId(request)

    const parts = (request as any).parts()
    let buffer: Buffer | null = null
    let mapping: Record<string, number> = {}

    for await (const part of parts) {
      if (part.type === 'file') {
        buffer = await part.toBuffer()
      } else if (part.fieldname === 'mapping') {
        try { mapping = JSON.parse(part.value) } catch {
          return reply.status(400).send({ error: 'Invalid mapping JSON' })
        }
      }
    }

    if (!buffer) return reply.status(400).send({ error: 'No file uploaded' })
    if (!mapping || Object.keys(mapping).length === 0) {
      return reply.status(400).send({ error: 'No column mapping provided' })
    }

    const requiredFields = fields.filter(f => f.required)
    const missingMappings = requiredFields.filter(f => !mapping[f.key])
    if (missingMappings.length) {
      return reply.status(400).send({
        error: 'Missing required field mappings',
        details: missingMappings.map(f => `"${f.label}" is required but not mapped`)
      })
    }

    let sheet: ExcelJS.Worksheet
    try { sheet = await parseSheet(buffer) } catch {
      return reply.status(400).send({ error: 'Could not parse XLSX file' })
    }

    const rows: any[] = []
    const errors: string[] = []

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return

      const { data, errors: rowErrors } = buildRow(fields, mapping, row, orgId)
      if (rowErrors.length) {
        errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`)
      } else {
        if (entityType === 'employees') {
          if (data.email) data.email = data.email.toLowerCase()
          data.isActive = true
        }
        if (entityType === 'hardware' && !data.status) {
          data.status = 'available'
        }
        if (entityType === 'consumables') {
          data.isActive = true
        }
        if (entityType === 'licenses') {
          data.isActive = true
          if (!data.totalSeats) data.totalSeats = 1
        }
        rows.push(data)
      }
    })

    if (errors.length && rows.length === 0) {
      return reply.status(400).send({ error: 'All rows have errors', details: errors })
    }

    try {
      const result = await Model.insertMany(rows, { ordered: false })
      return reply.status(201).send({
        success: true,
        imported: result.length,
        total: rows.length,
        skipped: errors.length,
        errors: errors.length ? errors : undefined
      })
    } catch (err: any) {
      if (err.code === 11000) {
        const inserted = err.insertedDocs?.length || 0
        return reply.status(201).send({
          success: true,
          imported: inserted,
          total: rows.length,
          skipped: rows.length - inserted,
          errors: [`Some rows were skipped due to duplicate entries`]
        })
      }
      return reply.status(500).send({ error: 'Import failed', details: err.message })
    }
  })
}

export default importRoutes
