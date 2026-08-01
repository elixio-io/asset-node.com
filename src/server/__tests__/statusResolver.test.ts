import { describe, it, expect, vi, beforeEach } from 'vitest'


class StatusCache {
  private cache = new Map<string, Map<string, string>>()

  get(orgId: string, slug: string): string | undefined {
    return this.cache.get(orgId)?.get(slug)
  }

  set(orgId: string, slug: string, statusId: string): void {
    let orgCache = this.cache.get(orgId)
    if (!orgCache) {
      orgCache = new Map()
      this.cache.set(orgId, orgCache)
    }
    orgCache.set(slug, statusId)
  }

  has(orgId: string, slug: string): boolean {
    return this.cache.get(orgId)?.has(slug) ?? false
  }

  clearOrg(orgId: string): void {
    this.cache.delete(orgId)
  }

  clearAll(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  orgCacheSize(orgId: string): number {
    return this.cache.get(orgId)?.size ?? 0
  }
}


describe('Status Resolver — Cache Logic', () => {
  let cache: StatusCache

  beforeEach(() => {
    cache = new StatusCache()
  })

  describe('Cache CRUD', () => {
    it('should return undefined for uncached status', () => {
      expect(cache.get('org-1', 'available')).toBeUndefined()
    })

    it('should store and retrieve a status', () => {
      cache.set('org-1', 'available', 'status-id-123')
      expect(cache.get('org-1', 'available')).toBe('status-id-123')
    })

    it('should return false for has() on uncached status', () => {
      expect(cache.has('org-1', 'available')).toBe(false)
    })

    it('should return true for has() on cached status', () => {
      cache.set('org-1', 'available', 'id-1')
      expect(cache.has('org-1', 'available')).toBe(true)
    })
  })

  describe('Tenant isolation (cache per org)', () => {
    it('should isolate caches between orgs', () => {
      cache.set('org-1', 'available', 'id-org1')
      cache.set('org-2', 'available', 'id-org2')
      expect(cache.get('org-1', 'available')).toBe('id-org1')
      expect(cache.get('org-2', 'available')).toBe('id-org2')
    })

    it('org-2 should NOT see org-1s statuses', () => {
      cache.set('org-1', 'deployed', 'id-deployed-1')
      expect(cache.get('org-2', 'deployed')).toBeUndefined()
    })
  })

  describe('Multiple slugs per org', () => {
    it('should store multiple slugs for same org', () => {
      cache.set('org-1', 'available', 'id-1')
      cache.set('org-1', 'deployed', 'id-2')
      cache.set('org-1', 'retired', 'id-3')
      expect(cache.orgCacheSize('org-1')).toBe(3)
    })

    it('should overwrite existing slug value', () => {
      cache.set('org-1', 'available', 'old-id')
      cache.set('org-1', 'available', 'new-id')
      expect(cache.get('org-1', 'available')).toBe('new-id')
    })
  })

  describe('Cache invalidation', () => {
    it('clearOrg should remove all statuses for that org', () => {
      cache.set('org-1', 'available', 'id-1')
      cache.set('org-1', 'deployed', 'id-2')
      cache.set('org-2', 'available', 'id-3')
      cache.clearOrg('org-1')
      expect(cache.get('org-1', 'available')).toBeUndefined()
      expect(cache.get('org-1', 'deployed')).toBeUndefined()
      expect(cache.get('org-2', 'available')).toBe('id-3')
    })

    it('clearAll should remove everything', () => {
      cache.set('org-1', 'available', 'id-1')
      cache.set('org-2', 'deployed', 'id-2')
      cache.clearAll()
      expect(cache.size).toBe(0)
    })

    it('clearOrg on non-existent org should be a no-op', () => {
      cache.set('org-1', 'available', 'id-1')
      cache.clearOrg('org-999')
      expect(cache.get('org-1', 'available')).toBe('id-1')
    })
  })

  describe('System status slugs', () => {
    const SYSTEM_SLUGS = [
      'available', 'deployed', 'in_repair', 'broken',
      'retired', 'lost', 'in_storage', 'ordered', 'reserved'
    ]

    it('all 9 system slugs should be cacheable', () => {
      SYSTEM_SLUGS.forEach((slug, i) => {
        cache.set('org-1', slug, `id-${i}`)
      })
      expect(cache.orgCacheSize('org-1')).toBe(9)
      SYSTEM_SLUGS.forEach((slug, i) => {
        expect(cache.get('org-1', slug)).toBe(`id-${i}`)
      })
    })
  })
})
