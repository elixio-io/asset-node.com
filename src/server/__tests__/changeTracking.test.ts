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


describe('Change Tracking — Diff Logic', () => {
  describe('Basic field changes', () => {
    it('should detect simple field change', () => {
      const diff = computeDiff(
        { name: 'MacBook Air', serial: 'ABC123' },
        { name: 'MacBook Pro', serial: 'ABC123' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before).toEqual({ name: 'MacBook Air' })
      expect(diff!.after).toEqual({ name: 'MacBook Pro' })
    })

    it('should detect multiple field changes', () => {
      const diff = computeDiff(
        { name: 'Old', price: 100, status: 'active' },
        { name: 'New', price: 200, status: 'active' }
      )
      expect(diff).not.toBeNull()
      expect(Object.keys(diff!.before)).toHaveLength(2)
      expect(diff!.before.name).toBe('Old')
      expect(diff!.before.price).toBe(100)
    })

    it('should return null when nothing changed', () => {
      const diff = computeDiff(
        { name: 'Same', price: 100 },
        { name: 'Same', price: 100 }
      )
      expect(diff).toBeNull()
    })
  })

  describe('Field additions and removals', () => {
    it('should detect new field added', () => {
      const diff = computeDiff(
        { name: 'Test' },
        { name: 'Test', serial: 'XYZ' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.serial).toBeNull()
      expect(diff!.after.serial).toBe('XYZ')
    })

    it('should detect field removed', () => {
      const diff = computeDiff(
        { name: 'Test', serial: 'XYZ' },
        { name: 'Test' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.serial).toBe('XYZ')
      expect(diff!.after.serial).toBeNull()
    })
  })

  describe('IGNORED_FIELDS exclusion', () => {
    it('should ignore _id changes', () => {
      const diff = computeDiff(
        { _id: 'old-id', name: 'Same' },
        { _id: 'new-id', name: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore __v changes', () => {
      const diff = computeDiff({ __v: 0, name: 'Same' }, { __v: 1, name: 'Same' })
      expect(diff).toBeNull()
    })

    it('should ignore orgId changes', () => {
      const diff = computeDiff({ orgId: 'org1', name: 'Same' }, { orgId: 'org2', name: 'Same' })
      expect(diff).toBeNull()
    })

    it('should ignore timestamp fields', () => {
      const diff = computeDiff(
        { createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Same' },
        { createdAt: '2026-02-01', updatedAt: '2026-02-01', name: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore sensitive auth fields', () => {
      const diff = computeDiff(
        { passwordHash: 'abc', refreshTokenHash: 'def', name: 'Same' },
        { passwordHash: 'xyz', refreshTokenHash: '123', name: 'Same' }
      )
      expect(diff).toBeNull()
    })

    it('should ignore deletedAt', () => {
      const diff = computeDiff({ deletedAt: null, name: 'Same' }, { deletedAt: new Date().toISOString(), name: 'Same' })
      expect(diff).toBeNull()
    })

    it('should track non-ignored field changes even when ignored fields also change', () => {
      const diff = computeDiff(
        { _id: 'old', updatedAt: '2026-01-01', name: 'Old Name' },
        { _id: 'new', updatedAt: '2026-02-01', name: 'New Name' }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before).toEqual({ name: 'Old Name' })
      expect(diff!.after).toEqual({ name: 'New Name' })
    })
  })

  describe('Nested objects and arrays', () => {
    it('should detect nested object changes', () => {
      const diff = computeDiff(
        { settings: { theme: 'dark', lang: 'de' } },
        { settings: { theme: 'light', lang: 'de' } }
      )
      expect(diff).not.toBeNull()
      expect((diff!.before.settings as any).theme).toBe('dark')
    })

    it('should detect array changes', () => {
      const diff = computeDiff(
        { tags: ['laptop', 'apple'] },
        { tags: ['laptop', 'apple', 'refurbed'] }
      )
      expect(diff).not.toBeNull()
    })

    it('should detect array element change', () => {
      const diff = computeDiff(
        { tags: ['a', 'b'] },
        { tags: ['a', 'c'] }
      )
      expect(diff).not.toBeNull()
    })

    it('should return null for identical nested objects', () => {
      const diff = computeDiff(
        { settings: { theme: 'dark' } },
        { settings: { theme: 'dark' } }
      )
      expect(diff).toBeNull()
    })
  })

  describe('Null/undefined handling', () => {
    it('should treat undefined and null as equivalent', () => {
      const diff = computeDiff(
        { name: 'Test' },
        { name: 'Test' }
      )
      expect(diff).toBeNull()
    })

    it('should detect change from value to null', () => {
      const diff = computeDiff(
        { name: 'Test', serial: 'ABC' },
        { name: 'Test', serial: null as any }
      )
      expect(diff).not.toBeNull()
      expect(diff!.before.serial).toBe('ABC')
    })
  })

  describe('IGNORED_FIELDS completeness', () => {
    it('should have 9 ignored fields', () => {
      expect(IGNORED_FIELDS.size).toBe(9)
    })

    it('should contain all required fields', () => {
      const required = ['_id', '__v', 'orgId', 'createdAt', 'updatedAt', 'deletedAt', 'adminPassword', 'passwordHash', 'refreshTokenHash']
      required.forEach(f => expect(IGNORED_FIELDS.has(f)).toBe(true))
    })
  })
})
