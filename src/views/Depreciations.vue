<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useFormatters } from '../composables/useFormatters'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import Button from 'primevue/button'

import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()

interface DepRecord {
  _id: string
  hardwareId: { _id: string; serialNumber?: string; model?: string; category?: string } | null
  method: string; purchasePrice: number; salvageValue: number; usefulLifeMonths: number
  purchaseDate: string; depreciationRate: number
  calculation: { monthlyDepreciation: number; annualDepreciation: number; accumulated: number; currentValue: number; percentDepreciated: number; fullyDepreciated: boolean; monthsRemaining: number | null }
}
interface Summary { totalAssets: number; totalOriginalValue: number; totalCurrentValue: number; totalAccumulatedDepreciation: number; fullyDepreciatedCount: number; averageDepreciation: number }

const records = ref<DepRecord[]>([])
const summary = ref<Summary | null>(null)
const hardware = ref<{ _id: string; serialNumber: string; model: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialog = ref(false)
const editing = ref<DepRecord | null>(null)
const deleteDialog = ref(false)
const deletingId = ref<string | null>(null)
const form = ref({ hardwareId: '', method: 'straightLine', purchasePrice: 0, salvageValue: 0, usefulLifeMonths: 36, depreciationRate: 20, notes: '' })
const { fmtCurrency: formattedValue } = useFormatters()
const hardwareOptions = computed(() => hardware.value.map(h => ({ label: `${h.serialNumber || ''} — ${h.model || 'Unknown'}`, value: h._id })))
const methodOptions = [{ label: 'Straight Line', value: 'straightLine' }, { label: 'Declining Balance', value: 'decliningBalance' }]

const depColumns: ColumnDef[] = [
  { key: 'asset', label: t('common.asset'), default: true },
  { key: 'method', label: t('depreciations.method'), default: true },
  { key: 'purchasePrice', label: t('depreciations.original'), default: true, format: 'currency' },
  { key: 'currentValue', label: t('depreciations.currentValue'), default: true, format: 'currency' },
  { key: 'percentDepreciated', label: t('depreciations.depreciation'), default: true },
  { key: 'monthly', label: t('depreciations.monthly'), default: true, format: 'currency' },
  { key: 'remaining', label: t('depreciations.remaining'), default: true },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('depreciations', depColumns)

function getCellValue(rec: DepRecord, key: string): string {
  switch (key) {
    case 'asset': return rec.hardwareId?.serialNumber || rec.hardwareId?.model || '—'
    case 'method': return rec.method === 'straightLine' ? 'Straight Line' : 'Declining Balance'
    case 'purchasePrice': return formattedValue(rec.purchasePrice)
    case 'currentValue': return formattedValue(rec.calculation.currentValue)
    case 'percentDepreciated': return `${rec.calculation.percentDepreciated}%`
    case 'monthly': return `${formattedValue(rec.calculation.monthlyDepreciation)}/mo`
    case 'remaining': return rec.calculation.fullyDepreciated ? t('depreciations.fullyDepreciated') : (rec.calculation.monthsRemaining !== null ? `${rec.calculation.monthsRemaining} months` : '—')
    default: return '—'
  }
}

const filteredRecords = computed(() => {
  const defaultSorted = [...records.value].sort((a, b) => (b.calculation?.percentDepreciated || 0) - (a.calculation?.percentDepreciated || 0))
  return defaultSorted
})
const { sortKey, sortDir, toggleSort, sorted: sortedRecords } = useTableSort(filteredRecords, depColumns, getCellValue)

async function load() {
  loading.value = true
  try {
    const [recRes, sumRes, hwRes] = await Promise.all([api.get('/depreciations'), api.get('/depreciations/summary'), api.get('/hardware')])
    records.value = recRes.data; summary.value = sumRes.data
    const hwData = hwRes.data; hardware.value = Array.isArray(hwData) ? hwData : hwData.hardware || []
  } catch { error.value = 'Failed to load depreciation data' }
  finally { loading.value = false }
}

function openCreate() { editing.value = null; form.value = { hardwareId: '', method: 'straightLine', purchasePrice: 0, salvageValue: 0, usefulLifeMonths: 36, depreciationRate: 20, notes: '' }; dialog.value = true }
function openEdit(rec: DepRecord) { editing.value = rec; form.value = { hardwareId: rec.hardwareId?._id || '', method: rec.method, purchasePrice: rec.purchasePrice, salvageValue: rec.salvageValue, usefulLifeMonths: rec.usefulLifeMonths, depreciationRate: rec.depreciationRate, notes: '' }; dialog.value = true }
async function save() {
  try {
    if (editing.value) {
      await api.put(`/depreciations/${editing.value._id}`, form.value)
    } else {
      await api.post('/depreciations', form.value)
    }
    dialog.value = false; await load()
  } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Save failed' }
}
function confirmDelete(id: string) { deletingId.value = id; deleteDialog.value = true }
async function remove() {
  if (!deletingId.value) return
  try { await api.delete(`/depreciations/${deletingId.value}`); deleteDialog.value = false; deletingId.value = null; await load() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Delete failed' }
}


onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('depreciations.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('depreciations.subtitle') }}</p>
        </div>
        <Button severity="primary" icon="pi pi-plus" :label="$t('depreciations.addDepreciation')" @click="openCreate" />
        </div>
        <div class="flex align-items-center gap-2 mt-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
        </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

      <template v-else>
        <div v-if="summary" class="kpi-grid mb-4">
          <div class="kpi-card"><div class="kpi-value">{{ summary.totalAssets }}</div><div class="kpi-label">{{ $t('depreciations.trackedAssets') }}</div></div>
          <div class="kpi-card"><div class="kpi-value" style="color: var(--an-emerald);">{{ formattedValue(summary.totalOriginalValue) }}</div><div class="kpi-label">{{ $t('depreciations.originalValue') }}</div></div>
          <div class="kpi-card"><div class="kpi-value" style="color: var(--an-blue);">{{ formattedValue(summary.totalCurrentValue) }}</div><div class="kpi-label">{{ $t('depreciations.currentValue') }}</div></div>
          <div class="kpi-card"><div class="kpi-value" style="color: var(--an-amber);">{{ formattedValue(summary.totalAccumulatedDepreciation) }}</div><div class="kpi-label">{{ $t('depreciations.totalDepreciated') }}</div></div>
          <div class="kpi-card"><div class="kpi-value" style="color: var(--an-red);">{{ summary.fullyDepreciatedCount }}</div><div class="kpi-label">{{ $t('depreciations.fullyDepreciated') }}</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ summary.averageDepreciation }}%</div><div class="kpi-label">{{ $t('depreciations.avgDepreciation') }}</div></div>
        </div>

        <div class="table-wrapper surface-card">
          <table class="an-table">
            <thead>
              <tr>
                <template v-for="col in visibleColumns" :key="col.key">

                  <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />

                  <th v-else style="text-align:right;">{{ $t('common.actions') }}</th>

                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rec in sortedRecords" :key="rec._id" class="data-row">
                <template v-for="col in visibleColumns" :key="col.key">

                <td v-if="col.key === '_actions'" style="text-align:right;" :data-label="$t('common.actions')">
                  <Button icon="pi pi-pencil" size="small" text rounded @click="openEdit(rec)" />
                  <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = rec._id; historyDialogVisible = true" />
                  <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(rec._id)" />
                </td>
                <td v-else :data-label="col.label">
                  <template v-if="col.key === 'asset'">
                    <div class="font-bold">{{ rec.hardwareId?.serialNumber || rec.hardwareId?.model || '—' }}</div>
                    <div v-if="rec.hardwareId?.model && rec.hardwareId?.serialNumber" style="font-size:12px;color:var(--an-text-muted);">{{ rec.hardwareId.model }}</div>
                  </template>
                  <template v-else-if="col.key === 'method'"><Tag :value="rec.method === 'straightLine' ? 'Straight Line' : 'Declining Balance'" :severity="rec.method === 'straightLine' ? 'info' : 'secondary'" /></template>
                  <template v-else-if="col.key === 'purchasePrice'"><span style="text-align:right;">{{ formattedValue(rec.purchasePrice) }}</span></template>
                  <template v-else-if="col.key === 'currentValue'"><span style="font-weight:600;">{{ formattedValue(rec.calculation.currentValue) }}</span></template>
                  <template v-else-if="col.key === 'percentDepreciated'">{{ rec.calculation.percentDepreciated }}%</template>
                  <template v-else-if="col.key === 'monthly'">{{ formattedValue(rec.calculation.monthlyDepreciation) }}/mo</template>
                  <template v-else-if="col.key === 'remaining'">
                    <Tag v-if="rec.calculation.fullyDepreciated" :value="$t('depreciations.fullyDepreciated')" severity="danger" />
                    <template v-else-if="rec.calculation.monthsRemaining !== null">{{ rec.calculation.monthsRemaining }} months</template>
                    <template v-else>—</template>
                  </template>
                  <template v-else>{{ getCellValue(rec, col.key) }}</template>
                </td>
                </template>
              </tr>
              <tr v-if="sortedRecords.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('depreciations.noRecords') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <Dialog v-model:visible="dialog" :header="editing ? $t('depreciations.editDepreciation') : $t('depreciations.newDepreciation')" :style="{ width: '550px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2"><label>{{ $t('depreciations.hardwareAsset') }}</label><Select v-model="form.hardwareId" :options="hardwareOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!!editing" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('depreciations.method') }}</label><Select v-model="form.method" :options="methodOptions" optionLabel="label" optionValue="value" class="w-full" /></div>
          <div class="grid">
            <div class="col-6"><label>{{ $t('depreciations.purchasePrice') }}</label><InputNumber v-model="form.purchasePrice" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" /></div>
            <div class="col-6"><label>{{ $t('depreciations.salvageValue') }}</label><InputNumber v-model="form.salvageValue" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" /></div>
          </div>
          <div v-if="form.method === 'straightLine'" class="flex flex-column gap-2"><label>{{ $t('depreciations.usefulLife') }}</label><InputNumber v-model="form.usefulLifeMonths" :min="1" class="w-full" /></div>
          <div v-if="form.method === 'decliningBalance'" class="flex flex-column gap-2"><label>{{ $t('depreciations.annualRate') }}</label><InputNumber v-model="form.depreciationRate" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('common.notes') }}</label><Textarea v-model="form.notes" rows="2" class="w-full" /></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="dialog = false" />
          <Button :label="editing ? $t('common.update') : $t('common.create')" severity="primary" :disabled="!form.hardwareId" @click="save" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('depreciations.deleteConfirm') }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="remove" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Depreciation" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

