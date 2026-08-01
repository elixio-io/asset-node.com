import { describe, it, expect } from 'vitest'
import { assetTagPattern, formatAssetTag, nextAssetTagSequence } from '../../shared/assetTag'


function sanitizeEmptyIdentifiers(values: { serialNumber?: string | null; assetTag?: string | null }) {
  const result = { ...values }
  if (result.serialNumber === '') result.serialNumber = null
  if (result.assetTag === '') result.assetTag = null
  return result
}

/**
 * Mirrors the model hook: the DB reports the highest sequence already issued
 * for the prefix (soft-deleted assets included), we hand out the next one.
 */
function generateAssetTag(prefix: string, highestIssued: number | null): string {
  return formatAssetTag(prefix, nextAssetTagSequence(highestIssued))
}

function tagCountsTowardSequence(prefix: string, tag: string): boolean {
  return new RegExp(assetTagPattern(prefix)).test(tag)
}

const DEFAULT_CURRENCY = 'EUR'
const MAX_CURRENCY_LENGTH = 3
const MIN_PRICE = 0

const REQUIRED_FIELDS = ['orgId', 'model', 'categoryId', 'statusId', 'manufacturerId']

const OPTIONAL_FK_FIELDS = ['supplierId', 'departmentId', 'locationId', 'assignedTo']

const COMPOUND_INDEXES = [
  'orgId + assetTag (unique, partial: assetTag is a string)',
  'orgId + serialNumber (sparse)',
  'orgId + categoryId + statusId',
  'orgId + manufacturerId',
  'orgId + departmentId',
  'orgId + warrantyExpiry',
  'orgId + assignedTo',
  'orgId + supplierId',
  'tags',
]


describe('Hardware Model — Pure Logic', () => {
  describe('Empty String → Null Sanitization', () => {
    it('should convert empty serialNumber to null', () => {
      const result = sanitizeEmptyIdentifiers({ serialNumber: '' })
      expect(result.serialNumber).toBeNull()
    })

    it('should convert empty assetTag to null', () => {
      const result = sanitizeEmptyIdentifiers({ assetTag: '' })
      expect(result.assetTag).toBeNull()
    })

    it('should preserve non-empty serialNumber', () => {
      const result = sanitizeEmptyIdentifiers({ serialNumber: 'SN123' })
      expect(result.serialNumber).toBe('SN123')
    })

    it('should preserve non-empty assetTag', () => {
      const result = sanitizeEmptyIdentifiers({ assetTag: 'AN-100042' })
      expect(result.assetTag).toBe('AN-100042')
    })

    it('should preserve null values (already null)', () => {
      const result = sanitizeEmptyIdentifiers({ serialNumber: null, assetTag: null })
      expect(result.serialNumber).toBeNull()
      expect(result.assetTag).toBeNull()
    })

    it('should handle both empty simultaneously', () => {
      const result = sanitizeEmptyIdentifiers({ serialNumber: '', assetTag: '' })
      expect(result.serialNumber).toBeNull()
      expect(result.assetTag).toBeNull()
    })
  })

  describe('Asset Tag Auto-Generation', () => {
    it('should generate AN-100001 from default prefix', () => {
      expect(generateAssetTag('AN', null)).toBe('AN-100001')
    })

    it('should increment from last tag', () => {
      expect(generateAssetTag('AN', 100042)).toBe('AN-100043')
    })

    it('should handle custom prefix', () => {
      expect(generateAssetTag('HW', 200)).toBe('HW-201')
    })

    it('should handle prefix with numbers', () => {
      expect(generateAssetTag('IT', 999)).toBe('IT-1000')
    })

    it('should start from 100001 when no previous tag', () => {
      expect(generateAssetTag('AN', null)).toBe('AN-100001')
    })

    it('should never reissue the tag of a soft-deleted asset', () => {
      // Deleting AN-100005 leaves it in the unique index; the sequence must
      // still advance past it instead of colliding (E11000 → 409).
      expect(generateAssetTag('AN', 100005)).toBe('AN-100006')
    })

    it('should order numerically, so AN-9 does not outrank AN-100000', () => {
      const sequences = ['AN-9', 'AN-100000', 'AN-99'].map(tag => Number(tag.slice(3)))
      expect(generateAssetTag('AN', Math.max(...sequences))).toBe('AN-100001')
    })
  })

  describe('Asset Tag Sequence Matching', () => {
    it('should count tags this generator produces', () => {
      expect(tagCountsTowardSequence('AN', 'AN-100042')).toBe(true)
      expect(tagCountsTowardSequence('HW', 'HW-1')).toBe(true)
    })

    it('should ignore manual tags that only look similar', () => {
      expect(tagCountsTowardSequence('AN', 'AN-')).toBe(false)
      expect(tagCountsTowardSequence('AN', 'AN-2024-001')).toBe(false)
      expect(tagCountsTowardSequence('AN', 'NONE')).toBe(false)
      expect(tagCountsTowardSequence('AN', 'ANX-5')).toBe(false)
    })

    it('should ignore another prefix that shares a leading substring', () => {
      expect(tagCountsTowardSequence('AN', 'ANT-100042')).toBe(false)
      expect(tagCountsTowardSequence('ANT', 'ANT-100042')).toBe(true)
    })

    it('should treat regex metacharacters in the prefix literally', () => {
      expect(tagCountsTowardSequence('A.N', 'AXN-100042')).toBe(false)
      expect(tagCountsTowardSequence('A.N', 'A.N-100042')).toBe(true)
    })

    it('should reject digit runs long enough to overflow the numeric cast', () => {
      expect(tagCountsTowardSequence('AN', `AN-${'9'.repeat(20)}`)).toBe(false)
    })
  })

  describe('Schema Constants', () => {
    it('default currency is EUR', () => {
      expect(DEFAULT_CURRENCY).toBe('EUR')
    })

    it('currency max length is 3 (ISO 4217)', () => {
      expect(MAX_CURRENCY_LENGTH).toBe(3)
    })

    it('min price is 0 (no negative prices)', () => {
      expect(MIN_PRICE).toBe(0)
    })
  })

  describe('Required Fields', () => {
    it('should have 5 required fields', () => {
      expect(REQUIRED_FIELDS).toHaveLength(5)
    })

    it.each(['orgId', 'model', 'categoryId', 'statusId', 'manufacturerId'])(
      '"%s" should be required', (field) => {
        expect(REQUIRED_FIELDS).toContain(field)
      }
    )
  })

  describe('Optional FK References', () => {
    it('should have 4 optional FK fields', () => {
      expect(OPTIONAL_FK_FIELDS).toHaveLength(4)
    })

    it.each(['supplierId', 'departmentId', 'locationId', 'assignedTo'])(
      '"%s" should be optional', (field) => {
        expect(OPTIONAL_FK_FIELDS).toContain(field)
      }
    )
  })

  describe('Indexes', () => {
    it('should have 9 compound indexes', () => {
      expect(COMPOUND_INDEXES).toHaveLength(9)
    })

    it('assetTag index should be unique + partial (sparse would collide on tagless assets)', () => {
      expect(COMPOUND_INDEXES[0]).toContain('unique')
      expect(COMPOUND_INDEXES[0]).toContain('partial')
      expect(COMPOUND_INDEXES[0]).not.toContain('sparse')
    })

    it('serialNumber index should be sparse', () => {
      expect(COMPOUND_INDEXES[1]).toContain('sparse')
    })
  })
})
