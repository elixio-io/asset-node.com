<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'

const { t, locale } = useI18n()
const isDE = computed(() => locale.value === 'de')


const activeTab = ref<'buy' | 'sell'>('sell')


interface BuyProduct {
  id: string
  title: string
  brand: string
  category: string
  techSpecsCategory: string
  version?: string
  imageUrl?: string
  dataSource: 'techspecs' | 'icecat'
  lastUpdated?: string
}

interface BuySearchResult {
  query: string
  category?: string
  results: BuyProduct[]
  totalFound: number
  totalPages: number
  page: number
  sources: { name: string; status: string; enabled: boolean }[]
  mode: 'live' | 'offline'
  cachedAt?: string
  duration: number
}

interface ProductDetailData {
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

interface ProductCategory {
  key: string
  label: string
  labelDe: string
  icon: string
}

const buyQuery = ref('')
const buyCategory = ref<string | null>(null)
const buyResults = ref<BuyProduct[]>([])
const buySearchInfo = ref<BuySearchResult | null>(null)
const buyLoading = ref(false)
const buySearched = ref(false)
const buyCategories = ref<ProductCategory[]>([])
const buyDetailProduct = ref<ProductDetailData | null>(null)
const buyDetailLoading = ref(false)
const showBuyDetail = ref(false)

onMounted(async () => {
  await Promise.all([loadCategories(), loadAssets(), loadPartners(), loadQuotes()])
})

async function loadCategories() {
  try {
    const res = await api.get('/marketplace/categories')
    buyCategories.value = Array.isArray(res.data) ? res.data : []
  } catch {  console.warn('[Marketplace] Failed to load categories') }
}

async function searchBuy() {
  if (!buyQuery.value.trim() || buyQuery.value.trim().length < 2) return
  buyLoading.value = true
  buySearched.value = false
  try {
    const params: Record<string, string> = { q: buyQuery.value.trim() }
    if (buyCategory.value) params.category = buyCategory.value
    const res = await api.get('/marketplace/search', { params })
    buyResults.value = res.data.results || []
    buySearchInfo.value = res.data
    buySearched.value = true
  } catch (e: any) {
    error.value = e?.response?.data?.error || e.message || 'Search failed'
  } finally {
    buyLoading.value = false
  }
}

async function openProduct(product: BuyProduct) {
  showBuyDetail.value = true
  buyDetailLoading.value = true
  buyDetailProduct.value = null
  try {
    const encodedId = product.id.includes(':')
      ? product.id.replace(/:/g, '--')
      : product.id
    const res = await api.get(`/marketplace/product/${encodedId}`)
    buyDetailProduct.value = res.data
  } catch {
    buyDetailProduct.value = null
  } finally {
    buyDetailLoading.value = false
  }
}

function closeProductDetail() {
  showBuyDetail.value = false
  buyDetailProduct.value = null
}

function dataSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    techspecs: 'TechSpecs',
    icecat: 'Icecat',
    catalog: isDE.value ? 'Katalog' : 'Catalog',
  }
  return labels[source] || source
}

function dataSourceSeverity(source: string): "success" | "info" | "warn" | "secondary" | undefined {
  const m: Record<string, "success" | "info" | "warn" | "secondary"> = {
    techspecs: 'success',
    icecat: 'info',
    catalog: 'secondary',
  }
  return m[source] || 'secondary'
}


interface HardwareAsset {
  _id: string
  model: string
  serialNumber?: string
  assetTag?: string
  assetName?: string
  categoryId?: { name: string }
  statusId?: { name: string; label?: string; slug?: string; color?: string }
  manufacturerId?: { name: string }
  purchasePrice?: number
  purchaseDate?: string
  warrantyExpiry?: string
}

interface BuybackPartner {
  slug: string
  name: string
  website: string
  logo: string
  description: string
  descriptionDe: string
  contactEmail: string | null
  minQuantity: number
  supportedCategories: string[]
  certifications: string[]
  region: string
  highlights: string[]
  highlightsDe: string[]
  founded?: string
  employees?: string
  volumePerYear?: string
}

interface AssetEstimate {
  hardwareId: string
  model: string
  serialNumber?: string
  category: string
  condition: string
  purchasePrice?: number
  estimatedValue: number
  depreciationPct: number
  ageYears: number
  confidenceLevel: string
}

interface BuybackQuote {
  _id: string
  partnerName: string
  partnerSlug: string
  status: string
  totalEstimatedValue: number
  totalActualValue?: number
  assets: { model: string; estimatedValue: number; condition: string }[]
  createdAt: string
  submittedAt?: string
}

const step = ref<'select' | 'estimate' | 'partner' | 'confirm'>('select')
const stepIndex = computed(() => ['select', 'estimate', 'partner', 'confirm'].indexOf(step.value))

const assets = ref<HardwareAsset[]>([])
const selectedIds = ref<string[]>([])
const estimates = ref<AssetEstimate[]>([])
const partners = ref<BuybackPartner[]>([])
const selectedPartner = ref<string | null>(null)
const quotes = ref<BuybackQuote[]>([])

const loading = ref(false)
const error = ref('')
const success = ref('')
const assetsLoaded = ref(false)
const showHistory = ref(false)
const searchQuery = ref('')
const categoryFilter = ref<string | null>(null)

const contactName = ref('')
const contactEmail = ref('')
const contactPhone = ref('')
const notes = ref('')


const filteredAssets = computed(() => {
  let list = assets.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a =>
      a.model?.toLowerCase().includes(q) ||
      a.serialNumber?.toLowerCase().includes(q) ||
      a.assetTag?.toLowerCase().includes(q) ||
      refName(a.manufacturerId)?.toLowerCase().includes(q)
    )
  }
  if (categoryFilter.value) {
    list = list.filter(a => refName(a.categoryId) === categoryFilter.value)
  }
  return list
})

const categories = computed(() => {
  const cats = new Set(assets.value.map(a => refName(a.categoryId)).filter(Boolean).filter(n => n !== '—'))
  return Array.from(cats).sort()
})

const totalEstimate = computed(() => estimates.value.reduce((s, e) => s + e.estimatedValue, 0))
const totalPurchase = computed(() => estimates.value.reduce((s, e) => s + (e.purchasePrice || 0), 0))
const avgDepreciation = computed(() => {
  if (!estimates.value.length) return 0
  return Math.round(estimates.value.reduce((s, e) => s + e.depreciationPct, 0) / estimates.value.length)
})

const partnerData = computed(() => partners.value.find(p => p.slug === selectedPartner.value))
const meetsMin = computed(() => !partnerData.value || selectedIds.value.length >= partnerData.value.minQuantity)


