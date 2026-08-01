
import {
  TECHSPECS_API_KEY,
  TECHSPECS_API_ID,
  TECHSPECS_BASE_URL,
  TECHSPECS_TIMEOUT_MS,
  TECHSPECS_ENABLED,
  ICECAT_USERNAME,
  ICECAT_APP_KEY,
  ICECAT_BASE_URL,
  ICECAT_TIMEOUT_MS,
  ICECAT_ENABLED,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  type DataSource,
} from '../config/marketplaceConfig'


export interface ProductSearchResult {
  id: string
  title: string
  brand: string
  category: string
  techSpecsCategory: string
  version?: string
  imageUrl?: string
  dataSource: DataSource
  lastUpdated: string
}

export interface ProductSearchResponse {
  query: string
  category?: string
  results: ProductSearchResult[]
  totalFound: number
  totalPages: number
  page: number
  sources: SourceStatus[]
  cachedAt?: string
  duration: number
}

export interface ProductDetail {
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

export interface SourceStatus {
  name: string
  status: 'ok' | 'error' | 'disabled' | 'rate-limited'
  count: number
  latencyMs?: number
}


function techSpecsHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'x-api-key': TECHSPECS_API_KEY,
    'x-api-id': TECHSPECS_API_ID,
  }
}


interface CacheEntry<T> {
  data: T
  cachedAt: number
}

const searchCache = new Map<string, CacheEntry<ProductSearchResponse>>()
const detailCache = new Map<string, CacheEntry<ProductDetail>>()

function getCacheKey(query: string, category?: string, page?: number): string {
  return `${query.toLowerCase().trim()}:${category || '*'}:${page || 0}`
}

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): (T & { cachedAt?: string }) | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return { ...entry.data, cachedAt: new Date(entry.cachedAt).toISOString() }
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, maxEntries = CACHE_MAX_ENTRIES): void {
  if (cache.size >= maxEntries) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { data, cachedAt: Date.now() })
}


function mapCategoryToTechSpecs(cat: string): string {
  const map: Record<string, string> = {
    laptop: 'Laptops',
    desktop: 'Desktops',
    phone: 'Smartphones',
    tablet: 'Tablets',
    monitor: 'Displays',
    smartwatch: 'Smartwatches',
    gpu: 'GPUs',
  }
  return map[cat] || cat
}

function mapTechSpecsCategoryBack(cat: string): string {
  const map: Record<string, string> = {
    'Laptops': 'laptop',
    'Desktops': 'desktop',
    'Smartphones': 'phone',
    'Tablets': 'tablet',
    'Displays': 'monitor',
    'Monitors': 'monitor',
    'TVs': 'monitor',
    'Smartwatches': 'smartwatch',
    'GPUs': 'gpu',
  }
  return map[cat] || 'other'
}


interface TechSpecsSearchItem {
  Product: {
    id: string
    Brand: string
    Category: string
    Model: string
    Version?: string
    Thumbnail?: string
  }
  'Release Date'?: string
  Image?: string
}

interface TechSpecsSearchResponse {
  status: string
  total_results: number
  total_results_per_page: number
  total_pages: number
  page: number
  data: TechSpecsSearchItem[]
}

