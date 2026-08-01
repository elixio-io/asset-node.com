<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import PaginationBar from '../components/PaginationBar.vue'
import { usePagination } from '../composables/usePagination'
import { useFormatters } from '../composables/useFormatters'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager

interface HardwareRef { _id: string; serialNumber: string; model: string; assetTag?: string; categoryId?: { _id: string; name: string }; manufacturerId?: { _id: string; name: string } }
interface MaintenanceRecord { _id: string; hardware: HardwareRef; type: string; description: string; performedBy: string; cost?: number; startDate: string; completionDate?: string; status: string; notes?: string; createdAt: string }

const records = ref<MaintenanceRecord[]>([])
const hardwareList = ref<HardwareRef[]>([])
const employees = ref<{ _id: string; firstName: string; lastName: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const filterStatus = ref('')
const filterType = ref('')

const MAINTENANCE_TYPES = ['repair', 'preventive', 'inspection', 'upgrade', 'cleaning']
const MAINTENANCE_STATUSES = ['scheduled', 'inProgress', 'completed', 'cancelled']
const statusSeverity: Record<string, string> = { scheduled: 'info', inProgress: 'warn', completed: 'success', cancelled: 'secondary' }
const statusOptions = computed(() => [{ label: t('common.allStatuses'), value: '' }, ...MAINTENANCE_STATUSES.map(s => ({ label: t(`maintenance.statusLabel.${s}`, s), value: s }))])
const typeFilterOptions = computed(() => [{ label: t('maintenance.allTypes'), value: '' }, ...MAINTENANCE_TYPES.map(tt => ({ label: t(`maintenance.typeLabel.${tt}`, tt), value: tt }))])
const typeOptions = MAINTENANCE_TYPES.map(tt => ({ label: t(`maintenance.typeLabel.${tt}`, tt), value: tt }))
const statusFormOptions = MAINTENANCE_STATUSES.map(s => ({ label: t(`maintenance.statusLabel.${s}`, s), value: s }))
const hardwareOptions = computed(() => hardwareList.value.map(h => ({ label: `${h.serialNumber || h.model || 'N/A'} — ${h.model}`, value: h._id })))
const employeeOptions = computed(() => employees.value.map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e._id })))

const showDialog = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ hardware: '', type: 'repair', description: '', performedBy: '', cost: null as number | null, startDate: new Date() as Date | null, completionDate: null as Date | null, status: 'scheduled', notes: '' })
const deleteConfirmDialog = ref(false)
const deleteTargetId = ref<string | null>(null)
const deleteTargetName = ref('')
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialogTitle = computed(() => editingId.value ? t('maintenance.editRecord') : t('maintenance.addRecord'))

function resetForm() { editingId.value = null; form.value = { hardware: '', type: 'repair', description: '', performedBy: '', cost: null, startDate: new Date(), completionDate: null, status: 'scheduled', notes: '' } }
function openAdd() { resetForm(); showDialog.value = true }
function openEdit(item: MaintenanceRecord) {
  editingId.value = item._id
  form.value = { hardware: item.hardware._id, type: item.type, description: item.description, performedBy: item.performedBy, cost: item.cost ?? null, startDate: item.startDate ? new Date(item.startDate) : null, completionDate: item.completionDate ? new Date(item.completionDate) : null, status: item.status, notes: item.notes || '' }
  showDialog.value = true
}

async function fetchRecords() {
  loading.value = true; error.value = null
  try { const params: Record<string, string> = {}; if (filterStatus.value) params.status = filterStatus.value; records.value = (await api.get('/maintenance', { params })).data }
  catch { error.value = t('maintenance.loadError') } finally { loading.value = false }
}
async function fetchHardware() { try { hardwareList.value = (await api.get('/hardware')).data } catch (err) { console.error('Failed to load hardware:', err) } }
async function fetchEmployees() { try { employees.value = (await api.get('/employees')).data } catch {  } }

async function saveRecord() {
  saving.value = true; error.value = null
  try {
    const payload: Record<string, unknown> = { type: form.value.type, description: form.value.description, performedBy: form.value.performedBy, status: form.value.status, startDate: form.value.startDate ? (form.value.startDate as Date).toISOString() : undefined }
    if (form.value.cost != null) payload.cost = form.value.cost
    if (form.value.completionDate) payload.completionDate = (form.value.completionDate as Date).toISOString()
    if (form.value.notes) payload.notes = form.value.notes
    if (editingId.value) await api.put(`/maintenance/${editingId.value}`, payload)
    else { payload.hardware = form.value.hardware; await api.post('/maintenance', payload) }
    showDialog.value = false; await fetchRecords()
  } catch (err: unknown) { error.value = extractApiError(err, t('maintenance.saveError')) } finally { saving.value = false }
}

function promptDelete(item: MaintenanceRecord) { deleteTargetId.value = item._id; deleteTargetName.value = `${item.type} — ${item.hardware?.model || item.hardware?.serialNumber || ''}`; deleteConfirmDialog.value = true }
async function confirmDelete() {
  if (!deleteTargetId.value) return
  try { await api.delete(`/maintenance/${deleteTargetId.value}`); deleteConfirmDialog.value = false; deleteTargetId.value = null; await fetchRecords() }
  catch (err: unknown) { error.value = extractApiError(err, t('maintenance.deleteError')) }
}

