import { describe, it, expect } from 'vitest'


function mapOperator(op: string): string {
  const map: Record<string, string> = {
    'lt': 'lessThan',
    'lte': 'lessThanInclusive',
    'gt': 'greaterThan',
    'gte': 'greaterThanInclusive',
    'eq': 'equal',
    'neq': 'notEqual',
    'in': 'in',
    'contains': 'contains'
  }
  return map[op] || op
}

function parseValue(value: any): any {
  if (typeof value === 'string') {
    const num = Number(value)
    if (!isNaN(num)) return num
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return value
}

function extractAssetIds(triggerData: Record<string, any>): string[] {
  if (triggerData.assetIds) return Array.isArray(triggerData.assetIds) ? triggerData.assetIds : [triggerData.assetIds]
  if (triggerData.assetId) return [triggerData.assetId]
  if (triggerData.hardwareId) return [triggerData.hardwareId]
  if (triggerData.created && Array.isArray(triggerData.created)) return triggerData.created
  return []
}

interface ExecutionContext {
  orgId: string
  triggeredBy: 'event' | 'schedule' | 'manual'
  triggerData: Record<string, any>
  nodeOutputs: Map<string, any>
  conditionResults: Map<string, boolean>
}

function interpolateTemplate(template: string, ctx: ExecutionContext): string {
  return template
    .replace(/\{\{orgId\}\}/g, ctx.orgId)
    .replace(/\{\{triggeredBy\}\}/g, ctx.triggeredBy)
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
    .replace(/\{\{provider\}\}/g, ctx.triggerData.provider || '')
    .replace(/\{\{created\}\}/g, String(ctx.triggerData.created || 0))
    .replace(/\{\{updated\}\}/g, String(ctx.triggerData.updated || 0))
}

const DELAY_MULTIPLIERS: Record<string, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000
}

const ALLOWED_UPDATE_FIELDS: Record<string, string[]> = {
  hardware: ['notes', 'statusId', 'location', 'tags', 'customFields', 'name', 'serialNumber', 'warrantyExpiry', 'purchaseDate', 'purchaseCost'],
  license: ['notes', 'customFields', 'licenseName', 'seats', 'expirationDate'],
  consumable: ['notes', 'customFields', 'name', 'totalQuantity', 'minimumQuantity'],
  employee: ['department', 'title', 'notes', 'customFields', 'phone', 'location']
}