async function loadAssets() {
  if (assetsLoaded.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/hardware')
    assets.value = Array.isArray(res.data) ? res.data : []
    assetsLoaded.value = true
  } catch (e: any) {
    error.value = e?.response?.data?.error || e.message || 'Failed to load assets'
  } finally {
    loading.value = false
  }
}

async function loadPartners() {
  try {
    const res = await api.get('/marketplace/buyback-partners')
    partners.value = Array.isArray(res.data) ? res.data : []
  } catch {  console.warn('[Marketplace] Failed to load buyback partners') }
}

async function loadQuotes() {
  try {
    const res = await api.get('/marketplace/quotes')
    quotes.value = res.data.quotes || []
  } catch {  console.warn('[Marketplace] Failed to load quotes') }
}

function toggleAsset(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function selectAll() { selectedIds.value = filteredAssets.value.map(a => a._id) }
function selectNone() { selectedIds.value = [] }

async function getEstimates() {
  if (!selectedIds.value.length) return
  loading.value = true
  error.value = ''
  try {
    const res = await api.post('/marketplace/estimate', { hardwareIds: selectedIds.value })
    estimates.value = res.data.estimates || []
    step.value = 'estimate'
  } catch (e: any) {
    error.value = e?.response?.data?.error || e.message || 'Estimate failed'
  } finally {
    loading.value = false
  }
}

async function submitQuote() {
  if (!selectedPartner.value || !selectedIds.value.length) return
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await api.post('/marketplace/quote', {
      partnerSlug: selectedPartner.value,
      hardwareIds: selectedIds.value,
      contactName: contactName.value || undefined,
      contactEmail: contactEmail.value || undefined,
      contactPhone: contactPhone.value || undefined,
      notes: notes.value || undefined
    })
    success.value = `✅ ${res.data.message} — ${isDE.value ? 'Geschätzter Wert' : 'Estimated value'}: €${res.data.totalEstimatedValue?.toLocaleString('de-DE')}`
    resetWizard()
    await loadQuotes()
    showHistory.value = true
  } catch (e: any) {
    error.value = e?.response?.data?.error || e.message || 'Quote submission failed'
  } finally {
    loading.value = false
  }
}

function resetWizard() {
  step.value = 'select'
  selectedIds.value = []
  estimates.value = []
  selectedPartner.value = null
  contactName.value = ''
  contactEmail.value = ''
  contactPhone.value = ''
  notes.value = ''
}


function refName(val: any): string {
  if (!val) return '—'
  if (typeof val === 'object' && val.name) return val.name
  if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '—'
  return String(val)
}

function assetAge(d?: string): string {
  if (!d) return '—'
  const y = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return y < 1 ? `${Math.round(y * 12)} Mo.` : `${Math.round(y * 10) / 10} J.`
}

