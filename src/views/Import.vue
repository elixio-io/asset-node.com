<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Message from 'primevue/message'
import FileUpload from 'primevue/fileupload'
import Steps from 'primevue/steps'

const { t } = useI18n()
const step = ref(0)
const entityType = ref('hardware')
const file = ref<File | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const headers = ref<{ index: number; name: string }[]>([])
const previewRows = ref<Record<string, string>[]>([])
const totalRows = ref(0)
const modelFields = ref<{ key: string; label: string; required: boolean; type: string }[]>([])
const mapping = ref<Record<string, number | null>>({})
const importResult = ref<any>(null)
const importErrors = ref<string[]>([])

const entityTypes = [
  { label: 'Hardware / Assets', value: 'hardware' },
  { label: 'Peripherals', value: 'peripherals' },
  { label: 'Employees', value: 'employees' },
  { label: 'Consumables', value: 'consumables' },
  { label: 'Software Licenses', value: 'licenses' },
  { label: 'Components', value: 'components' },
  { label: 'Locations', value: 'locations' },
  { label: 'Manufacturers', value: 'manufacturers' },
  { label: 'Suppliers', value: 'suppliers' }
]
const stepItems = [{ label: t('import.uploadFile') }, { label: t('import.mapColumns') }, { label: t('import.results') }]
const headerOptions = computed(() => [
  { label: t('common.notMapped'), value: null },
  ...headers.value.map(h => ({ label: `${h.name} (Col ${h.index})`, value: h.index }))
])
const requiredMapped = computed(() => modelFields.value.filter(f => f.required).every(f => mapping.value[f.key] != null))
const mappedPreview = computed(() => previewRows.value.map(row => {
  const m: Record<string, string> = {}
  for (const f of modelFields.value) { const c = mapping.value[f.key]; if (c != null) { const h = headers.value.find(x => x.index === c); if (h) m[f.label] = row[h.name] || '' } }
  return m
}))
const mappedFieldLabels = computed(() => modelFields.value.filter(f => mapping.value[f.key] != null).map(f => f.label))

function onFileSelect(event: any) {
  file.value = event.files?.[0] || null
  headers.value = []; previewRows.value = []; mapping.value = {}
  importResult.value = null; importErrors.value = []; error.value = null
}

async function parseFile() {
  if (!file.value) return; loading.value = true; error.value = null
  try {
    modelFields.value = (await api.get(`/import/fields/${entityType.value}`)).data.fields
    const init: Record<string, number | null> = {}; for (const f of modelFields.value) init[f.key] = null; mapping.value = init
    const fd = new FormData(); fd.append('file', file.value)
    const res = await api.post('/import/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    headers.value = res.data.headers; previewRows.value = res.data.previewRows; totalRows.value = res.data.totalRows
    for (const field of modelFields.value) {
      const match = headers.value.find(h => { const hl = h.name.toLowerCase().replace(/[_\-\s]+/g, ''); const fl = field.label.toLowerCase().replace(/[_\-\s]+/g, ''); return hl === fl || hl === field.key.toLowerCase() || hl.includes(fl) || fl.includes(hl) })
      if (match) mapping.value[field.key] = match.index
    }
    step.value = 1
  } catch (e: any) { error.value = e?.response?.data?.error || 'Failed to parse file' }
  finally { loading.value = false }
}

async function runImport() {
  if (!file.value) return; loading.value = true; error.value = null; importResult.value = null; importErrors.value = []
  try {
    const cm: Record<string, number> = {}; for (const [k, v] of Object.entries(mapping.value)) { if (v != null) cm[k] = v }
    const fd = new FormData(); fd.append('file', file.value); fd.append('mapping', JSON.stringify(cm))
    const res = await api.post(`/import/${entityType.value}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    importResult.value = res.data; if (res.data.errors) importErrors.value = res.data.errors; step.value = 2
  } catch (e: any) { error.value = e?.response?.data?.error || 'Import failed'; if (Array.isArray(e?.response?.data?.details)) importErrors.value = e.response.data.details }
  finally { loading.value = false }
}

function reset() { step.value = 0; file.value = null; headers.value = []; previewRows.value = []; mapping.value = {}; importResult.value = null; importErrors.value = []; error.value = null }
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <div class="view-header">
        <div>
          <h1 class="text-xl font-bold">{{ t('import.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('import.subtitle') }}</p>
        </div>
      </div>
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <Steps :model="stepItems" :activeStep="step" class="mb-4" />

      <div v-if="step === 0" class="section-card">
        <h2 class="section-title"><i class="pi pi-upload mr-2"></i>{{ $t('import.selectFileAndType') }}</h2>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('import.whatImporting') }}</label><Select v-model="entityType" :options="entityTypes" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          <div><label>{{ $t('import.selectFile') }}</label><FileUpload mode="basic" accept=".xlsx,.xls" :auto="false" :chooseLabel="$t('import.chooseXlsx')" @select="onFileSelect" class="mt-2" /></div>
          <Button severity="primary" :loading="loading" :disabled="!file" icon="pi pi-arrow-right" :label="$t('import.parseFile')" size="large" @click="parseFile" />
        </div>
      </div>

      <div v-if="step === 1" class="section-card">
        <div class="flex justify-content-between align-items-center mb-3">
          <div><h2 class="section-title"><i class="pi pi-link mr-2"></i>{{ $t('import.mapColumns') }}</h2><p style="font-size:13px;color:var(--an-text-muted);">{{ $t('import.rowsFound', { count: totalRows }) }}</p></div>
          <Button text icon="pi pi-arrow-left" :label="$t('common.back')" @click="step = 0" />
        </div>
        <div class="flex flex-column gap-3 mb-4">
          <div v-for="field in modelFields" :key="field.key"><label>{{ field.label }} <span v-if="field.required" style="color:var(--an-red);">*</span></label><Select v-model="mapping[field.key]" :options="headerOptions" optionLabel="label" optionValue="value" class="w-full mt-1" showClear /></div>
        </div>
        <div v-if="mappedPreview.length > 0 && mappedFieldLabels.length > 0" class="mb-4">
          <h3 class="font-bold mb-2">{{ $t('import.preview', { count: mappedPreview.length }) }}</h3>
          <div class="table-wrapper"><table class="an-table"><thead><tr><th v-for="l in mappedFieldLabels" :key="l">{{ l }}</th></tr></thead><tbody><tr v-for="(r, i) in mappedPreview" :key="i"><td v-for="l in mappedFieldLabels" :key="l">{{ r[l] || '—' }}</td></tr></tbody></table></div>
        </div>
        <div class="flex gap-3">
          <Button severity="primary" size="large" :loading="loading" :disabled="!requiredMapped" icon="pi pi-database" :label="$t('import.importRows', { count: totalRows })" @click="runImport" />
          <Button outlined size="large" icon="pi pi-arrow-left" :label="$t('common.back')" @click="step = 0" />
        </div>
      </div>

      <div v-if="step === 2" class="section-card">
        <h2 class="section-title"><i class="pi pi-check-circle mr-2"></i>{{ $t('import.importComplete') }}</h2>
        <Message v-if="importResult?.success" severity="success" class="mb-3">Imported {{ importResult.imported }} of {{ importResult.total }} rows.</Message>
        <Message v-if="importErrors.length > 0" severity="warn" class="mb-3">{{ importErrors.length }} warnings<ul class="mt-1"><li v-for="(e, i) in importErrors.slice(0, 20)" :key="i">{{ e }}</li></ul></Message>
        <Button severity="primary" icon="pi pi-refresh" :label="$t('import.importAnother')" size="large" @click="reset" />
      </div>
    </div>
  </div>
</template>