export async function searchTechSpecs(
  query: string,
  category?: string,
  page = 0,
  size = 20,
): Promise<{
  results: ProductSearchResult[]
  totalFound: number
  totalPages: number
  page: number
  status: SourceStatus
}> {
  if (!TECHSPECS_ENABLED) {
    return {
      results: [],
      totalFound: 0,
      totalPages: 0,
      page: 0,
      status: { name: 'TechSpecs API', status: 'disabled', count: 0 },
    }
  }

  const startTime = Date.now()

  try {
    const params = new URLSearchParams({
      query,
      page: String(page),
      size: String(Math.max(10, size)),
      keepCasing: 'true',
    })
    if (category) params.set('category', mapCategoryToTechSpecs(category))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TECHSPECS_TIMEOUT_MS)

    const response = await fetch(`${TECHSPECS_BASE_URL}/products/search?${params}`, {
      method: 'GET',
      headers: techSpecsHeaders(),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.status === 429 || response.status === 402) {
      const msg = response.status === 402 ? 'API limit reached' : 'Rate limited'
      console.warn(`[TechSpecs] ${msg}`)
      return {
        results: [],
        totalFound: 0,
        totalPages: 0,
        page: 0,
        status: { name: 'TechSpecs API', status: 'rate-limited', count: 0, latencyMs: Date.now() - startTime },
      }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`[TechSpecs] Search error: ${response.status} — ${body.slice(0, 300)}`)
      return {
        results: [],
        totalFound: 0,
        totalPages: 0,
        page: 0,
        status: { name: 'TechSpecs API', status: 'error', count: 0, latencyMs: Date.now() - startTime },
      }
    }

    const data = await response.json() as TechSpecsSearchResponse
    const items = data?.data || []

    const results: ProductSearchResult[] = items.map(item => ({
      id: item.Product.id,
      title: item.Product.Version
        ? `${item.Product.Model} (${item.Product.Version})`
        : item.Product.Model,
      brand: item.Product.Brand || 'Unknown',
      category: mapTechSpecsCategoryBack(item.Product.Category),
      techSpecsCategory: item.Product.Category,
      version: item.Product.Version || undefined,
      imageUrl: item.Product.Thumbnail || undefined,
      dataSource: 'techspecs' as const,
      lastUpdated: new Date().toISOString(),
    }))

    console.log(`[TechSpecs] Search "${query}" → ${data.total_results} total, page ${data.page}/${data.total_pages}, returning ${results.length}`)

    return {
      results,
      totalFound: data.total_results || 0,
      totalPages: data.total_pages || 0,
      page: data.page || 0,
      status: { name: 'TechSpecs API', status: 'ok', count: results.length, latencyMs: Date.now() - startTime },
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[TechSpecs] Search request timed out')
    } else {
      console.warn(`[TechSpecs] Search error: ${err.message}`)
    }
    return {
      results: [],
      totalFound: 0,
      totalPages: 0,
      page: 0,
      status: { name: 'TechSpecs API', status: 'error', count: 0, latencyMs: Date.now() - startTime },
    }
  }
}