function cur(n?: number): string {
  if (n == null || n === 0) return '—'
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusSeverity(s: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
  const m: Record<string, "success" | "info" | "warn" | "danger" | "secondary"> = {
    draft: 'secondary', submitted: 'info', quoted: 'warn',
    accepted: 'success', shipped: 'info', completed: 'success',
    rejected: 'danger', expired: 'secondary'
  }
  return m[s] || 'secondary'
}

function condSeverity(c: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
  const m: Record<string, "success" | "info" | "warn" | "danger"> = {
    excellent: 'success', good: 'info', fair: 'warn', poor: 'danger'
  }
  return m[c] || 'secondary'
}

function confSeverity(c: string): "success" | "warn" | "secondary" | "info" | "danger" | "contrast" | undefined {
  const m: Record<string, "success" | "warn" | "secondary"> = { high: 'success', medium: 'warn', low: 'secondary' }
  return m[c] || 'secondary'
}

const STEPS = [
  { key: 'select', icon: 'pi-list', label: 'Assets auswählen', labelEn: 'Select Assets' },
  { key: 'estimate', icon: 'pi-calculator', label: 'Schätzung prüfen', labelEn: 'Review Estimate' },
  { key: 'partner', icon: 'pi-building', label: 'Partner wählen', labelEn: 'Choose Partner' },
  { key: 'confirm', icon: 'pi-send', label: 'Absenden', labelEn: 'Submit' }
]
</script>

<template>
  <div class="view-page">
    <div class="view-inner">



      <div class="mp-tabs">
        <button class="mp-tab mp-tab--active">
          <i class="pi pi-money-bill" />
          {{ isDE ? 'Hardware verwerten' : 'Sell & Dispose' }}
        </button>
      </div>

      <Message v-if="success" severity="success" closable @close="success = ''" class="mb-3">{{ success }}</Message>
      <Message v-if="error" severity="error" closable @close="error = ''" class="mb-3">{{ error }}</Message>




      <template v-if="false && activeTab === 'buy'">
        <div class="buy-header">
          <div>
            <h1 class="text-xl font-bold">
              <i class="pi pi-shopping-cart" style="color: var(--an-cobalt); margin-right: 8px;" />
              {{ isDE ? 'IT-Hardware beschaffen' : 'Procure IT Hardware' }}
            </h1>
            <p class="buy-subtitle">
              {{ isDE
                ? 'Suchen und vergleichen Sie refurbished und neue Hardware von führenden Anbietern'
                : 'Search and compare refurbished and new hardware from leading suppliers' }}
            </p>
          </div>
        </div>

        <div class="buy-search-bar surface-card">
          <div class="buy-search-main">
            <div class="buy-search-field">
              <i class="pi pi-search buy-search-icon" />
              <InputText
                v-model="buyQuery"
                :placeholder="isDE ? 'MacBook, ThinkPad, iPhone, Dell Monitor...' : 'MacBook, ThinkPad, iPhone, Dell Monitor...'"
                class="buy-search-input"
                @keyup.enter="searchBuy"
              />
            </div>
            <select v-model="buyCategory" class="buy-cat-select">
              <option :value="null">{{ isDE ? 'Alle Kategorien' : 'All Categories' }}</option>
              <option v-for="c in buyCategories" :key="c.key" :value="c.key">
                {{ isDE ? c.labelDe : c.label }}
              </option>
            </select>
            <InputText
              v-model="buyMaxPrice"
              :placeholder="isDE ? 'Max. Preis (€)' : 'Max Price (€)'"
              class="buy-price-input"
              type="number"
              min="0"
            />
            <Button
              :label="isDE ? 'Suchen' : 'Search'"
              icon="pi pi-search"
              :loading="buyLoading"
              :disabled="buyQuery.trim().length < 2"
              @click="searchBuy"
            />
          </div>

          <div class="buy-cat-chips">
            <button
              v-for="c in buyCategories"
              :key="c.key"
              class="buy-cat-chip"
              :class="{ 'buy-cat-chip--active': buyCategory === c.key }"
              @click="buyCategory = buyCategory === c.key ? null : c.key"
            >
              <i :class="'pi ' + c.icon" />
              {{ isDE ? c.labelDe : c.label }}
            </button>
          </div>
        </div>

        <div v-if="buySearchInfo" class="buy-status-bar">
          <div class="buy-status-left">
            <span class="buy-status-count">
              {{ buySearchInfo.totalFound.toLocaleString() }} {{ isDE ? 'Produkte gefunden' : 'products found' }}
              <span v-if="buySearchInfo.totalPages > 1" style="color: var(--an-text-muted); font-size: 11px;">
                ({{ isDE ? 'Seite' : 'Page' }} {{ buySearchInfo.page + 1 }}/{{ buySearchInfo.totalPages }})
              </span>
            </span>
            <Tag :value="buySearchInfo.mode === 'live' ? 'TechSpecs Live' : 'Offline'"
              :severity="buySearchInfo.mode === 'live' ? 'success' : 'secondary'"
              style="font-size: 10px;" />
            <span class="buy-status-time">{{ buySearchInfo.duration }}ms</span>
          </div>
          <div class="buy-status-sources">
            <span v-for="s in buySearchInfo.sources" :key="s.name" class="buy-source-badge"
              :class="{ 'buy-source-badge--ok': s.status === 'ok', 'buy-source-badge--off': s.status === 'disabled' }">
              <i :class="s.status === 'ok' ? 'pi pi-check-circle' : 'pi pi-minus-circle'" style="font-size: 10px;" />
              {{ s.name }}
            </span>
          </div>
        </div>

        <div v-if="buyLoading" class="buy-empty">
          <ProgressSpinner style="width: 48px; height: 48px;" />
          <p>{{ isDE ? 'Durchsuche Marktplätze...' : 'Searching marketplaces...' }}</p>
        </div>

        <div v-else-if="!buySearched" class="buy-empty">
          <div class="buy-empty-icon"><i class="pi pi-search" /></div>
          <h3>{{ isDE ? 'Hardware-Datenbank durchsuchen' : 'Search the hardware database' }}</h3>
          <p>{{ isDE
            ? 'Durchsuchen Sie über 284.000 Produkte — Laptops, Smartphones, Tablets, Desktops, GPUs und Monitore.'
            : 'Search over 284,000 products — laptops, smartphones, tablets, desktops, GPUs and monitors.' }}</p>
          <div class="buy-quick-searches">
            <Button v-for="q in ['MacBook Air M2', 'ThinkPad X1 Carbon', 'iPhone 15 Pro', 'Dell XPS 15', 'Samsung Galaxy S24']" :key="q"
              :label="q" size="small" severity="secondary" outlined
              @click="buyQuery = q; searchBuy()" style="font-size: 12px;" />
          </div>
        </div>

        <div v-else-if="buyResults.length === 0" class="buy-empty">
          <div class="buy-empty-icon"><i class="pi pi-filter-slash" /></div>
          <h3>{{ isDE ? 'Keine Ergebnisse' : 'No results found' }}</h3>
          <p>{{ isDE
            ? `Keine Produkte für "${buyQuery}" gefunden. Versuchen Sie einen anderen Suchbegriff.`
            : `No products found for "${buyQuery}". Try a different search term.` }}</p>
        </div>

        <div v-else class="buy-grid">
          <div v-for="p in buyResults" :key="p.id" class="buy-card surface-card" @click="openProduct(p)">
            <div class="buy-card-img">
              <img v-if="p.imageUrl" :src="p.imageUrl" :alt="p.title" loading="lazy" />
              <i v-else class="pi pi-box buy-card-img-placeholder" />
            </div>

            <div class="buy-card-body">
              <div class="buy-card-brand">{{ p.brand }}</div>
              <h3 class="buy-card-title">{{ p.title }}</h3>

              <div class="buy-card-meta">
                <Tag :value="p.techSpecsCategory" severity="info" style="font-size: 9px;" />
              </div>

              <div class="buy-card-bottom">
                <div class="buy-card-cta">
                  <i class="pi pi-info-circle" /> {{ isDE ? 'Details ansehen' : 'View details' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog v-model:visible="showBuyDetail" modal
          :header="buyDetailProduct ? `${buyDetailProduct.brand} ${buyDetailProduct.model}` : (isDE ? 'Wird geladen...' : 'Loading...')"
          :style="{ width: '720px', maxWidth: '95vw' }"
          :closable="true" @hide="closeProductDetail">

          <div v-if="buyDetailLoading" class="detail-loading">
            <ProgressSpinner style="width: 40px; height: 40px;" />
            <p>{{ isDE ? 'Produktdaten werden geladen...' : 'Loading product data...' }}</p>
          </div>

          <div v-else-if="!buyDetailProduct" class="detail-loading">
            <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--an-text-muted);" />
            <p>{{ isDE ? 'Produktdetails nicht verfügbar. Möglicherweise ist das API-Limit erreicht.' : 'Product details unavailable. API limit may have been reached.' }}</p>
            <Button :label="isDE ? 'Schließen' : 'Close'" severity="secondary" @click="closeProductDetail" />
          </div>

          <template v-else>
            <div v-if="buyDetailProduct.gallery && buyDetailProduct.gallery.length > 0" class="detail-gallery">
              <img
                v-for="(img, idx) in buyDetailProduct.gallery"
                :key="idx"
                :src="img.url || img.thumbnail"
                :alt="`${buyDetailProduct.brand} ${buyDetailProduct.model} — Image ${idx + 1}`"
                class="detail-gallery-img"
                loading="lazy"
              />
            </div>
            <div v-else class="detail-img-wrap detail-img-placeholder">
              <i class="pi pi-box" style="font-size: 3rem; color: var(--an-text-muted);" />
            </div>

            <div class="detail-header-info">
              <h3 class="detail-model">{{ buyDetailProduct.model }}</h3>
              <p v-if="buyDetailProduct.version" class="detail-version">{{ buyDetailProduct.version }}</p>
            </div>

            <div v-if="buyDetailProduct.cpu || buyDetailProduct.ram || buyDetailProduct.storage || buyDetailProduct.displaySize" class="detail-aspects">
              <div v-if="buyDetailProduct.cpu" class="detail-aspect-chip">
                <i class="pi pi-microchip" /> {{ buyDetailProduct.cpu }}
              </div>
              <div v-if="buyDetailProduct.ram" class="detail-aspect-chip">
                <i class="pi pi-database" /> {{ buyDetailProduct.ram }}
              </div>
              <div v-if="buyDetailProduct.storage" class="detail-aspect-chip">
                <i class="pi pi-save" /> {{ buyDetailProduct.storage }}
              </div>
              <div v-if="buyDetailProduct.displaySize" class="detail-aspect-chip">
                <i class="pi pi-desktop" /> {{ buyDetailProduct.displaySize }}
                <span v-if="buyDetailProduct.displayResolution" style="color: var(--an-text-muted);"> · {{ buyDetailProduct.displayResolution }}</span>
              </div>
              <div v-if="buyDetailProduct.weight" class="detail-aspect-chip">
                <i class="pi pi-box" /> {{ buyDetailProduct.weight }}
              </div>
            </div>

            <div class="detail-info">
              <div class="detail-row">
                <span class="detail-label">{{ isDE ? 'Marke' : 'Brand' }}</span>
                <span>{{ buyDetailProduct.brand }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ isDE ? 'Kategorie' : 'Category' }}</span>
                <span style="text-transform: capitalize;">{{ buyDetailProduct.category }}</span>
              </div>
              <div v-if="buyDetailProduct.ean" class="detail-row">
                <span class="detail-label">EAN / UPC</span>
                <span class="font-mono">{{ buyDetailProduct.ean }}</span>
              </div>
              <div v-if="buyDetailProduct.sku" class="detail-row">
                <span class="detail-label">SKU</span>
                <span class="font-mono">{{ buyDetailProduct.sku }}</span>
              </div>
              <div v-if="buyDetailProduct.dimensions" class="detail-row">
                <span class="detail-label">{{ isDE ? 'Abmessungen' : 'Dimensions' }}</span>
                <span>{{ buyDetailProduct.dimensions }}</span>
              </div>
            </div>

            <div v-if="buyDetailProduct.specs && Object.keys(buyDetailProduct.specs).length > 0" class="detail-specs-grouped">
              <div v-for="(section, sectionName) in buyDetailProduct.specs" :key="String(sectionName)" class="detail-spec-section">
                <h4 class="detail-section-title">
                  <i class="pi pi-cog" /> {{ String(sectionName) }}
                </h4>
                <div class="detail-spec-grid">
                  <div v-for="(val, key) in section" :key="String(key)" class="detail-spec-row">
                    <span class="detail-spec-key">{{ String(key) }}</span>
                    <span class="detail-spec-val">{{ val }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="detail-actions">
              <Button :label="isDE ? 'Schließen' : 'Close'" severity="secondary" @click="closeProductDetail" />
            </div>
          </template>
        </Dialog>
      </template>




      <template v-if="activeTab === 'sell'">
        <div class="sell-header">
          <div>
            <h1 class="text-xl font-bold">
              <i class="pi pi-money-bill" style="color: var(--an-emerald); margin-right: 8px;" />
              {{ isDE ? 'Hardware verwerten' : 'Sell & Dispose' }}
            </h1>
            <p class="sell-subtitle">
              {{ isDE
                ? 'Nicht mehr benötigte Geräte bewerten und an zertifizierte ITAD-Partner verkaufen'
                : 'Estimate value and sell retired devices to certified ITAD partners' }}
            </p>
          </div>
          <div class="sell-header-stats" v-if="assets.length > 0">
            <div class="sell-stat">
              <span class="sell-stat-value">{{ assets.length }}</span>
              <span class="sell-stat-label">{{ isDE ? 'Geräte im Inventar' : 'Devices in inventory' }}</span>
            </div>
            <div class="sell-stat" v-if="partners.length > 0">
              <span class="sell-stat-value">{{ partners.length }}</span>
              <span class="sell-stat-label">{{ isDE ? 'Verfügbare Partner' : 'Available partners' }}</span>
            </div>
            <div class="sell-stat" v-if="quotes.length > 0">
              <span class="sell-stat-value">{{ quotes.length }}</span>
              <span class="sell-stat-label">{{ isDE ? 'Angefragte Angebote' : 'Submitted quotes' }}</span>
            </div>
          </div>
        </div>

        <div class="sell-steps">
          <template v-for="(s, i) in STEPS" :key="s.key">
            <div v-if="i > 0" class="sell-step-line" :class="{ 'sell-step-line--done': stepIndex > i - 1 }" />
            <div class="sell-step"
              :class="{ 'sell-step--active': step === s.key, 'sell-step--done': stepIndex > i }">
              <span class="sell-step-num">
                <i v-if="stepIndex > i" class="pi pi-check" style="font-size: 11px;" />
                <span v-else>{{ i + 1 }}</span>
              </span>
              <span class="sell-step-label">{{ isDE ? s.label : s.labelEn }}</span>
            </div>
          </template>
        </div>

        <template v-if="step === 'select'">
          <div v-if="loading && !assetsLoaded" class="sell-empty">
            <ProgressSpinner style="width: 48px; height: 48px;" />
            <p>{{ isDE ? 'Inventar wird geladen...' : 'Loading inventory...' }}</p>
          </div>
          <div v-else-if="assets.length === 0 && assetsLoaded" class="sell-empty">
            <div class="sell-empty-icon"><i class="pi pi-inbox" /></div>
            <h3>{{ isDE ? 'Keine Geräte im Inventar' : 'No hardware assets found' }}</h3>
            <p>{{ isDE
              ? 'Fügen Sie zuerst Geräte zu Ihrem Inventar hinzu, bevor Sie ein Ankaufsangebot erstellen.'
              : 'Add assets to your inventory first before submitting a buyback quote.' }}</p>
          </div>
          <template v-else>
            <div class="sell-toolbar surface-card">
              <div class="sell-toolbar-left">
                <div class="sell-search-wrap">
                  <i class="pi pi-search sell-search-icon" />
                  <InputText v-model="searchQuery"
                    :placeholder="isDE ? 'Suche nach Modell, Seriennr., Hersteller...' : 'Search model, serial, manufacturer...'"
                    class="sell-search-input" />
                </div>
                <select v-model="categoryFilter" class="sell-cat-filter">
                  <option :value="null">{{ isDE ? 'Alle Kategorien' : 'All categories' }}</option>
                  <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="sell-toolbar-right">
                <span class="sell-selection-count">
                  <strong>{{ selectedIds.length }}</strong> / {{ filteredAssets.length }}
                  {{ isDE ? 'ausgewählt' : 'selected' }}
                </span>
                <Button :label="isDE ? 'Alle' : 'All'" size="small" severity="secondary" text @click="selectAll" />
                <Button :label="isDE ? 'Keine' : 'None'" size="small" severity="secondary" text @click="selectNone" />
                <Button
                  :label="isDE ? 'Schätzung anfordern' : 'Get Estimate'"
                  icon="pi pi-calculator"
                  :disabled="selectedIds.length === 0"
                  :loading="loading"
                  @click="getEstimates"
                />
              </div>
            </div>

            <div class="sell-table-wrap surface-card">
              <table class="an-table">
                <thead>
                  <tr>
                    <th style="width: 40px;"></th>
                    <th>{{ isDE ? 'Modell' : 'Model' }}</th>
                    <th>{{ isDE ? 'Hersteller' : 'Manufacturer' }}</th>
                    <th>{{ isDE ? 'Kategorie' : 'Category' }}</th>
                    <th>Status</th>
                    <th>{{ isDE ? 'Seriennr. / Tag' : 'Serial / Tag' }}</th>
                    <th>{{ isDE ? 'Kaufpreis' : 'Purchase Price' }}</th>
                    <th>{{ isDE ? 'Alter' : 'Age' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in filteredAssets" :key="a._id"
                    class="data-row"
                    :class="{ 'sell-row--selected': selectedIds.includes(a._id) }"
                    @click="toggleAsset(a._id)" style="cursor: pointer;">
                    <td><Checkbox :modelValue="selectedIds.includes(a._id)" :binary="true" @click.stop="toggleAsset(a._id)" /></td>
                    <td class="font-bold">{{ a.model }}</td>
                    <td>{{ refName(a.manufacturerId) }}</td>
                    <td>{{ refName(a.categoryId) }}</td>
                    <td>
                      <Tag v-if="a.statusId && typeof a.statusId === 'object'"
                        :value="(a.statusId as any)?.label || (a.statusId as any)?.name || '—'"
                        severity="secondary" style="font-size: 10px;" />
                      <span v-else>—</span>
                    </td>
                    <td class="text-muted text-xs">{{ a.serialNumber || a.assetTag || '—' }}</td>
                    <td>{{ cur(a.purchasePrice) }}</td>
                    <td class="text-muted">{{ assetAge(a.purchaseDate) }}</td>
                  </tr>
                  <tr v-if="filteredAssets.length === 0">
                    <td colspan="8" class="text-center p-5 text-muted">
                      <i class="pi pi-filter-slash" style="font-size: 1.5rem; display: block; margin-bottom: 8px;" />
                      {{ isDE ? 'Keine Geräte gefunden' : 'No assets match your search' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <template v-else-if="step === 'estimate'">
          <div class="sell-summary-row">
            <div class="sell-summary-card surface-card">
              <i class="pi pi-calculator sell-summary-icon" style="color: var(--an-cobalt);" />
              <div>
                <span class="sell-summary-label">{{ isDE ? 'Geschätzter Gesamtwert' : 'Total Estimated Value' }}</span>
                <span class="sell-summary-value" style="color: var(--an-emerald);">{{ cur(totalEstimate) }}</span>
              </div>
            </div>
            <div class="sell-summary-card surface-card">
              <i class="pi pi-shopping-bag sell-summary-icon" style="color: var(--an-text-muted);" />
              <div>
                <span class="sell-summary-label">{{ isDE ? 'Ursprünglicher Kaufpreis' : 'Original Purchase Price' }}</span>
                <span class="sell-summary-value">{{ cur(totalPurchase) }}</span>
              </div>
            </div>
            <div class="sell-summary-card surface-card">
              <i class="pi pi-percentage sell-summary-icon" style="color: var(--p-red-400);" />
              <div>
                <span class="sell-summary-label">{{ isDE ? 'Ø Wertverlust' : 'Avg. Depreciation' }}</span>
                <span class="sell-summary-value" style="color: var(--p-red-400);">-{{ avgDepreciation }}%</span>
              </div>
            </div>
            <div class="sell-summary-card surface-card">
              <i class="pi pi-desktop sell-summary-icon" style="color: var(--an-cobalt);" />
              <div>
                <span class="sell-summary-label">{{ isDE ? 'Geräte' : 'Devices' }}</span>
                <span class="sell-summary-value">{{ estimates.length }}</span>
              </div>
            </div>
          </div>

          <div class="sell-nav-bar">
            <Button :label="isDE ? '← Zurück' : '← Back'" severity="secondary" text @click="step = 'select'; estimates = []" />
            <Button :label="isDE ? 'Partner auswählen →' : 'Choose Partner →'" icon="pi pi-arrow-right" iconPos="right" @click="step = 'partner'" />
          </div>

          <div class="sell-table-wrap surface-card">
            <table class="an-table">
              <thead>
                <tr>
                  <th>{{ isDE ? 'Gerät' : 'Device' }}</th>
                  <th>{{ isDE ? 'Kategorie' : 'Category' }}</th>
                  <th>{{ isDE ? 'Zustand' : 'Condition' }}</th>
                  <th>{{ isDE ? 'Kaufpreis' : 'Purchase' }}</th>
                  <th>{{ isDE ? 'Alter' : 'Age' }}</th>
                  <th>{{ isDE ? 'Schätzwert' : 'Est. Value' }}</th>
                  <th>{{ isDE ? 'Verlust' : 'Loss' }}</th>
                  <th>{{ isDE ? 'Konfidenz' : 'Confidence' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in estimates" :key="e.hardwareId" class="data-row">
                  <td>
                    <div class="font-bold">{{ e.model }}</div>
                    <div v-if="e.serialNumber" class="text-xs text-muted">{{ e.serialNumber }}</div>
                  </td>
                  <td>{{ e.category }}</td>
                  <td><Tag :value="e.condition" :severity="condSeverity(e.condition)" style="font-size: 10px; text-transform: capitalize;" /></td>
                  <td>{{ cur(e.purchasePrice) }}</td>
                  <td>{{ e.ageYears }}{{ isDE ? ' J.' : 'y' }}</td>
                  <td class="font-bold" style="color: var(--an-emerald);">{{ cur(e.estimatedValue) }}</td>
                  <td style="color: var(--p-red-400);">-{{ e.depreciationPct }}%</td>
                  <td><Tag :value="e.confidenceLevel" :severity="confSeverity(e.confidenceLevel)" style="font-size: 10px; text-transform: capitalize;" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="step === 'partner'">
          <div class="sell-nav-bar">
            <Button :label="isDE ? '← Zurück zur Schätzung' : '← Back to Estimates'" severity="secondary" text @click="step = 'estimate'" />
            <div class="sell-nav-center">
              <span class="sell-nav-count">{{ selectedIds.length }} {{ isDE ? 'Geräte' : 'devices' }}</span>
              <span class="sell-nav-value">{{ cur(totalEstimate) }}</span>
            </div>
            <Button :label="isDE ? 'Weiter →' : 'Continue →'" icon="pi pi-arrow-right" iconPos="right" :disabled="!selectedPartner" @click="step = 'confirm'" />
          </div>

          <p class="sell-partner-intro">
            {{ isDE
              ? 'Wählen Sie einen zertifizierten ITAD-Partner für Ihre Geräte. Alle Partner bieten professionelle Datenlöschung und umweltgerechte Verwertung.'
              : 'Choose a certified ITAD partner for your devices. All partners offer professional data wiping and environmentally responsible disposition.' }}
          </p>

          <div class="sell-partner-grid">
            <div v-for="p in partners" :key="p.slug"
              class="sell-partner-card surface-card"
              :class="{
                'sell-partner-card--selected': selectedPartner === p.slug,
                'sell-partner-card--warn': selectedIds.length < p.minQuantity
              }"
              @click="selectedPartner = p.slug">
              <div class="sell-partner-head">
                <div>
                  <div class="sell-partner-name">{{ p.name }}</div>
                  <div class="sell-partner-region"><i class="pi pi-map-marker" style="font-size: 11px;" /> {{ p.region }}</div>
                </div>
                <div class="sell-radio" :class="{ 'sell-radio--active': selectedPartner === p.slug }" />
              </div>
              <p class="sell-partner-desc">{{ isDE ? p.descriptionDe : p.description }}</p>
              <div class="sell-partner-highlights">
                <div v-for="h in (isDE ? p.highlightsDe : p.highlights)" :key="h" class="sell-partner-hl">
                  <i class="pi pi-check-circle" style="color: var(--an-emerald);" /> {{ h }}
                </div>
              </div>
              <div class="sell-partner-meta">
                <span v-if="p.founded" class="sell-pm"><i class="pi pi-calendar" /> {{ isDE ? 'Seit' : 'Since' }} {{ p.founded }}</span>
                <span v-if="p.employees" class="sell-pm"><i class="pi pi-users" /> {{ p.employees }}</span>
                <span v-if="p.volumePerYear" class="sell-pm"><i class="pi pi-chart-bar" /> {{ p.volumePerYear }}</span>
              </div>
              <div class="sell-partner-footer">
                <div class="sell-partner-certs">
                  <Tag v-for="c in p.certifications.slice(0, 4)" :key="c" :value="c" severity="secondary" style="font-size: 9px;" />
                </div>
                <span class="sell-partner-min">Min. {{ p.minQuantity }} {{ isDE ? 'Geräte' : 'devices' }}</span>
              </div>
              <div v-if="selectedIds.length < p.minQuantity" class="sell-partner-warn">
                ⚠ {{ isDE
                  ? `Sie haben ${selectedIds.length} Gerät${selectedIds.length === 1 ? '' : 'e'} ausgewählt, Minimum sind ${p.minQuantity}`
                  : `You selected ${selectedIds.length} device${selectedIds.length === 1 ? '' : 's'}, minimum is ${p.minQuantity}` }}
              </div>
              <a :href="p.website" target="_blank" rel="noopener" class="sell-partner-link" @click.stop>
                {{ p.website.replace('https://', '') }} <i class="pi pi-external-link" style="font-size: 10px;" />
              </a>
            </div>
          </div>
        </template>

        <template v-else-if="step === 'confirm'">
          <div class="sell-nav-bar">
            <Button :label="isDE ? '← Zurück' : '← Back'" severity="secondary" text @click="step = 'partner'" />
            <div class="sell-nav-center">
              <span class="sell-nav-label">{{ isDE ? 'Angebot an' : 'Quote to' }} {{ partnerData?.name }}</span>
              <span class="sell-nav-value">{{ cur(totalEstimate) }}</span>
            </div>
            <Button
              :label="isDE ? 'Angebot absenden' : 'Submit Quote'"
              icon="pi pi-send"
              :loading="loading"
              :disabled="!meetsMin"
              @click="submitQuote"
              severity="success"
            />
          </div>

          <div class="sell-confirm-grid">
            <div class="surface-card sell-confirm-card">
              <h3 class="sell-confirm-title">{{ isDE ? 'Zusammenfassung' : 'Quote Summary' }}</h3>
              <div class="sell-confirm-row"><span>Partner</span><span class="font-bold">{{ partnerData?.name }}</span></div>
              <div class="sell-confirm-row"><span>{{ isDE ? 'Geräte' : 'Devices' }}</span><span>{{ selectedIds.length }}</span></div>
              <div class="sell-confirm-row"><span>{{ isDE ? 'Geschätzter Gesamtwert' : 'Estimated Total' }}</span><span class="font-bold" style="color: var(--an-emerald);">{{ cur(totalEstimate) }}</span></div>
              <div class="sell-confirm-row" v-if="partnerData?.contactEmail"><span>{{ isDE ? 'Wird gesendet an' : 'Will be sent to' }}</span><span>{{ partnerData.contactEmail }}</span></div>
              <div class="sell-confirm-row">
                <span>{{ isDE ? 'Zertifizierungen' : 'Certifications' }}</span>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <Tag v-for="c in partnerData?.certifications.slice(0, 5)" :key="c" :value="c" severity="secondary" style="font-size: 9px;" />
                </div>
              </div>
            </div>
            <div class="surface-card sell-confirm-card">
              <h3 class="sell-confirm-title">
                {{ isDE ? 'Ihre Kontaktdaten' : 'Your Contact Info' }}
                <span style="font-weight: 400; color: var(--an-text-muted);">({{ isDE ? 'optional' : 'optional' }})</span>
              </h3>
              <div class="sell-contact-fields">
                <InputText v-model="contactName" :placeholder="isDE ? 'Ansprechpartner' : 'Contact name'" class="w-full" />
                <InputText v-model="contactEmail" placeholder="Email" class="w-full" />
                <InputText v-model="contactPhone" :placeholder="isDE ? 'Telefon' : 'Phone'" class="w-full" />
              </div>
              <Textarea v-model="notes" :placeholder="isDE ? 'Anmerkungen für den Partner...' : 'Notes for the partner...'" rows="3" class="w-full" style="margin-top: 12px;" />
            </div>
          </div>
        </template>

        <div v-if="quotes.length > 0" class="sell-history">
          <button class="sell-history-toggle" @click="showHistory = !showHistory">
            <i :class="showHistory ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
            {{ isDE ? 'Angebotshistorie' : 'Quote History' }} ({{ quotes.length }})
          </button>
          <div v-if="showHistory" class="sell-table-wrap surface-card mt-2">
            <table class="an-table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>{{ isDE ? 'Geräte' : 'Devices' }}</th>
                  <th>{{ isDE ? 'Schätzwert' : 'Est. Value' }}</th>
                  <th>Status</th>
                  <th>{{ isDE ? 'Datum' : 'Date' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="q in quotes" :key="q._id" class="data-row">
                  <td class="font-bold">{{ q.partnerName }}</td>
                  <td>{{ q.assets.length }} {{ isDE ? 'Gerät' : 'device' }}{{ q.assets.length === 1 ? '' : (isDE ? 'e' : 's') }}</td>
                  <td style="color: var(--an-emerald); font-weight: 700;">{{ cur(q.totalEstimatedValue) }}</td>
                  <td><Tag :value="q.status" :severity="statusSeverity(q.status)" style="font-size: 10px; text-transform: capitalize;" /></td>
                  <td class="text-muted">{{ fmtDate(q.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>


.mp-tabs {
  display: flex; gap: 4px; margin-bottom: 28px;
  background: var(--an-surface-dark); border-radius: 10px; padding: 4px;
}
.mp-tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 600; transition: all 0.2s;
  background: transparent; color: var(--an-text-muted);
}
.mp-tab:hover { color: var(--an-text-primary); }
.mp-tab--active {
  background: var(--an-cobalt); color: white;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.mp-tab i { font-size: 16px; }


.buy-header { margin-bottom: 20px; }
.buy-subtitle { font-size: 14px; color: var(--an-text-subtle); margin-top: 4px; }

.buy-search-bar { padding: 20px; border-radius: 12px; margin-bottom: 16px; }
.buy-search-main { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.buy-search-field { position: relative; flex: 1; min-width: 240px; }
.buy-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--an-text-muted); font-size: 14px; z-index: 1; }
.buy-search-input { width: 100%; padding-left: 36px !important; font-size: 14px; }
.buy-cat-select {
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  border-radius: 6px; color: var(--an-text-primary); padding: 9px 12px;
  font-size: 13px; min-width: 150px;
}
.buy-price-input { width: 120px; font-size: 13px; }
.buy-cat-chips { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; }
.buy-cat-chip {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px;
  border-radius: 16px; border: 1px solid var(--an-border-dark);
  background: transparent; color: var(--an-text-muted);
  font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.buy-cat-chip:hover { border-color: var(--an-cobalt); color: var(--an-text-primary); }
.buy-cat-chip--active {
  background: rgba(59,130,246,0.12); border-color: var(--an-cobalt); color: var(--an-cobalt);
}
.buy-cat-chip i { font-size: 12px; }

.buy-status-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
}
.buy-status-left { display: flex; align-items: center; gap: 10px; }
.buy-status-count { font-size: 14px; font-weight: 700; }
.buy-status-time { font-size: 11px; color: var(--an-text-muted); }
.buy-status-sources { display: flex; gap: 8px; }
.buy-source-badge {
  display: flex; align-items: center; gap: 4px; font-size: 11px;
  color: var(--an-text-muted); font-weight: 500;
}
.buy-source-badge--ok { color: var(--an-emerald); }
.buy-source-badge--off { color: var(--an-text-muted); opacity: 0.5; }

.buy-empty { text-align: center; padding: 60px 20px; }
.buy-empty h3 { font-size: 1.1rem; font-weight: 700; margin: 16px 0 0; }
.buy-empty p { margin-top: 12px; color: var(--an-text-subtle); font-size: 14px; max-width: 450px; margin-left: auto; margin-right: auto; }
.buy-empty-icon {
  width: 72px; height: 72px; border-radius: 18px;
  background: var(--an-surface-dark); display: flex;
  align-items: center; justify-content: center;
  margin: 0 auto 8px; font-size: 2rem; color: var(--an-text-muted);
}
.buy-quick-searches { margin-top: 24px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

.buy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.buy-card {
  border-radius: 12px; overflow: hidden; cursor: pointer;
  transition: all 0.2s; border: 1px solid transparent;
}
.buy-card:hover { border-color: rgba(59,130,246,0.3); transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
.buy-card-img {
  height: 160px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.03); overflow: hidden;
}
.buy-card-img img { max-width: 100%; max-height: 100%; object-fit: contain; padding: 12px; }
.buy-card-img-placeholder { font-size: 3rem; color: var(--an-text-muted); opacity: 0.3; }
.buy-card-body { padding: 14px 16px 16px; }
.buy-card-brand { font-size: 11px; color: var(--an-cobalt); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.buy-card-title { font-size: 13px; font-weight: 600; margin: 4px 0 10px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.buy-card-meta { display: flex; gap: 6px; margin-bottom: 10px; }
.buy-card-cta { font-size: 12px; color: var(--an-cobalt); font-weight: 600; display: flex; align-items: center; gap: 5px; }
.buy-card-cta i { font-size: 12px; }

.detail-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 40px 20px; text-align: center; color: var(--an-text-muted);
}
.detail-gallery {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px;
  scroll-snap-type: x mandatory;
}
.detail-gallery-img {
  width: 200px; height: 180px; object-fit: contain; flex-shrink: 0;
  background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px;
  scroll-snap-align: start;
}
.detail-img-wrap { text-align: center; margin-bottom: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 16px; }
.detail-img-placeholder { display: flex; align-items: center; justify-content: center; height: 120px; }
.detail-header-info { margin-bottom: 16px; }
.detail-model { font-size: 1.1rem; font-weight: 700; margin: 0; }
.detail-version { font-size: 12px; color: var(--an-text-muted); margin: 4px 0 0; font-family: monospace; }
.detail-aspects {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;
}
.detail-aspect-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 20px;
  background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.15);
  font-size: 12px; font-weight: 600; white-space: nowrap;
}
.detail-aspect-chip i { font-size: 12px; color: var(--an-cobalt); }
.detail-info { margin-bottom: 20px; }
.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--an-border-dark); font-size: 13px; }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--an-text-muted); font-weight: 600; }
.detail-specs-grouped { margin-bottom: 20px; }
.detail-spec-section { margin-bottom: 16px; }
.detail-section-title { font-size: 14px; font-weight: 700; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; color: var(--an-cobalt); }
.detail-spec-grid { display: grid; gap: 1px; background: var(--an-border-dark); border-radius: 8px; overflow: hidden; }
.detail-spec-row { display: grid; grid-template-columns: 1fr 1fr; background: var(--an-surface-dark); }
.detail-spec-key { padding: 8px 12px; font-size: 12px; color: var(--an-text-muted); font-weight: 600; }
.detail-spec-val { padding: 8px 12px; font-size: 12px; }
.detail-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.font-mono { font-family: monospace; }


.sell-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
}
.sell-subtitle { font-size: 14px; color: var(--an-text-subtle); margin-top: 4px; }
.sell-header-stats { display: flex; gap: 24px; }
.sell-stat { text-align: center; }
.sell-stat-value { display: block; font-size: 1.5rem; font-weight: 800; color: var(--an-text-primary); }
.sell-stat-label { display: block; font-size: 11px; color: var(--an-text-muted); font-weight: 600; }

.sell-steps {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 28px; gap: 0;
}
.sell-step {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  border-radius: 20px; font-size: 13px; font-weight: 600;
  color: var(--an-text-muted); transition: all 0.25s ease;
}
.sell-step--active { color: var(--an-text-primary); background: rgba(255,255,255,0.08); }
.sell-step--done { color: var(--an-emerald); }
.sell-step-num {
  width: 26px; height: 26px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  border: 2px solid var(--an-border-dark); transition: all 0.25s ease;
}
.sell-step--active .sell-step-num { border-color: var(--an-cobalt); background: var(--an-cobalt); color: white; }
.sell-step--done .sell-step-num { border-color: var(--an-emerald); background: var(--an-emerald); color: white; }
.sell-step-line { width: 48px; height: 2px; background: var(--an-border-dark); transition: background 0.25s; }
.sell-step-line--done { background: var(--an-emerald); }

.sell-empty { text-align: center; padding: 80px 20px; }
.sell-empty p { margin-top: 12px; color: var(--an-text-subtle); font-size: 14px; max-width: 400px; margin-left: auto; margin-right: auto; }
.sell-empty h3 { font-size: 1.1rem; font-weight: 700; margin: 16px 0 0; }
.sell-empty-icon {
  width: 72px; height: 72px; border-radius: 18px;
  background: var(--an-surface-dark); display: flex;
  align-items: center; justify-content: center;
  margin: 0 auto 8px; font-size: 2rem; color: var(--an-text-muted);
}

.sell-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-radius: 8px 8px 0 0;
  border-bottom: 1px solid var(--an-border-dark);
}
.sell-toolbar-left { display: flex; align-items: center; gap: 10px; }
.sell-toolbar-right { display: flex; align-items: center; gap: 8px; }
.sell-search-wrap { position: relative; min-width: 260px; }
.sell-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--an-text-muted); font-size: 13px; z-index: 1; }
.sell-search-input { width: 100%; padding-left: 32px !important; font-size: 13px; }
.sell-cat-filter {
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  border-radius: 6px; color: var(--an-text-primary); padding: 7px 10px;
  font-size: 13px; min-width: 140px;
}
.sell-selection-count { font-size: 13px; color: var(--an-text-subtle); white-space: nowrap; }

.sell-table-wrap { overflow-x: auto; border-radius: 0 0 8px 8px; }
.an-table { width: 100%; border-collapse: collapse; }
.an-table th, .an-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--an-border-dark); font-size: 13px; }
.an-table th { font-weight: 600; color: var(--an-text-subtle); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.data-row { transition: background 0.15s; }
.data-row:hover { background: rgba(255,255,255,0.02) !important; }
.sell-row--selected { background: rgba(59,130,246,0.06) !important; }
.text-muted { color: var(--an-text-muted); }
.text-xs { font-size: 12px; }

.sell-summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.sell-summary-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 10px; }
.sell-summary-icon { font-size: 1.5rem; }
.sell-summary-label { display: block; font-size: 11px; color: var(--an-text-muted); font-weight: 600; letter-spacing: 0.03em; }
.sell-summary-value { display: block; font-size: 1.25rem; font-weight: 800; }

.sell-nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; margin-bottom: 16px; border-bottom: 1px solid var(--an-border-dark);
}
.sell-nav-center { text-align: center; }
.sell-nav-count { display: block; font-size: 12px; color: var(--an-text-muted); font-weight: 600; }
.sell-nav-label { display: block; font-size: 12px; color: var(--an-text-muted); font-weight: 600; }
.sell-nav-value { display: block; font-size: 1.4rem; font-weight: 800; color: var(--an-emerald); }