describe('Workflow Engine — Pure Helpers', () => {
  describe('mapOperator()', () => {
    it.each([
      ['lt', 'lessThan'],
      ['lte', 'lessThanInclusive'],
      ['gt', 'greaterThan'],
      ['gte', 'greaterThanInclusive'],
      ['eq', 'equal'],
      ['neq', 'notEqual'],
      ['in', 'in'],
      ['contains', 'contains'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(mapOperator(input)).toBe(expected)
    })

    it('unknown operator → pass through', () => {
      expect(mapOperator('customOp')).toBe('customOp')
    })
  })

  describe('parseValue()', () => {
    it('"42" → 42 (number)', () => {
      expect(parseValue('42')).toBe(42)
    })

    it('"3.14" → 3.14', () => {
      expect(parseValue('3.14')).toBe(3.14)
    })

    it('"0" → 0', () => {
      expect(parseValue('0')).toBe(0)
    })

    it('"true" → true (boolean)', () => {
      expect(parseValue('true')).toBe(true)
    })

    it('"false" → false (boolean)', () => {
      expect(parseValue('false')).toBe(false)
    })

    it('"hello" → "hello" (string passthrough)', () => {
      expect(parseValue('hello')).toBe('hello')
    })

    it('42 → 42 (already a number)', () => {
      expect(parseValue(42)).toBe(42)
    })

    it('null → null', () => {
      expect(parseValue(null)).toBeNull()
    })

    it('undefined → undefined', () => {
      expect(parseValue(undefined)).toBeUndefined()
    })

    it('"" → "" (empty string is NaN → passthrough)', () => {
      expect(parseValue('')).toBe(0)
    })
  })

  describe('extractAssetIds()', () => {
    it('assetIds array', () => {
      expect(extractAssetIds({ assetIds: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c'])
    })

    it('assetIds single string → wrapped in array', () => {
      expect(extractAssetIds({ assetIds: 'single-id' })).toEqual(['single-id'])
    })

    it('assetId field', () => {
      expect(extractAssetIds({ assetId: 'id-123' })).toEqual(['id-123'])
    })

    it('hardwareId field', () => {
      expect(extractAssetIds({ hardwareId: 'hw-456' })).toEqual(['hw-456'])
    })

    it('created array', () => {
      expect(extractAssetIds({ created: ['new-1', 'new-2'] })).toEqual(['new-1', 'new-2'])
    })

    it('empty trigger data → empty array', () => {
      expect(extractAssetIds({})).toEqual([])
    })

    it('priority: assetIds > assetId > hardwareId', () => {
      expect(extractAssetIds({
        assetIds: ['win'],
        assetId: 'lose',
        hardwareId: 'also-lose'
      })).toEqual(['win'])
    })
  })

  describe('interpolateTemplate()', () => {
    const ctx: ExecutionContext = {
      orgId: 'org-abc-123',
      triggeredBy: 'event',
      triggerData: { provider: 'intune', created: 5, updated: 3 },
      nodeOutputs: new Map(),
      conditionResults: new Map()
    }

    it('replaces {{orgId}}', () => {
      expect(interpolateTemplate('Org: {{orgId}}', ctx)).toBe('Org: org-abc-123')
    })

    it('replaces {{triggeredBy}}', () => {
      expect(interpolateTemplate('By: {{triggeredBy}}', ctx)).toBe('By: event')
    })

    it('replaces {{provider}}', () => {
      expect(interpolateTemplate('Provider: {{provider}}', ctx)).toBe('Provider: intune')
    })

    it('replaces {{created}} and {{updated}}', () => {
      expect(interpolateTemplate('C: {{created}}, U: {{updated}}', ctx))
        .toBe('C: 5, U: 3')
    })

    it('replaces {{timestamp}} with ISO string', () => {
      const result = interpolateTemplate('At: {{timestamp}}', ctx)
      expect(result).toMatch(/At: \d{4}-\d{2}-\d{2}T/)
    })

    it('handles multiple replacements in one template', () => {
      const result = interpolateTemplate(
        '{{provider}} synced {{created}} assets for {{orgId}}',
        ctx
      )
      expect(result).toBe('intune synced 5 assets for org-abc-123')
    })

    it('missing provider → empty string', () => {
      const noProvider: ExecutionContext = { ...ctx, triggerData: {} }
      expect(interpolateTemplate('P: {{provider}}', noProvider)).toBe('P: ')
    })

    it('no placeholders → unchanged', () => {
      expect(interpolateTemplate('plain text', ctx)).toBe('plain text')
    })
  })

  describe('Delay Multipliers', () => {
    it('seconds → 1000ms', () => {
      expect(DELAY_MULTIPLIERS.seconds).toBe(1000)
    })

    it('minutes → 60_000ms', () => {
      expect(DELAY_MULTIPLIERS.minutes).toBe(60_000)
    })

    it('hours → 3_600_000ms', () => {
      expect(DELAY_MULTIPLIERS.hours).toBe(3_600_000)
    })

    it('days → 86_400_000ms', () => {
      expect(DELAY_MULTIPLIERS.days).toBe(86_400_000)
    })
  })

  describe('Field Update Allowlist', () => {
    it('hardware has 10 allowed fields', () => {
      expect(ALLOWED_UPDATE_FIELDS.hardware).toHaveLength(10)
    })

    it('hardware allows notes but not orgId', () => {
      expect(ALLOWED_UPDATE_FIELDS.hardware).toContain('notes')
      expect(ALLOWED_UPDATE_FIELDS.hardware).not.toContain('orgId')
    })

    it('hardware allows customFields but not hashedPassword', () => {
      expect(ALLOWED_UPDATE_FIELDS.hardware).toContain('customFields')
      expect(ALLOWED_UPDATE_FIELDS.hardware).not.toContain('hashedPassword')
    })

    it('employee allows department but not role', () => {
      expect(ALLOWED_UPDATE_FIELDS.employee).toContain('department')
      expect(ALLOWED_UPDATE_FIELDS.employee).not.toContain('role')
    })

    it('license allows seats but not orgId', () => {
      expect(ALLOWED_UPDATE_FIELDS.license).toContain('seats')
      expect(ALLOWED_UPDATE_FIELDS.license).not.toContain('orgId')
    })

    it('unknown entity → undefined (no whitelist)', () => {
      expect(ALLOWED_UPDATE_FIELDS['secret']).toBeUndefined()
    })
  })
})
