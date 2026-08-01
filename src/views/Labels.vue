<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'

const { t } = useI18n()
import { useCategoryTranslation } from '../composables/useEntityTranslation'
const { translateCategoryName } = useCategoryTranslation()
interface HardwareItem { _id: string; serialNumber: string; assetTag?: string; model: string; categoryId?: { _id: string; name: string }; manufacturerId?: { _id: string; name: string }; statusId?: { _id: string; name: string } }

const hardwareList = ref<HardwareItem[]>([])
const selected = ref<string[]>([])
const loading = ref(true)
const generating = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const previewItem = ref<{ serialNumber: string; model: string; qrDataUrl: string } | null>(null)

async function fetchHardware() {
  loading.value = true
  try { const params: Record<string, string> = {}; if (searchQuery.value) params.search = searchQuery.value; hardwareList.value = (await api.get('/hardware', { params })).data }
  catch (err) { error.value = 'Failed to load hardware'; console.error(err) }
  finally { loading.value = false }
}
async function showPreview(id: string) { try { previewItem.value = (await api.get(`/labels/qr-data/${id}`)).data } catch { error.value = 'Failed to generate QR preview' } }
async function generatePdfLabels() {
  if (selected.value.length === 0) return; generating.value = true
  try { const r = await api.post('/labels/labels', { assetIds: selected.value }, { responseType: 'blob' }); const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `asset-labels-${new Date().toISOString().slice(0, 10)}.pdf`; a.click(); window.URL.revokeObjectURL(url) }
  catch { error.value = 'Failed to generate label PDF' } finally { generating.value = false }
}
function toggleSelect(id: string) { const i = selected.value.indexOf(id); if (i >= 0) selected.value.splice(i, 1); else selected.value.push(id) }
function toggleAll() { selected.value = selected.value.length === hardwareList.value.length ? [] : hardwareList.value.map(h => h._id) }

onMounted(fetchHardware)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('labels.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('labels.subtitle') }}</p>
        </div>
        <Button severity="primary" icon="pi pi-file-pdf" :loading="generating" :disabled="selected.length === 0" :label="$t('labels.generatePdf') + ` (${selected.length})`" @click="generatePdfLabels" />
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('common.search')" class="an-search-input" @update:modelValue="fetchHardware" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th style="width:50px;"><Checkbox :modelValue="selected.length === hardwareList.length && hardwareList.length > 0" :binary="true" :indeterminate="selected.length > 0 && selected.length < hardwareList.length" @update:modelValue="toggleAll" /></th>
              <th>{{ t('hardware.serialNumber') }}</th><th>{{ t('hardware.model') }}</th><th>{{ t('common.category') }}</th><th>{{ t('hardware.manufacturer') }}</th><th style="text-align:right;">{{ t('labels.preview') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in hardwareList" :key="item._id" class="data-row">
              <td><Checkbox :modelValue="selected.includes(item._id)" :binary="true" @update:modelValue="() => toggleSelect(item._id)" /></td>
              <td class="font-bold">{{ item.serialNumber || item.assetTag || '—' }}</td>
              <td>{{ item.model }}</td><td>{{ translateCategoryName(item.categoryId) }}</td><td>{{ item.manufacturerId?.name || '—' }}</td>
              <td style="text-align:right;" :data-label="$t('common.actions')"><Button icon="pi pi-qrcode" size="small" text rounded severity="primary" @click="showPreview(item._id)" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog :visible="!!previewItem" @update:visible="previewItem = null" header="QR Preview" :style="{width:'350px'}" modal>
        <div v-if="previewItem" class="text-center">
          <img :src="previewItem.qrDataUrl" :alt="previewItem.serialNumber" style="max-width:200px;" class="mb-3" />
          <div class="font-bold">{{ previewItem.serialNumber }}</div>
          <div style="color:var(--an-text-muted);">{{ previewItem.model }}</div>
        </div>
        <template #footer><Button :label="$t('common.close')" text @click="previewItem = null" /></template>
      </Dialog>
    </div>
  </div>
</template>

