import { describe, it, expect, beforeEach } from 'vitest'


type Condition = 'excellent' | 'good' | 'fair' | 'like-new' | 'unknown'

function mapCondition(raw: string): Condition {
  const lower = raw.toLowerCase()
  if (lower.includes('hervorragend') || lower.includes('excellent') || lower.includes('wie neu')) return 'excellent'
  if (lower.includes('gut') || lower.includes('good')) return 'good'
  if (lower.includes('fair') || lower.includes('akzeptabel')) return 'fair'
  if (lower.includes('neu') || lower.includes('new') || lower.includes('like new')) return 'like-new'
  return 'unknown'
}

function getCacheKey(query: string, category?: string, maxPrice?: number): string {
  return `${query.toLowerCase().trim()}|${category || ''}|${maxPrice || ''}`
}

const CACHE_TTL_MS = 60 * 60 * 1000

interface CacheEntry { result: any; expiresAt: number }

class MarketplaceCache {
  private cache = new Map<string, CacheEntry>()

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null }
    return entry.result
  }

  set(key: string, result: any): void {
    this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    if (this.cache.size > 500) {
      const oldest = this.cache.keys().next().value
      if (oldest) this.cache.delete(oldest)
    }
  }

  get size() { return this.cache.size }
}

interface MarketplaceProduct {
  title: string; price: number; currency: string; condition: Condition
  supplier: string; url: string
}

function filterAndSort(products: MarketplaceProduct[], maxPrice?: number): MarketplaceProduct[] {
  let filtered = products
  if (maxPrice) filtered = filtered.filter(p => p.price <= maxPrice)
  filtered.sort((a, b) => a.price - b.price)
  return filtered
}

function getSupplierInfo() {
  return [
    { name: 'BackMarket', domain: 'backmarket.de', type: 'Refurbished Marketplace', warranty: '12 Monate' },
    { name: 'refurbed', domain: 'refurbed.de', type: 'Refurbished Marketplace', warranty: 'Min. 12 Monate' },
    { name: 'rebuy', domain: 'rebuy.de', type: 'Re-Commerce', warranty: '36 Monate' },
    { name: 'Grover', domain: 'grover.com', type: 'Tech Rental', warranty: '90% Schadensschutz' }
  ]
}


describe('Marketplace Service — Pure Logic', () => {
  describe('Condition Mapping', () => {
    it.each([
      ['Hervorragend', 'excellent'],
      ['hervorragend zustand', 'excellent'],
      ['excellent condition', 'excellent'],
      ['Wie Neu', 'excellent'],
      ['wie neu, kaum benutzt', 'excellent'],
      ['Gut', 'good'],
      ['good', 'good'],
      ['Guter Zustand', 'good'],
      ['Fair', 'fair'],
      ['Akzeptabel', 'fair'],
      ['akzeptabler zustand', 'unknown'],
      ['Neu', 'like-new'],
      ['Like New', 'like-new'],
      ['like new', 'like-new'],
      ['', 'unknown'],
      ['random text', 'unknown'],
      ['gebraucht', 'unknown'],
    ] as const)('should map "%s" → %s', (input, expected) => {
      expect(mapCondition(input)).toBe(expected)
    })

    it('should be case-insensitive', () => {
      expect(mapCondition('HERVORRAGEND')).toBe('excellent')
      expect(mapCondition('GUT')).toBe('good')
      expect(mapCondition('FAIR')).toBe('fair')
    })
  })

  describe('Cache Key Generation', () => {
    it('should lowercase and trim query', () => {
      expect(getCacheKey('  MacBook Pro  ')).toBe('macbook pro||')
    })

    it('should include category when provided', () => {
      expect(getCacheKey('laptop', 'apple')).toBe('laptop|apple|')
    })

    it('should include maxPrice when provided', () => {
      expect(getCacheKey('laptop', undefined, 1000)).toBe('laptop||1000')
    })

    it('should include both category and maxPrice', () => {
      expect(getCacheKey('laptop', 'apple', 1500)).toBe('laptop|apple|1500')
    })

    it('same query should produce same key', () => {
      expect(getCacheKey('MacBook Pro')).toBe(getCacheKey('macbook pro'))
    })

    it('different queries should produce different keys', () => {
      expect(getCacheKey('MacBook')).not.toBe(getCacheKey('ThinkPad'))
    })
  })

  describe('Cache TTL', () => {
    it('should be 1 hour (3,600,000ms)', () => {
      expect(CACHE_TTL_MS).toBe(3_600_000)
    })
  })

  describe('Cache Store', () => {
    let cache: MarketplaceCache

    beforeEach(() => { cache = new MarketplaceCache() })

    it('should return null for uncached key', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should store and retrieve', () => {
      cache.set('key1', { data: 'test' })
      expect(cache.get('key1')).toEqual({ data: 'test' })
    })

    it('should evict when cache > 500 entries', () => {
      for (let i = 0; i < 501; i++) cache.set(`key-${i}`, { i })
      expect(cache.size).toBeLessThanOrEqual(501)
      expect(cache.get('key-0')).toBeNull()
    })
  })

  describe('Filter & Sort', () => {
    const products: MarketplaceProduct[] = [
      { title: 'MacBook Air', price: 899, currency: 'EUR', condition: 'good', supplier: 'BackMarket', url: 'http://example.com/1' },
      { title: 'ThinkPad X1', price: 650, currency: 'EUR', condition: 'fair', supplier: 'rebuy', url: 'http://example.com/2' },
      { title: 'MacBook Pro', price: 1299, currency: 'EUR', condition: 'excellent', supplier: 'refurbed', url: 'http://example.com/3' },
      { title: 'Dell XPS', price: 550, currency: 'EUR', condition: 'good', supplier: 'rebuy', url: 'http://example.com/4' },
    ]

    it('should sort by price ascending', () => {
      const sorted = filterAndSort(products)
      expect(sorted[0].price).toBe(550)
      expect(sorted[1].price).toBe(650)
      expect(sorted[2].price).toBe(899)
      expect(sorted[3].price).toBe(1299)
    })

    it('should filter by maxPrice', () => {
      const filtered = filterAndSort(products, 700)
      expect(filtered).toHaveLength(2)
      expect(filtered[0].title).toBe('Dell XPS')
      expect(filtered[1].title).toBe('ThinkPad X1')
    })

    it('should return empty array when maxPrice excludes all', () => {
      expect(filterAndSort(products, 100)).toHaveLength(0)
    })

    it('should return all when no maxPrice', () => {
      expect(filterAndSort(products)).toHaveLength(4)
    })
  })

  describe('Supplier Info', () => {
    const suppliers = getSupplierInfo()

    it('should list 4 suppliers', () => {
      expect(suppliers).toHaveLength(4)
    })

    it('should include BackMarket', () => {
      expect(suppliers.find(s => s.name === 'BackMarket')).toBeDefined()
    })

    it('should include refurbed', () => {
      expect(suppliers.find(s => s.name === 'refurbed')).toBeDefined()
    })

    it('should include rebuy with correct warranty', () => {
      const rebuy = suppliers.find(s => s.name === 'rebuy')!
      expect(rebuy.warranty).toBe('36 Monate')
    })

    it('should include Grover as Tech Rental', () => {
      const grover = suppliers.find(s => s.name === 'Grover')!
      expect(grover.type).toBe('Tech Rental')
    })

    it('all suppliers should have domain set', () => {
      suppliers.forEach(s => expect(s.domain).toBeTruthy())
    })
  })
})