.sell-partner-intro { font-size: 14px; color: var(--an-text-subtle); margin-bottom: 20px; line-height: 1.6; }
.sell-partner-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
.sell-partner-card {
  padding: 20px; border: 2px solid transparent; border-radius: 12px;
  cursor: pointer; transition: all 0.2s; position: relative;
}
.sell-partner-card:hover { border-color: rgba(59,130,246,0.3); }
.sell-partner-card--selected { border-color: var(--an-cobalt) !important; background: rgba(59,130,246,0.04); }
.sell-partner-card--warn { opacity: 0.7; }
.sell-partner-card--warn:hover { opacity: 1; }
.sell-partner-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.sell-partner-name { font-size: 16px; font-weight: 700; }
.sell-partner-region { font-size: 11px; color: var(--an-text-muted); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.sell-radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--an-border-dark); transition: all 0.2s; flex-shrink: 0; }
.sell-radio--active { border-color: var(--an-cobalt); background: var(--an-cobalt); box-shadow: inset 0 0 0 3px var(--an-surface-dark); }
.sell-partner-desc { font-size: 13px; color: var(--an-text-subtle); line-height: 1.5; margin: 0 0 12px; }
.sell-partner-highlights { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.sell-partner-hl { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; }
.sell-partner-hl i { font-size: 12px; }
.sell-partner-meta { display: flex; gap: 14px; margin-bottom: 12px; flex-wrap: wrap; }
.sell-pm { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--an-text-muted); }
.sell-pm i { font-size: 11px; }
.sell-partner-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 12px; border-top: 1px solid var(--an-border-dark);
}
.sell-partner-certs { display: flex; gap: 4px; flex-wrap: wrap; }
.sell-partner-min { font-size: 11px; color: var(--an-text-muted); font-weight: 600; white-space: nowrap; }
.sell-partner-warn {
  margin-top: 10px; padding: 6px 10px; border-radius: 6px;
  background: rgba(239,68,68,0.1); color: #ef4444;
  font-size: 11px; font-weight: 600;
}
.sell-partner-link {
  display: block; margin-top: 8px; font-size: 11px; color: var(--an-cobalt);
  text-decoration: none; display: flex; align-items: center; gap: 4px;
}
.sell-partner-link:hover { text-decoration: underline; }