export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  if (!TECHSPECS_ENABLED) return null

  const cached = getFromCache(detailCache, productId)
  if (cached) return cached as ProductDetail

  try {
    const params = new URLSearchParams({ lang: 'en', keepCasing: 'true' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TECHSPECS_TIMEOUT_MS)

    const response = await fetch(`${TECHSPECS_BASE_URL}/products/${productId}?${params}`, {
      method: 'GET',
      headers: techSpecsHeaders(),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[TechSpecs] Detail error for ${productId}: ${response.status}`)
      return null
    }

    const data = await response.json() as { status: string; data: any }
    if (data.status !== 'success' || !data.data) return null

    const d = data.data
    const product = d.Product || {}
    const inside = d.Inside || {}
    const display = d.Display || {}
    const design = d.Design || {}
    const gallery = (d.Gallery || []).map((img: any) => ({
      url: img.url || '',
      thumbnail: img.thumbnail || img.url || '',
      color: img.color || undefined,
    }))

    const specs: Record<string, Record<string, string>> = {}

    if (inside.CPU) {
      specs['Processor'] = {}
      for (const [k, v] of Object.entries(inside.CPU)) {
        if (v && typeof v === 'string' && v.trim()) specs['Processor'][k] = v
      }
    }

    if (inside.RAM) {
      specs['Memory'] = {}
      for (const [k, v] of Object.entries(inside.RAM)) {
        if (v && typeof v === 'string' && v.trim()) specs['Memory'][k] = v
      }
    }

    if (inside.Storage || inside.SSD) {
      specs['Storage'] = {}
      const storage = { ...(inside.Storage || {}), ...(inside.SSD || {}) }
      for (const [k, v] of Object.entries(storage)) {
        if (v && typeof v === 'string' && v.trim()) specs['Storage'][k] = v
      }
    }

    if (inside.GPU) {
      specs['Graphics'] = {}
      for (const [k, v] of Object.entries(inside.GPU)) {
        if (v && typeof v === 'string' && v.trim()) specs['Graphics'][k] = v
      }
    }

    if (display && Object.keys(display).length > 0) {
      specs['Display'] = {}
      for (const [k, v] of Object.entries(display)) {
        if (v && typeof v === 'string' && v.trim()) specs['Display'][k] = v
      }
    }

    if (inside.Wireless) {
      specs['Connectivity'] = {}
      for (const [k, v] of Object.entries(inside.Wireless)) {
        if (v && typeof v === 'string' && v.trim()) specs['Connectivity'][k] = v
      }
    }

    if (inside.Ports) {
      if (!specs['Connectivity']) specs['Connectivity'] = {}
      for (const [k, v] of Object.entries(inside.Ports)) {
        if (v && typeof v === 'string' && v.trim()) specs['Connectivity'][k] = v
      }
    }

    if (inside.Battery) {
      specs['Battery'] = {}
      for (const [k, v] of Object.entries(inside.Battery)) {
        if (v && typeof v === 'string' && v.trim()) specs['Battery'][k] = v
      }
    }

    if (inside.Software) {
      specs['Software'] = {}
      for (const [k, v] of Object.entries(inside.Software)) {
        if (v && typeof v === 'string' && v.trim()) specs['Software'][k] = v
      }
    }

    if (d.Camera) {
      specs['Camera'] = {}
      for (const [section, sectionData] of Object.entries(d.Camera)) {
        if (typeof sectionData === 'object' && sectionData !== null) {
          for (const [k, v] of Object.entries(sectionData as Record<string, string>)) {
            if (v && typeof v === 'string' && v.trim()) specs['Camera'][`${section} — ${k}`] = v
          }
        }
      }
    }

    const body = design.Body || {}

    const keyAspects = d['Key Aspects'] || {}

    const detail: ProductDetail = {
      id: productId,
      brand: product.Brand || '',
      model: product.Model || '',
      version: product.Version || product.SKU || '',
      category: mapTechSpecsCategoryBack(product.Category || ''),
      ean: product['EAN/UPC Code'] || undefined,
      sku: product.SKU || product.Version || undefined,
      specs,
      keyAspects: Object.keys(keyAspects).length > 0 ? keyAspects : undefined,
      gallery,
      weight: body.Weight || undefined,
      dimensions: body.Height && body.Width
        ? `${body['Height (Shorter Side)'] || body.Height} × ${body['Width (Longer Side)'] || body.Width} × ${body.Thickness || '?'}`
        : undefined,
      displaySize: display.Diagonal || undefined,
      displayResolution: display['Resolution (H x W)'] || undefined,
      displayType: display.Type || undefined,
      cpu: inside.CPU?.Model || inside.CPU?.Series || undefined,
      ram: inside.RAM?.Capacity || undefined,
      storage: inside.Storage?.['Total Capacity'] || inside.SSD?.Capacity || undefined,
      addedOn: d.added_on || undefined,
    }

    setCache(detailCache, productId, detail, 200)

    console.log(`[TechSpecs] Detail for ${productId}: ${detail.brand} ${detail.model}, ${gallery.length} images, ${Object.keys(specs).length} spec sections`)

    return detail
  } catch (err: any) {
    console.warn(`[TechSpecs] Detail error: ${err.message}`)
    return null
  }
}


interface IcecatFeature {
  Feature: { Name: { Value: string } }
  PresentationValue: string
  RawValue?: string
}

interface IcecatFeatureGroup {
  FeatureGroup: { Name: { Value: string } }
  Features: IcecatFeature[]
}

interface IcecatGalleryImage {
  HighPic?: string
  Pic500x500?: string
  LowPic?: string
  ThumbPic?: string
}

export async function getIcecatProductDetail(
  brand: string,
  productCode: string,
  lang = 'en',
): Promise<ProductDetail | null> {
  if (!ICECAT_ENABLED) return null

  const cacheKey = `icecat:${brand}:${productCode}`
  const cached = getFromCache(detailCache, cacheKey)
  if (cached) return cached as ProductDetail

  try {
    const params = new URLSearchParams({
      UserName: ICECAT_USERNAME,
      Language: lang,
      Brand: brand,
      ProductCode: productCode,
    })
    if (ICECAT_APP_KEY) params.set('app_key', ICECAT_APP_KEY)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ICECAT_TIMEOUT_MS)

    const response = await fetch(`${ICECAT_BASE_URL}/?${params}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`[Icecat] Detail error for ${brand} ${productCode}: ${response.status} — ${body.slice(0, 200)}`)
      return null
    }

    const data = await response.json()
    if (!data?.data) return null

    const d = data.data
    const gi = d.GeneralInfo || {}
    const img = d.Image || {}
    const featGroups: IcecatFeatureGroup[] = d.FeaturesGroups || []

    const rawGallery: IcecatGalleryImage[] = d.Gallery || []
    const gallery = rawGallery
      .filter((g: IcecatGalleryImage) => g.HighPic || g.Pic500x500 || g.LowPic)
      .map((g: IcecatGalleryImage) => ({
        url: g.HighPic || g.Pic500x500 || g.LowPic || '',
        thumbnail: g.ThumbPic || g.Pic500x500 || g.LowPic || '',
      }))

    if (img.HighPic && !gallery.some((g: { url: string }) => g.url === img.HighPic)) {
      gallery.unshift({ url: img.HighPic, thumbnail: img.ThumbPic || img.LowPic || img.HighPic })
    }

    const specs: Record<string, Record<string, string>> = {}
    for (const fg of featGroups) {
      const groupName = fg.FeatureGroup?.Name?.Value || 'Other'
      const features: Record<string, string> = {}
      for (const f of fg.Features || []) {
        const name = f.Feature?.Name?.Value
        const value = f.PresentationValue || f.RawValue
        if (name && value && value.trim()) {
          features[name] = value
        }
      }
      if (Object.keys(features).length > 0) {
        specs[groupName] = features
      }
    }

    const findSpec = (groups: string[], keys: string[]): string | undefined => {
      for (const group of groups) {
        const g = specs[group]
        if (!g) continue
        for (const key of keys) {
          if (g[key]) return g[key]
        }
      }
      return undefined
    }

    const detail: ProductDetail = {
      id: `icecat-${gi.IcecatId || productCode}`,
      brand: gi.BrandName || brand,
      model: gi.ProductName || gi.Title?.split(brand).pop()?.trim() || productCode,
      version: productCode,
      category: mapTechSpecsCategoryBack(gi.Category?.Name?.Value || ''),
      ean: gi.GTIN?.[0] || undefined,
      sku: productCode,
      specs,
      gallery,
      weight: findSpec(['Weight & dimensions', 'Design'], ['Weight', 'Weight (approximate)']),
      dimensions: findSpec(['Weight & dimensions', 'Design'], ['Dimensions (W x D x H)']),
      displaySize: findSpec(['Display'], ['Display diagonal', 'Screen diagonal']),
      displayResolution: findSpec(['Display'], ['Display resolution', 'Maximum resolution']),
      displayType: findSpec(['Display'], ['Display technology', 'Panel type']),
      cpu: findSpec(['Processor'], ['Processor model', 'Processor family']),
      ram: findSpec(['Memory', 'Internal memory'], ['Internal memory', 'RAM capacity']),
      storage: findSpec(['Storage', 'Hard drive'], ['Total storage capacity', 'SSD capacity']),
    }

    setCache(detailCache, cacheKey, detail, 200)

    console.log(`[Icecat] Detail for ${brand} ${productCode}: "${gi.Title}", ${gallery.length} images, ${Object.keys(specs).length} spec sections`)

    return detail
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[Icecat] Request timed out')
    } else {
      console.warn(`[Icecat] Error: ${err.message}`)
    }
    return null
  }
}


