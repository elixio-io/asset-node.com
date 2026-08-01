

export const MARKETPLACE_LIVE_DATA = process.env.MARKETPLACE_LIVE_DATA === 'true'


export const TECHSPECS_API_KEY = process.env.TECHSPECS_API_KEY || ''
export const TECHSPECS_API_ID = process.env.TECHSPECS_API_ID || ''
export const TECHSPECS_BASE_URL = 'https://api.techspecs.io/v5'
export const TECHSPECS_TIMEOUT_MS = 8000
export const TECHSPECS_ENABLED = !!TECHSPECS_API_KEY && !!TECHSPECS_API_ID && MARKETPLACE_LIVE_DATA


export const ICECAT_USERNAME = process.env.ICECAT_USERNAME || ''
export const ICECAT_APP_KEY = process.env.ICECAT_APP_KEY || ''
export const ICECAT_CONTENT_TOKEN = process.env.ICECAT_CONTENT_TOKEN || ''
export const ICECAT_BASE_URL = 'https://live.icecat.biz/api'
export const ICECAT_TIMEOUT_MS = 8000
export const ICECAT_RATE_LIMIT = 5
export const ICECAT_ENABLED = !!ICECAT_USERNAME && MARKETPLACE_LIVE_DATA


export const CACHE_TTL_MS = 60 * 60 * 1000
export const CACHE_MAX_ENTRIES = 500


export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const MIN_QUERY_LENGTH = 2


export const PRODUCT_CATEGORIES = [
  { key: 'laptop', label: 'Laptops', labelDe: 'Laptops', icon: 'pi-desktop' },
  { key: 'desktop', label: 'Desktops', labelDe: 'Desktops', icon: 'pi-server' },
  { key: 'phone', label: 'Smartphones', labelDe: 'Smartphones', icon: 'pi-mobile' },
  { key: 'tablet', label: 'Tablets', labelDe: 'Tablets', icon: 'pi-tablet' },
  { key: 'monitor', label: 'Monitors', labelDe: 'Monitore', icon: 'pi-desktop' },
  { key: 'headphones', label: 'Headphones', labelDe: 'Kopfhörer', icon: 'pi-volume-up' },
  { key: 'smartwatch', label: 'Smartwatches', labelDe: 'Smartwatches', icon: 'pi-clock' },
  { key: 'accessory', label: 'Accessories', labelDe: 'Zubehör', icon: 'pi-box' },
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['key']


export type DataSource = 'techspecs' | 'icecat'

export function logMarketplaceConfig(): void {
  console.log(`[Marketplace] Live data: ${MARKETPLACE_LIVE_DATA ? 'ON' : 'OFF'}`)
  console.log(`[Marketplace] TechSpecs API: ${TECHSPECS_ENABLED ? 'ENABLED' : 'DISABLED'}`)
  console.log(`[Marketplace] Icecat API: ${ICECAT_ENABLED ? 'ENABLED' : 'DISABLED'}${ICECAT_APP_KEY ? ' (Full)' : ' (Open)'}`)
}