.sell-confirm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sell-confirm-card { padding: 20px; border-radius: 10px; }
.sell-confirm-title { font-size: 15px; font-weight: 700; margin: 0 0 16px; }
.sell-confirm-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--an-border-dark); font-size: 13px; }
.sell-confirm-row:last-child { border-bottom: none; }
.sell-contact-fields { display: flex; flex-direction: column; gap: 10px; }

.sell-history { margin-top: 36px; border-top: 1px solid var(--an-border-dark); padding-top: 20px; }
.sell-history-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  background: none; border: none; color: var(--an-text-subtle);
  font-size: 14px; font-weight: 600; cursor: pointer; padding: 4px 0;
}
.sell-history-toggle:hover { color: var(--an-text-primary); }

@media (max-width: 768px) {
  .mp-tabs { flex-direction: column; }
  .sell-header { flex-direction: column; }
  .sell-header-stats { flex-wrap: wrap; gap: 16px; }
  .sell-summary-row { grid-template-columns: 1fr 1fr; }
  .sell-partner-grid { grid-template-columns: 1fr; }
  .sell-confirm-grid { grid-template-columns: 1fr; }
  .sell-steps { flex-wrap: wrap; gap: 4px; }
  .sell-step-line { width: 20px; }
  .sell-toolbar { flex-direction: column; gap: 12px; align-items: stretch; }
  .sell-toolbar-right { flex-wrap: wrap; }
  .sell-nav-bar { flex-direction: column; gap: 12px; text-align: center; }
  .buy-search-main { flex-direction: column; }
  .buy-grid { grid-template-columns: 1fr; }
}
</style>