interface CatalogProduct {
  brand: string
  productCode: string
  model: string
  category: string
  keywords: string[]
}

const ICECAT_CATALOG: CatalogProduct[] = [
  { brand: 'Samsung', productCode: 'SM-S926BZKDEUB', model: 'Galaxy S24+', category: 'phone', keywords: ['samsung', 'galaxy', 's24', 'smartphone'] },
  { brand: 'Samsung', productCode: 'SM-S928BZKHEUB', model: 'Galaxy S24 Ultra', category: 'phone', keywords: ['samsung', 'galaxy', 's24', 'ultra', 'smartphone'] },
  { brand: 'Samsung', productCode: 'SM-A556BLBCEUB', model: 'Galaxy A55 5G', category: 'phone', keywords: ['samsung', 'galaxy', 'a55', 'smartphone'] },
  { brand: 'Samsung', productCode: 'SM-X810NZAAEUB', model: 'Galaxy Tab S9+', category: 'tablet', keywords: ['samsung', 'galaxy', 'tab', 's9', 'tablet'] },
  { brand: 'Lenovo', productCode: '21HM004GGE', model: 'ThinkPad X1 Carbon Gen 11', category: 'laptop', keywords: ['lenovo', 'thinkpad', 'x1', 'carbon', 'laptop'] },
  { brand: 'Lenovo', productCode: '21CB00B1GE', model: 'ThinkPad X1 Carbon Gen 10', category: 'laptop', keywords: ['lenovo', 'thinkpad', 'x1', 'carbon', 'gen10', 'laptop'] },
  { brand: 'Lenovo', productCode: '21HH002FGE', model: 'ThinkPad T16 Gen 2', category: 'laptop', keywords: ['lenovo', 'thinkpad', 't16', 'laptop'] },
  { brand: 'HP', productCode: '818M6EA', model: 'EliteBook 840 G10', category: 'laptop', keywords: ['hp', 'elitebook', '840', 'laptop'] },
  { brand: 'HP', productCode: '816C8EA', model: 'ProBook 450 G10', category: 'laptop', keywords: ['hp', 'probook', '450', 'laptop'] },
  { brand: 'HP', productCode: '86B81EA', model: 'Z2 G9 Workstation', category: 'desktop', keywords: ['hp', 'z2', 'workstation', 'desktop', 'tower'] },
  { brand: 'Dell', productCode: 'DELL-U2724D', model: 'UltraSharp U2724D 27"', category: 'monitor', keywords: ['dell', 'ultrasharp', 'u2724d', 'monitor', '27'] },
  { brand: 'Dell', productCode: 'DELL-P2425', model: 'Pro Plus P2425 24"', category: 'monitor', keywords: ['dell', 'p2425', 'monitor', '24'] },
  { brand: 'LG', productCode: '27UP850N-W', model: '27UP850N-W 4K UHD', category: 'monitor', keywords: ['lg', '27up850', 'uhd', '4k', 'monitor', '27'] },
  { brand: 'Samsung', productCode: 'LS27D800EAUXEN', model: 'S80D 27" 4K', category: 'monitor', keywords: ['samsung', 's80d', '4k', 'monitor', '27'] },
  { brand: 'Philips', productCode: '27E1N5600AE/00', model: '5000 Series 27" QHD', category: 'monitor', keywords: ['philips', '5000', 'qhd', 'monitor', '27'] },
  { brand: 'BenQ', productCode: 'PD2705U', model: 'PD2705U 27" 4K', category: 'monitor', keywords: ['benq', 'pd2705u', '4k', 'monitor', '27', 'designer'] },
  { brand: 'Sony', productCode: 'WH1000XM5B.CE7', model: 'WH-1000XM5', category: 'headphones', keywords: ['sony', 'wh-1000xm5', 'headphones', 'noise', 'cancelling', 'anc'] },
  { brand: 'Jabra', productCode: '28599-989-899', model: 'Evolve2 85 UC', category: 'headphones', keywords: ['jabra', 'evolve2', '85', 'headset', 'uc'] },
  { brand: 'Jabra', productCode: '26599-999-899', model: 'Evolve2 65 UC', category: 'headphones', keywords: ['jabra', 'evolve2', '65', 'headset', 'uc'] },
  { brand: 'Jabra', productCode: '23089-999-879', model: 'Evolve2 30 UC', category: 'headphones', keywords: ['jabra', 'evolve2', '30', 'headset', 'uc', 'usb-c'] },
  { brand: 'Poly', productCode: '77Y87AA', model: 'Voyager Focus 2 UC', category: 'headphones', keywords: ['poly', 'voyager', 'focus', 'headset', 'uc', 'teams'] },
]

