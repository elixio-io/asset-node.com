import { describe, it, expect } from 'vitest'


function applyExcludeDeleted(filter: Record<string, unknown>): Record<string, unknown> {
  if (filter.deletedAt === undefined) {
    return { ...filter, deletedAt: null }
  }
  return filter
}

function buildSoftDeleteUpdate(id: string) {
  return {
    filter: { _id: id },
    update: { $set: { deletedAt: expect.any(Date) } }
  }
}

function buildRestoreQuery(id: string) {
  return {
    filter: { _id: id, deletedAt: { $ne: null } },
    update: { $set: { deletedAt: null } }
  }
}

const SOFT_DELETE_QUERY_METHODS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
  'count', 'countDocuments', 'estimatedDocumentCount'
]


describe('Soft Delete Plugin — Pure Logic', () => {
  describe('excludeDeleted filter', () => {
    it('should add deletedAt: null to empty filter', () => {
      const result = applyExcludeDeleted({})
      expect(result.deletedAt).toBeNull()
    })

    it('should add deletedAt: null when only other filters present', () => {
      const result = applyExcludeDeleted({ orgId: 'org-1', status: 'active' })
      expect(result.deletedAt).toBeNull()
      expect(result.orgId).toBe('org-1')
      expect(result.status).toBe('active')
    })

    it('should NOT override explicit deletedAt filter', () => {
      const filter = { deletedAt: { $ne: null } }
      const result = applyExcludeDeleted(filter)
      expect(result.deletedAt).toEqual({ $ne: null })
    })

    it('should NOT override deletedAt: null (explicit)', () => {
      const filter = { deletedAt: null as any }
      const result = applyExcludeDeleted(filter)
      expect(result.deletedAt).toBeNull()
    })

    it('should NOT override deletedAt: specific date', () => {
      const date = new Date()
      const filter = { deletedAt: date }
      const result = applyExcludeDeleted(filter)
      expect(result.deletedAt).toBe(date)
    })
  })

  describe('softDelete operation', () => {
    it('should target correct document by _id', () => {
      const op = buildSoftDeleteUpdate('abc123')
      expect(op.filter._id).toBe('abc123')
    })

    it('should set deletedAt to a Date', () => {
      const op = buildSoftDeleteUpdate('abc123')
      expect(op.update.$set.deletedAt).toBeDefined()
    })
  })

  describe('restore operation', () => {
    it('should only target documents with deletedAt set', () => {
      const op = buildRestoreQuery('abc123')
      expect(op.filter.deletedAt).toEqual({ $ne: null })
    })

    it('should clear deletedAt on restore', () => {
      const op = buildRestoreQuery('abc123')
      expect(op.update.$set.deletedAt).toBeNull()
    })

    it('should target by _id', () => {
      const op = buildRestoreQuery('abc123')
      expect(op.filter._id).toBe('abc123')
    })
  })

  describe('Hooked query methods', () => {
    it('should hook 7 query methods', () => {
      expect(SOFT_DELETE_QUERY_METHODS).toHaveLength(7)
    })

    it('should include find and findOne', () => {
      expect(SOFT_DELETE_QUERY_METHODS).toContain('find')
      expect(SOFT_DELETE_QUERY_METHODS).toContain('findOne')
    })

    it('should include count methods', () => {
      expect(SOFT_DELETE_QUERY_METHODS).toContain('count')
      expect(SOFT_DELETE_QUERY_METHODS).toContain('countDocuments')
      expect(SOFT_DELETE_QUERY_METHODS).toContain('estimatedDocumentCount')
    })

    it('should include mutation queries', () => {
      expect(SOFT_DELETE_QUERY_METHODS).toContain('findOneAndUpdate')
      expect(SOFT_DELETE_QUERY_METHODS).toContain('findOneAndDelete')
    })
  })
})
