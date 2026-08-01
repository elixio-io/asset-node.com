<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useFormatters } from '../composables/useFormatters'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const { t } = useI18n()

const hardware = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const loadingPrices = ref<Record<string, boolean>>({})
const marketPrices = ref<Record<string, any>>({})

const filtered = computed(() => {
  if (!search.value) return hardware.value
  const q = search.value.toLowerCase()
  return hardware.value.filter(h => h.name?.toLowerCase().includes(q) || h.manufacturerId?.name?.toLowerCase().includes(q) || h.model?.toLowerCase().includes(q))
})

async function fetchHardware() {
  loading.value = true
  try { hardware.value = (await api.get('/hardware?status=forSale')).data }
  catch { error.value = t('sales.loadError') }
  finally { loading.value = false }
}

async function searchMarketPrices(item: any) {
  loadingPrices.value[item._id] = true
  try {
    const res = await api.post('/ai/market-prices', {
      manufacturer: item.manufacturerId?.name || item.manufacturer || '',
      model: item.model || item.name || '',
      category: item.categoryId?.name || item.category || '',
      condition: 'used, good condition'
    })
    const data = res.data
    if (data.unavailable) {
      marketPrices.value[item._id] = { suggestedPrice: null, unavailable: true, reason: data.reason }
    } else {
      marketPrices.value[item._id] = {
        suggestedPrice: data.suggestedPrice,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        confidence: data.confidence,
        sources: data.sources || [],
        unavailable: false
      }
    }
  } catch {
    marketPrices.value[item._id] = {
      suggestedPrice: null,
      unavailable: true,
      reason: t('sales.aiUnavailable', 'AI pricing service is currently unavailable.')
    }
  } finally {
    loadingPrices.value[item._id] = false
  }
}

async function setSalePrice(itemId: string, price: number) {
  try { await api.patch(`/hardware/${itemId}`, { salePrice: price }); await fetchHardware() }
  catch { error.value = t('sales.setPriceError') }
}

const { fmtCurrency } = useFormatters()

onMounted(fetchHardware)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('sales.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ $t('sales.subtitle') }}</p>
        </div>
      </div>

      <div class="an-card">
        <div style="padding:16px 16px 0;">
          <div class="an-search-wrapper" style="max-width:320px;margin-bottom:16px;">
            <i class="pi pi-search an-search-icon" />
            <InputText v-model="search" :placeholder="$t('sales.search')" class="an-search-input" />
          </div>
        </div>

        <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

        <table v-else class="an-table">
          <thead>
            <tr>
              <th>{{ $t('common.name') }}</th>
              <th>{{ $t('common.manufacturer') }}</th>
              <th>{{ $t('common.model') }}</th>
              <th>{{ $t('sales.purchaseCost') }}</th>
              <th>{{ $t('sales.salePrice') }}</th>
              <th>{{ $t('sales.marketPrice') }}</th>
              <th class="text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item._id">
              <td class="font-bold">{{ item.name }}</td>
              <td>{{ item.manufacturerId?.name || '—' }}</td>
              <td>{{ item.model || '—' }}</td>
              <td>{{ fmtCurrency(item.purchaseCost) }}</td>
              <td>
                <Tag v-if="item.salePrice" :value="fmtCurrency(item.salePrice)" severity="success" />
                <span v-else style="color:var(--an-text-muted);">—</span>
              </td>
              <td>
                <template v-if="marketPrices[item._id]">
                  <div v-if="marketPrices[item._id].unavailable" style="font-size:12px;color:var(--an-text-muted);font-style:italic;">
                    {{ $t('sales.aiComingSoon', 'KI-Marktpreise — verfügbar in einem zukünftigen Update') }}
                  </div>
                  <template v-else>
                    <div style="font-size:13px;">
                      <div>{{ $t('sales.suggestedPrice') }}: <strong>{{ fmtCurrency(marketPrices[item._id].suggestedPrice) }}</strong></div>
                      <div style="color:var(--an-text-muted);font-size:12px;">{{ $t('sales.range') }}: {{ fmtCurrency(marketPrices[item._id].minPrice) }} – {{ fmtCurrency(marketPrices[item._id].maxPrice) }}</div>
                    </div>
                    <Button size="small" text severity="success" :label="$t('sales.useSuggested')" class="mt-1" @click="setSalePrice(item._id, marketPrices[item._id].suggestedPrice)" />
                  </template>
                </template>
                <span v-else style="color:var(--an-text-muted);">—</span>
              </td>
              <td class="text-right">
                <Button size="small" severity="info" outlined icon="pi pi-search" :loading="loadingPrices[item._id]" :label="$t('sales.searchPrices')" @click="searchMarketPrices(item)" />
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="7" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('sales.noItems') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