const maintenanceColumns: ColumnDef[] = [
  { key: 'asset', label: t('maintenance.asset'), default: true },
  { key: 'type', label: t('maintenance.type'), default: true },
  { key: 'description', label: t('maintenance.description'), default: true },
  { key: 'performedBy', label: t('maintenance.performedBy'), default: true },
  { key: 'cost', label: t('maintenance.cost'), default: true, format: 'currency' },
  { key: 'status', label: t('maintenance.status'), default: true, format: 'tag' },
  { key: 'startDate', label: t('maintenance.startDate'), default: true, format: 'date' },
  { key: 'completionDate', label: t('maintenance.completionDate'), default: false, format: 'date' },
  { key: 'notes', label: t('common.notes'), default: false },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('maintenance', maintenanceColumns)

function getCellValue(item: MaintenanceRecord, key: string): string {
  switch (key) {
    case 'description': return item.description
    case 'performedBy': return item.performedBy
    case 'cost': return fmtCurrency(item.cost)
    case 'startDate': return fmtDate(item.startDate)
    case 'completionDate': return fmtDate(item.completionDate)
    case 'notes': return item.notes || '—'
    default: return '—'
  }
}

const filteredRecords = computed(() => {
  let result = records.value
  if (filterType.value) result = result.filter(r => r.type === filterType.value)
  return result
})

const { sortKey, sortDir, toggleSort, sorted: sortedRecords } = useTableSort(filteredRecords, maintenanceColumns, getCellValue)
const { paginatedItems: paginatedRecords, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedRecords, 25)
watch([filterStatus, filterType], () => resetPage())

const { fmtDate, fmtCurrency } = useFormatters()

onMounted(() => { fetchRecords(); fetchHardware(); fetchEmployees() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing:-0.02em;">{{ $t('maintenance.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('maintenance.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('maintenance.addRecord')" class="btn-glow-primary" @click="openAdd" />
        </div>
      </div>

      <div class="filter-bar">
        <Select v-model="filterStatus" :options="statusOptions" optionLabel="label" optionValue="value" :placeholder="$t('common.allStatuses')" @update:modelValue="fetchRecords" style="max-width:200px;" />
        <Select v-model="filterType" :options="typeFilterOptions" optionLabel="label" optionValue="value" :placeholder="$t('maintenance.allTypes')" style="max-width:200px;" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead><tr>
            <template v-for="col in visibleColumns" :key="col.key">

              <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />

              <th v-else style="text-align:right;">{{ t('common.actions') }}</th>

            </template>
          </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedRecords" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;">
                <Button v-if="isManager" icon="pi pi-pencil" size="small" text severity="primary" @click="openEdit(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text severity="danger" @click="promptDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'asset'">
                  <div v-if="item.hardware" class="flex align-items-center gap-2">
                    <i class="pi pi-desktop"></i>
                    <div><div class="font-bold" style="font-size:14px;">{{ item.hardware.model }}</div><div style="font-size:12px;color:var(--an-text-muted);">{{ item.hardware.serialNumber }}</div></div>
                  </div>
                  <span v-else style="color:var(--an-text-muted);">—</span>
                </template>
                <template v-else-if="col.key === 'type'"><Tag :value="t(`maintenance.typeLabel.${item.type}`, item.type)" severity="info" /></template>
                <template v-else-if="col.key === 'description'"><div style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.description }}</div></template>
                <template v-else-if="col.key === 'status'"><Tag :value="t(`maintenance.statusLabel.${item.status}`, item.status)" :severity="(statusSeverity[item.status] as any) || 'secondary'" /></template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="filteredRecords.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td></tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <Dialog v-model:visible="showDialog" :header="dialogTitle" :style="{width:'600px'}" modal>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('maintenance.asset') }}</label><Select v-model="form.hardware" :options="hardwareOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('maintenance.type') }}</label><Select v-model="form.type" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.status') }}</label><Select v-model="form.status" :options="statusFormOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          </div>
          <div><label>{{ $t('maintenance.description') }}</label><Textarea v-model="form.description" rows="3" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('maintenance.performedBy') }}</label><Select v-model="form.performedBy" :options="employeeOptions" optionLabel="label" optionValue="value" class="w-full mt-2" filter showClear :placeholder="$t('common.select')" /></div>
            <div style="flex:1;"><label>{{ $t('maintenance.cost') }} (€)</label><InputNumber v-model="form.cost" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('maintenance.startDate') }}</label><DatePicker v-model="form.startDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
            <div style="flex:1;"><label>{{ $t('maintenance.completionDate') }}</label><DatePicker v-model="form.completionDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
          </div>
          <div><label>{{ $t('common.notes') }}</label><Textarea v-model="form.notes" rows="2" class="w-full mt-2" /></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="saveRecord" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteConfirmDialog" :header="$t('common.confirmDelete')" :style="{width:'450px'}" modal>
        <p>{{ $t('common.deleteConfirmText', { name: deleteTargetName }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteConfirmDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="confirmDelete" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="MaintenanceRecord" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

