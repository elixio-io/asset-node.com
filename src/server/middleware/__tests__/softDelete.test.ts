import { describe, it, expect } from 'vitest'


const HOOKED_QUERY_METHODS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
  'count', 'countDocuments', 'estimatedDocumentCount'
]

function applyExcludeDeleted(filter: Record<string, any>): Record<string, any> {
  const result = { ...filter }
  if (result.deletedAt === undefined) {
    result.deletedAt = null
  }
  return result
}

function buildSoftDeleteUpdate(): { $set: { deletedAt: Date } } {
  return { $set: { deletedAt: new Date() } }
}

function buildRestoreQuery(id: string): { _id: string; deletedAt: { $ne: null } } {
  return { _id: id, deletedAt: { $ne: null } }
}

function buildRestoreUpdate(): { $set: { deletedAt: null } } {
  return { $set: { deletedAt: null } }
}


describe('Soft Delete Plugin — Pure Logic', () => {
  describe('Hooked Query Methods', () => {
    it('should hook 7 query methods', () => {
      expect(HOOKED_QUERY_METHODS).toHaveLength(7)
    })

    it.each([
      'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
      'count', 'countDocuments', 'estimatedDocumentCount'
    ])('should hook "%s"', (method) => {
      expect(HOOKED_QUERY_METHODS).toContain(method)
    })
  })

  describe('Exclude Deleted Filter', () => {
    it('should add deletedAt: null to empty filter', () => {
      const result = applyExcludeDeleted({})
      expect(result).toEqual({ deletedAt: null })
    })

    it('should add deletedAt: null alongside existing filters', () => {
      const result = applyExcludeDeleted({ orgId: 'org-1', isActive: true })
      expect(result).toEqual({ orgId: 'org-1', isActive: true, deletedAt: null })
    })

    it('should NOT override explicit deletedAt condition', () => {
      const result = applyExcludeDeleted({ deletedAt: { $ne: null } })
      expect(result.deletedAt).toEqual({ $ne: null })
    })

    it('should NOT override deletedAt: null (already set)', () => {
      const result = applyExcludeDeleted({ deletedAt: null })
      expect(result.deletedAt).toBeNull()
    })

    it('should preserve all other filter fields', () => {
      const filter = { orgId: 'org-1', categoryId: 'cat-1', statusId: 'stat-1' }
      const result = applyExcludeDeleted(filter)
      expect(result.orgId).toBe('org-1')
      expect(result.categoryId).toBe('cat-1')
      expect(result.statusId).toBe('stat-1')
      expect(result.deletedAt).toBeNull()
    })
  })

  describe('softDelete Method', () => {
    it('should create $set with deletedAt timestamp', () => {
      const before = Date.now()
      const update = buildSoftDeleteUpdate()
      const after = Date.now()

      expect(update.$set.deletedAt).toBeInstanceOf(Date)
      expect(update.$set.deletedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(update.$set.deletedAt.getTime()).toBeLessThanOrEqual(after)
    })
  })

  describe('restore Method', () => {
    it('should build query targeting soft-deleted docs only', () => {
      const query = buildRestoreQuery('doc-123')
      expect(query._id).toBe('doc-123')
      expect(query.deletedAt).toEqual({ $ne: null })
    })

    it('should set deletedAt back to null', () => {
      const update = buildRestoreUpdate()
      expect(update.$set.deletedAt).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('multiple softDelete calls produce unique timestamps', async () => {
      const t1 = buildSoftDeleteUpdate().$set.deletedAt
      await new Promise(r => setTimeout(r, 2))
      const t2 = buildSoftDeleteUpdate().$set.deletedAt
      expect(t1.getTime()).not.toBe(t2.getTime())
    })
  })
})
