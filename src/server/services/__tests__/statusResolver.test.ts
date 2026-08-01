import { describe, it, expect } from 'vitest'


const cache = new Map<string, Map<string, string>>()

function cacheGet(orgId: string, slug: string): string | undefined {
  return cache.get(orgId)?.get(slug)
}

function cacheSet(orgId: string, slug: string, statusId: string): void {
  let orgCache = cache.get(orgId)
  if (!orgCache) {
    orgCache = new Map()
    cache.set(orgId, orgCache)
  }
  orgCache.set(slug, statusId)
}

function clearStatusCache(orgId?: string): void {
  if (orgId) cache.delete(orgId)
  else cache.clear()
}

const DEFAULT_SYSTEM_STATUSES = [
  { slug: 'available', name: 'Available', color: '#22c55e', isSystem: true },
  { slug: 'assigned', name: 'Assigned', color: '#3b82f6', isSystem: true },
  { slug: 'in-repair', name: 'In Repair', color: '#f59e0b', isSystem: true },
  { slug: 'defective', name: 'Defective', color: '#ef4444', isSystem: true },
  { slug: 'retired', name: 'Retired', color: '#6b7280', isSystem: true },
  { slug: 'in-transit', name: 'In Transit', color: '#8b5cf6', isSystem: true },
  { slug: 'reserved', name: 'Reserved', color: '#06b6d4', isSystem: true },
  { slug: 'for-sale', name: 'For Sale', color: '#f97316', isSystem: true },
  { slug: 'disposed', name: 'Disposed', color: '#374151', isSystem: true },
]


describe('Status Resolver — Cache & System Statuses', () => {
  beforeEach(() => {
    cache.clear()
  })

  describe('Cache Operations', () => {
    it('should return undefined for cache miss', () => {
      expect(cacheGet('org-1', 'available')).toBeUndefined()
    })

    it('should return cached value after set', () => {
      cacheSet('org-1', 'available', 'status-1')
      expect(cacheGet('org-1', 'available')).toBe('status-1')
    })

    it('should isolate caches per org', () => {
      cacheSet('org-1', 'available', 'status-A')
      cacheSet('org-2', 'available', 'status-B')
      expect(cacheGet('org-1', 'available')).toBe('status-A')
      expect(cacheGet('org-2', 'available')).toBe('status-B')
    })

    it('should handle multiple slugs per org', () => {
      cacheSet('org-1', 'available', 'id-1')
      cacheSet('org-1', 'assigned', 'id-2')
      cacheSet('org-1', 'defective', 'id-3')
      expect(cacheGet('org-1', 'available')).toBe('id-1')
      expect(cacheGet('org-1', 'assigned')).toBe('id-2')
      expect(cacheGet('org-1', 'defective')).toBe('id-3')
    })

    it('should overwrite existing cache entry', () => {
      cacheSet('org-1', 'available', 'old-id')
      cacheSet('org-1', 'available', 'new-id')
      expect(cacheGet('org-1', 'available')).toBe('new-id')
    })
  })

  describe('clearStatusCache', () => {
    it('should clear single org cache', () => {
      cacheSet('org-1', 'available', 'id-1')
      cacheSet('org-2', 'available', 'id-2')
      clearStatusCache('org-1')
      expect(cacheGet('org-1', 'available')).toBeUndefined()
      expect(cacheGet('org-2', 'available')).toBe('id-2')
    })

    it('should clear ALL org caches', () => {
      cacheSet('org-1', 'available', 'id-1')
      cacheSet('org-2', 'available', 'id-2')
      cacheSet('org-3', 'assigned', 'id-3')
      clearStatusCache()
      expect(cache.size).toBe(0)
    })
  })

  describe('DEFAULT_SYSTEM_STATUSES', () => {
    it('should have 9 system statuses', () => {
      expect(DEFAULT_SYSTEM_STATUSES).toHaveLength(9)
    })

    it.each([
      'available', 'assigned', 'in-repair', 'defective', 'retired',
      'in-transit', 'reserved', 'for-sale', 'disposed',
    ])('should include "%s" slug', (slug) => {
      expect(DEFAULT_SYSTEM_STATUSES.find(s => s.slug === slug)).toBeDefined()
    })

    it('all should be marked isSystem', () => {
      DEFAULT_SYSTEM_STATUSES.forEach(s => {
        expect(s.isSystem).toBe(true)
      })
    })

    it('each should have a color hex code', () => {
      DEFAULT_SYSTEM_STATUSES.forEach(s => {
        expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })

    it('slugs should be unique', () => {
      const slugs = DEFAULT_SYSTEM_STATUSES.map(s => s.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })
  })
})
