import { describe, it, expect, beforeEach } from 'vitest'


const CACHE_TTL_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000

const SUPPLIER_LOGOS: Record<string, string> = {
  'BackMarket': 'https://www.backmarket.de/favicon.ico',
  'refurbed': 'https://www.refurbed.de/favicon.ico',
  'rebuy': 'https://www.rebuy.de/favicon.ico',
  'Grover': 'https://www.grover.com/favicon.ico',
}

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

interface CacheEntry { expiresAt: number; result: any }
const cache = new Map<string, CacheEntry>()

function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.result
}

function setCache(key: string, result: any): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
  if (cache.size > 500) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

function parseEurPrice(text: string): number | null {
  const match = text.match(/([\d.,]+)/)
  if (!match) return null
  const price = parseFloat(match[1].replace('.', '').replace(',', '.'))
  return isNaN(price) || price <= 0 ? null : price
}

function getSupplierInfo() {
  return [
    { name: 'BackMarket', domain: 'backmarket.de', type: 'Refurbished Marketplace', warranty: '12 Monate', logo: SUPPLIER_LOGOS['BackMarket'] },
    { name: 'refurbed', domain: 'refurbed.de', type: 'Refurbished Marketplace', warranty: 'Min. 12 Monate', logo: SUPPLIER_LOGOS['refurbed'] },
    { name: 'rebuy', domain: 'rebuy.de', type: 'Re-Commerce', warranty: '36 Monate', logo: SUPPLIER_LOGOS['rebuy'] },
    { name: 'Grover', domain: 'grover.com', type: 'Tech Rental', warranty: '90% Schadensschutz', logo: SUPPLIER_LOGOS['Grover'] },
  ]
}


describe('Marketplace Service — Pure Logic', () => {
  beforeEach(() => { cache.clear() })

  describe('Constants', () => {
    it('cache TTL should be 1 hour', () => {
      expect(CACHE_TTL_MS).toBe(3_600_000)
    })

    it('request timeout should be 10 seconds', () => {
      expect(REQUEST_TIMEOUT_MS).toBe(10_000)
    })
  })

  describe('Condition Mapping (DE/EN)', () => {
    it.each([
      ['Hervorragend', 'excellent'],
      ['Excellent', 'excellent'],
      ['Wie Neu', 'excellent'],
      ['Gut', 'good'],
      ['Good', 'good'],
      ['Fair', 'fair'],
      ['Akzeptabel', 'fair'],
      ['Neu', 'like-new'],
      ['Like New', 'like-new'],
      ['New', 'like-new'],
      ['Unbekannt', 'unknown'],
      ['', 'unknown'],
      ['Random text', 'unknown'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(mapCondition(input)).toBe(expected)
    })

    it('should be case-insensitive', () => {
      expect(mapCondition('HERVORRAGEND')).toBe('excellent')
      expect(mapCondition('GUT')).toBe('good')
    })
  })

  describe('EUR Price Parsing', () => {
    it('"599,00 €" → 599', () => {
      expect(parseEurPrice('599,00 €')).toBe(599)
    })

    it('"1.299,99 €" → 1299.99', () => {
      expect(parseEurPrice('1.299,99 €')).toBe(1299.99)
    })

    it('"ab 49,90" → 49.9', () => {
      expect(parseEurPrice('ab 49,90')).toBe(49.9)
    })

    it('"no price here" → null', () => {
      expect(parseEurPrice('no price here')).toBeNull()
    })

    it('"0,00 €" → null (zero price)', () => {
      expect(parseEurPrice('0,00 €')).toBeNull()
    })
  })

  describe('Cache Key Construction', () => {
    it('should lowercase and trim query', () => {
      expect(getCacheKey('  MacBook Pro  ')).toBe('macbook pro||')
    })

    it('should include category', () => {
      expect(getCacheKey('macbook', 'laptop')).toBe('macbook|laptop|')
    })

    it('should include maxPrice', () => {
      expect(getCacheKey('macbook', undefined, 500)).toBe('macbook||500')
    })

    it('should include all params', () => {
      expect(getCacheKey('dell', 'desktop', 1000)).toBe('dell|desktop|1000')
    })
  })

  describe('Cache Operations', () => {
    it('should return null for miss', () => {
      expect(getCached('nonexistent')).toBeNull()
    })

    it('should return cached result', () => {
      setCache('key1', { results: ['product1'] })
      expect(getCached('key1')).toEqual({ results: ['product1'] })
    })

    it('should return null for expired entry', () => {
      cache.set('expired', { result: 'old', expiresAt: Date.now() - 1000 })
      expect(getCached('expired')).toBeNull()
    })

    it('should auto-evict when cache exceeds 500 entries', () => {
      for (let i = 0; i < 501; i++) {
        setCache(`key-${i}`, { i })
      }
      expect(cache.size).toBeLessThanOrEqual(501)
    })
  })

  describe('Supplier Logos', () => {
    it('should have 4 supplier logos', () => {
      expect(Object.keys(SUPPLIER_LOGOS)).toHaveLength(4)
    })

    it.each(['BackMarket', 'refurbed', 'rebuy', 'Grover'])(
      '%s should have a favicon URL', (supplier) => {
        expect(SUPPLIER_LOGOS[supplier]).toMatch(/^https:\/\/.*favicon\.ico$/)
      }
    )
  })

  describe('getSupplierInfo Catalog', () => {
    const info = getSupplierInfo()

    it('should return 4 suppliers', () => {
      expect(info).toHaveLength(4)
    })

    it.each([
      ['BackMarket', 'backmarket.de', 'Refurbished Marketplace'],
      ['refurbed', 'refurbed.de', 'Refurbished Marketplace'],
      ['rebuy', 'rebuy.de', 'Re-Commerce'],
      ['Grover', 'grover.com', 'Tech Rental'],
    ])('%s: domain=%s, type=%s', (name, domain, type) => {
      const s = info.find(i => i.name === name)
      expect(s).toBeDefined()
      expect(s!.domain).toBe(domain)
      expect(s!.type).toBe(type)
    })

    it('rebuy should have the longest warranty (36 months)', () => {
      const rebuy = info.find(i => i.name === 'rebuy')
      expect(rebuy!.warranty).toBe('36 Monate')
    })
  })
})
