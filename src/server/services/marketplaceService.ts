
import {
  searchProducts,
  getProductDetail as getTechSpecsDetail,
  getIcecatProductDetail,
  getSourceHealth,
  type ProductSearchResult,
  type ProductSearchResponse,
  type ProductDetail,
  type SourceHealth,
} from './productDataService'
import {
  MARKETPLACE_LIVE_DATA,
  TECHSPECS_ENABLED,
  ICECAT_ENABLED,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  type DataSource,
} from '../config/marketplaceConfig'


export interface MarketplaceProduct {
  id: string
  title: string
  brand: string
  category: string
  techSpecsCategory: string
  version?: string
  imageUrl?: string
  dataSource: DataSource
  lastUpdated?: string
}

export interface MarketplaceSearchResult {
  query: string
  category?: string
  results: MarketplaceProduct[]
  totalFound: number
  totalPages: number
  page: number
  sources: { name: string; status: string; enabled: boolean }[]
  mode: 'live' | 'offline'
  cachedAt?: string
  duration: number
}

export interface MarketplaceProductDetail {
  id: string
  brand: string
  model: string
  version: string
  category: string
  ean?: string
  sku?: string
  specs: Record<string, Record<string, string>>
  keyAspects?: Record<string, string>
  gallery: Array<{ url: string; thumbnail: string; color?: string }>
  weight?: string
  dimensions?: string
  displaySize?: string
  displayResolution?: string
  displayType?: string
  cpu?: string
  ram?: string
  storage?: string
  addedOn?: string
}


export async function searchMarketplace(
  query: string,
  category?: string,
  page = 0,
): Promise<MarketplaceSearchResult> {
  const startTime = Date.now()

  if (!MARKETPLACE_LIVE_DATA || (!TECHSPECS_ENABLED && !ICECAT_ENABLED)) {
    return {
      query,
      category,
      results: [],
      totalFound: 0,
      totalPages: 0,
      page: 0,
      sources: [{ name: 'All APIs', status: 'disabled', enabled: false }],
      mode: 'offline',
      duration: Date.now() - startTime,
    }
  }

  try {
    const liveResults = await searchProducts(query, category, page)

    const products: MarketplaceProduct[] = liveResults.results.map(r => ({
      id: r.id,
      title: r.title,
      brand: r.brand,
      category: r.category,
      techSpecsCategory: r.techSpecsCategory,
      version: r.version,
      imageUrl: r.imageUrl,
      dataSource: r.dataSource,
      lastUpdated: r.lastUpdated,
    }))

    const sources = liveResults.sources.map(s => ({
      name: s.name,
      status: s.status,
      enabled: s.status !== 'disabled',
    }))

    return {
      query,
      category,
      results: products,
      totalFound: liveResults.totalFound,
      totalPages: liveResults.totalPages,
      page: liveResults.page,
      sources,
      mode: 'live',
      cachedAt: liveResults.cachedAt,
      duration: Date.now() - startTime,
    }
  } catch (err) {
    console.error('[Marketplace] Search failed:', (err as Error).message)
    return {
      query,
      category,
      results: [],
      totalFound: 0,
      totalPages: 0,
      page: 0,
      sources: [{ name: 'TechSpecs API', status: 'error', enabled: true }],
      mode: 'offline',
      duration: Date.now() - startTime,
    }
  }
}

export async function getMarketplaceProductDetail(
  productId: string,
): Promise<MarketplaceProductDetail | null> {
  let detail: ProductDetail | null = null

  if (productId.startsWith('icecat:')) {
    const parts = productId.split(':')
    if (parts.length >= 3) {
      const brand = parts[1]
      const productCode = parts.slice(2).join(':')
      detail = await getIcecatProductDetail(brand, productCode)
    }
  } else {
    detail = await getTechSpecsDetail(productId)
  }

  if (!detail) return null

  return {
    id: detail.id,
    brand: detail.brand,
    model: detail.model,
    version: detail.version,
    category: detail.category,
    ean: detail.ean,
    sku: detail.sku,
    specs: detail.specs,
    keyAspects: detail.keyAspects,
    gallery: detail.gallery,
    weight: detail.weight,
    dimensions: detail.dimensions,
    displaySize: detail.displaySize,
    displayResolution: detail.displayResolution,
    displayType: detail.displayType,
    cpu: detail.cpu,
    ram: detail.ram,
    storage: detail.storage,
    addedOn: detail.addedOn,
  }
}

export function getMarketplaceHealth() {
  return {
    mode: MARKETPLACE_LIVE_DATA ? 'live' : 'offline',
    sources: getSourceHealth(),
    cacheInfo: {
      maxEntries: CACHE_MAX_ENTRIES,
      ttlMs: CACHE_TTL_MS,
    },
  }
}

export { CACHE_TTL_MS, CACHE_MAX_ENTRIES } from '../config/marketplaceConfig'
