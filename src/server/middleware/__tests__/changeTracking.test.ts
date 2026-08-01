import { describe, it, expect } from 'vitest'


const IGNORED_FIELDS = new Set([
  '_id', '__v', 'orgId', 'createdAt', 'updatedAt', 'deletedAt',
  'adminPassword', 'passwordHash', 'refreshTokenHash'
])

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const diffBefore: Record<string, unknown> = {}
  const diffAfter: Record<string, unknown> = {}

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue
    const oldVal = before[key]
    const newVal = after[key]
    const oldStr = JSON.stringify(oldVal ?? null)
    const newStr = JSON.stringify(newVal ?? null)
    if (oldStr !== newStr) {
      diffBefore[key] = oldVal ?? null
      diffAfter[key] = newVal ?? null
    }
  }

  if (Object.keys(diffBefore).length === 0 && Object.keys(diffAfter).length === 0) {
    return null
  }

  return { before: diffBefore, after: diffAfter }
}


describe('Change Tracking — Diff Engine', () => {
  describe('IGNORED_FIELDS', () => {
    it('should have 9 ignored fields', () => {
      expect(IGNORED_FIELDS.size).toBe(9)
    })

    it.each([
      '_id', '__v', 'orgId', 'createdAt', 'updatedAt', 'deletedAt',
      'adminPassword', 'passwordHash', 'refreshTokenHash'
    ])('should ignore "%s"', (field) => {
      expect(IGNORED_FIELDS.has(field)).toBe(true)
    })

    it('should NOT ignore legitimate fields', () => {
      expect(IGNORED_FIELDS.has('model')).toBe(false)
      expect(IGNORED_FIELDS.has('serialNumber')).toBe(false)
      expect(IGNORED_FIELDS.has('assignedTo')).toBe(false)
    })
  })

  describe('computeDiff', () => {
    it('should detect simple field change', () => {
      const diff = computeDiff(
        { model: 'MacBook Pro', serialNumber: 'SN1' },
        { model: 'MacBook Air', serialNumber: 'SN1' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before).toEqual({ model: 'MacBook Pro' })
      expect(diff!.after).toEqual({ model: 'MacBook Air' })
    })

    it('should detect multiple field changes', () => {
      const diff = computeDiff(
        { model: 'Old', serialNumber: 'A' },
        { model: 'New', serialNumber: 'B' }
      )
      expect(Object.keys(diff!.before)).toHaveLength(2)
      expect(Object.keys(diff!.after)).toHaveLength(2)
    })

    it('should return null when no changes', () => {
      const diff = computeDiff(
        { model: 'Same', notes: 'Same' },
        { model: 'Same', notes: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore _id changes', () => {
      const diff = computeDiff(
        { _id: 'old', model: 'Same' },
        { _id: 'new', model: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore __v changes', () => {
      const diff = computeDiff(
        { __v: 0, model: 'Same' },
        { __v: 1, model: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore orgId changes', () => {
      const diff = computeDiff(
        { orgId: 'org1', model: 'Same' },
        { orgId: 'org2', model: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore timestamp fields', () => {
      const diff = computeDiff(
        { createdAt: '2026-01-01', updatedAt: '2026-01-01', model: 'Same' },
        { createdAt: '2026-04-19', updatedAt: '2026-04-19', model: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore sensitive password fields', () => {
      const diff = computeDiff(
        { adminPassword: 'old', passwordHash: 'old', model: 'Same' },
        { adminPassword: 'new', passwordHash: 'new', model: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should detect new field added', () => {
      const diff = computeDiff(
        { model: 'Test' },
        { model: 'Test', notes: 'Added note' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.notes).toBeNull()
      expect(diff!.after.notes).toBe('Added note')
    })

    it('should detect field removed', () => {
      const diff = computeDiff(
        { model: 'Test', notes: 'Had notes' },
        { model: 'Test' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.notes).toBe('Had notes')
      expect(diff!.after.notes).toBeNull()
    })

    it('should detect nested object changes', () => {
      const diff = computeDiff(
        { config: { color: 'red' } },
        { config: { color: 'blue' } }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.config).toEqual({ color: 'red' })
      expect(diff!.after.config).toEqual({ color: 'blue' })
    })

    it('should detect array changes', () => {
      const diff = computeDiff(
        { tags: ['laptop'] },
        { tags: ['laptop', 'refurbished'] }
      )
      expect(diff).not.toBeNull()
    })

    it('should treat null and undefined equally', () => {
      const diff = computeDiff(
        { notes: null },
        { notes: undefined }
      )
      expect(diff).toBeNull()
    })

    it('should handle empty objects', () => {
      expect(computeDiff({}, {})).toBeNull()
    })

    it('should handle mixed ignored + changed fields', () => {
      const diff = computeDiff(
        { _id: 'old', orgId: 'old', model: 'Old', createdAt: 'old' },
        { _id: 'new', orgId: 'new', model: 'New', createdAt: 'new' }
      )
      expect(diff).not.toBeNull()
      expect(Object.keys(diff!.before)).toEqual(['model'])
      expect(diff!.before.model).toBe('Old')
      expect(diff!.after.model).toBe('New')
    })
  })
})