function searchIcecatCatalog(query: string, category?: string): CatalogProduct[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
  if (terms.length === 0) return []

  return ICECAT_CATALOG
    .filter(p => {
      if (category && p.category !== category) return false
      return terms.every(term =>
        p.keywords.some(kw => kw.includes(term)) ||
        p.brand.toLowerCase().includes(term) ||
        p.model.toLowerCase().includes(term) ||
        p.productCode.toLowerCase().includes(term)
      )
    })
    .slice(0, 20)
}

function catalogToSearchResult(p: CatalogProduct): ProductSearchResult {
  return {
    id: `icecat:${p.brand}:${p.productCode}`,
    title: `${p.brand} ${p.model}`,
    brand: p.brand,
    category: p.category,
    techSpecsCategory: mapCategoryToTechSpecs(p.category),
    version: p.productCode,
    dataSource: 'icecat' as const,
    lastUpdated: new Date().toISOString(),
  }
}


export async function searchProducts(
  query: string,
  category?: string,
  page = 0,
): Promise<ProductSearchResponse> {
  const startTime = Date.now()

  const cacheKey = getCacheKey(query, category, page)
  const cached = getFromCache(searchCache, cacheKey)
  if (cached) return cached as ProductSearchResponse

  const sources: SourceStatus[] = []

  const tsResult = await searchTechSpecs(query, category, page)
  sources.push(tsResult.status)

  if (tsResult.results.length > 0) {
    const response: ProductSearchResponse = {
      query,
      category,
      results: tsResult.results,
      totalFound: tsResult.totalFound,
      totalPages: tsResult.totalPages,
      page: tsResult.page,
      sources,
      duration: Date.now() - startTime,
    }
    setCache(searchCache, cacheKey, response)
    return response
  }

  if (ICECAT_ENABLED && page === 0) {
    const catalogResults = searchIcecatCatalog(query, category)
    if (catalogResults.length > 0) {
      const icecatResults = catalogResults.map(catalogToSearchResult)
      sources.push({ name: 'Icecat Catalog', status: 'ok', count: icecatResults.length, latencyMs: Date.now() - startTime })

      console.log(`[Icecat] Catalog search "${query}" → ${icecatResults.length} results`)

      const response: ProductSearchResponse = {
        query,
        category,
        results: icecatResults,
        totalFound: icecatResults.length,
        totalPages: 1,
        page: 0,
        sources,
        duration: Date.now() - startTime,
      }
      setCache(searchCache, cacheKey, response)
      return response
    }
  }

  return {
    query,
    category,
    results: [],
    totalFound: 0,
    totalPages: 0,
    page: 0,
    sources,
    duration: Date.now() - startTime,
  }
}


export interface SourceHealth {
  name: string
  enabled: boolean
  configured: boolean
  lastStatus?: 'ok' | 'error' | 'rate-limited'
}

export function getSourceHealth(): SourceHealth[] {
  return [
    {
      name: 'TechSpecs API',
      enabled: TECHSPECS_ENABLED,
      configured: !!TECHSPECS_API_KEY && !!TECHSPECS_API_ID,
    },
    {
      name: 'Icecat Open API',
      enabled: ICECAT_ENABLED,
      configured: !!ICECAT_USERNAME,
    },
  ]
}

export function clearProductCache(): void {
  searchCache.clear()
  detailCache.clear()
}
