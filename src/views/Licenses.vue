<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import { useFormatters } from '../composables/useFormatters'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import PaginationBar from '../components/PaginationBar.vue'
import { usePagination } from '../composables/usePagination'
import { useSanitization } from '../composables/useSanitization'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import EntityFormDialog from '../components/EntityFormDialog.vue'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'
import { useCategoryTranslation } from '../composables/useEntityTranslation'
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager

const { t } = useI18n()
const { translateCategoryName } = useCategoryTranslation()

interface License {
  _id: string; name: string; publisher?: any; categoryId?: any; licenseType: string; licenseKey?: string
  totalSeats: number; availableSeats: number; costPerSeat: number; billingCycle: string
  seats?: { employeeId: string; checkedOutAt: string }[]
  expirationDate?: string; renewalDate?: string; purchaseDate?: string; notes?: string; isActive: boolean
}

const licenses = ref<License[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')


const showAddDialog = ref(false)
const showEditDialog = ref(false)
const saving = ref(false)
const newLicense = ref({ name: '', publisher: '', categoryId: '' as string, licenseType: 'subscription', licenseKey: '', totalSeats: 1, costPerSeat: 0, billingCycle: 'annual', expirationDate: null as Date | null, notes: '' })
const editLicense = ref({ _id: '', name: '', publisher: '', categoryId: '' as string, licenseType: 'subscription', licenseKey: '', totalSeats: 1, costPerSeat: 0, billingCycle: 'annual', expirationDate: null as Date | null, notes: '' })
const deleteDialog = ref(false)
const deletingItem = ref<License | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const summary = ref<{ totalLicenses: number; totalSeats: number; utilization: number; totalCost: number } | null>(null)

const showCheckoutDialog = ref(false)
const showSeatsDialog = ref(false)
const checkoutLicense = ref<License | null>(null)
const seatsLicense = ref<License | null>(null)
const employees = ref<{ label: string; value: string }[]>([])
const checkoutEmployeeIds = ref<string[]>([])
const checkoutNotes = ref('')

const categoryOptions = ref<{ _id: string; name: string }[]>([])
const publisherOptions = ref<{ _id: string; name: string }[]>([])
const LICENSE_TYPES = ['subscription', 'perpetual', 'trial', 'open-source', 'freemium', 'other']
const BILLING_CYCLES = ['monthly', 'annual', 'one-time', 'other']
const typeOptions = LICENSE_TYPES.map(v => ({ label: t(`licenses.type.${v}`), value: v }))
const billingOptions = BILLING_CYCLES.map(v => ({ label: t(`licenses.billing.${v}`), value: v }))

const licenseColumns: ColumnDef[] = [
  { key: 'name', label: t('common.name'), default: true },
  { key: 'publisher', label: t('common.publisher'), default: true },
  { key: 'categoryId', label: t('common.category'), default: false },
  { key: 'licenseType', label: t('common.type'), default: true },
  { key: 'licenseKey', label: t('licenses.licenseKey'), default: false },
  { key: 'seats', label: t('licenses.seats'), default: true },
  { key: 'costPerSeat', label: t('common.costPerSeat'), default: true, format: 'currency' },
  { key: 'billingCycle', label: t('common.billing'), default: true },
  { key: 'expirationDate', label: t('licenses.expires'), default: true, format: 'date' },
  { key: 'notes', label: t('common.notes'), default: false },
  { key: 'isActive', label: t('common.status'), default: true, format: 'tag' },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('licenses', licenseColumns)

async function fetchLicenses() {
  loading.value = true; error.value = null
  try {
    const [listRes, summaryRes] = await Promise.all([
      api.get('/licenses', { params: searchQuery.value ? { search: searchQuery.value } : {} }),
      api.get('/licenses/summary/stats')
    ])
    licenses.value = listRes.data
    const s = summaryRes.data
    summary.value = {
      totalLicenses: s.totalLicenses || 0,
      totalSeats: s.totalSeats || 0,
      utilization: s.utilizationRate || 0,
      totalCost: (s.monthlyCost || 0) * 12 + (s.annualCost || 0)
    }
  } catch { error.value = t('licenses.loadError') } finally { loading.value = false }
}

async function fetchLookups() {
  try {
    const [catRes, mfgRes] = await Promise.all([
      api.get('/categories', { params: { entityType: 'license' } }),
      api.get('/manufacturers')
    ])
    categoryOptions.value = catRes.data
    publisherOptions.value = mfgRes.data
  } catch {  console.warn('[Licenses] Failed to load lookup data') }
}

async function addLicense() {
  saving.value = true
  try {
    const payload: Record<string, unknown> = { ...newLicense.value }
    if (payload.expirationDate) payload.expirationDate = (payload.expirationDate as Date).toISOString()
    else delete payload.expirationDate
    if (!payload.categoryId) delete payload.categoryId
    await api.post('/licenses', payload)
    showAddDialog.value = false
    newLicense.value = { name: '', publisher: '', categoryId: '', licenseType: 'subscription', licenseKey: '', totalSeats: 1, costPerSeat: 0, billingCycle: 'annual', expirationDate: null, notes: '' }
    await fetchLicenses()
  } catch (err: unknown) { error.value = extractApiError(err, t('licenses.addError')) } finally { saving.value = false }
}

function confirmDelete(item: License) { deletingItem.value = item; deleteDialog.value = true }
async function deleteLicense() {
  if (!deletingItem.value) return
  try { await api.delete(`/licenses/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await fetchLicenses() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || t('licenses.deleteError') }
}

const { fmtCurrency: formatCurrency, fmtDate: formatDate } = useFormatters()

function getCellValue(item: License, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'publisher': return item.publisher && typeof item.publisher === 'object' ? item.publisher.name : (item.publisher || '—')
    case 'categoryId': return translateCategoryName(item.categoryId && typeof item.categoryId === 'object' ? item.categoryId._id : item.categoryId)
    case 'licenseType': return t(`licenses.type.${item.licenseType}`, item.licenseType)
    case 'licenseKey': return item.licenseKey || '—'
    case 'costPerSeat': return formatCurrency(item.costPerSeat)
    case 'billingCycle': return t(`licenses.billing.${item.billingCycle}`, item.billingCycle)
    case 'expirationDate': return formatDate(item.expirationDate)
    case 'notes': return item.notes || '—'
    default: return '—'
  }
}

const { sortKey, sortDir, toggleSort, sorted: sortedLicenses } = useTableSort(licenses, licenseColumns, getCellValue)
const { paginatedItems, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedLicenses, 25)
watch([searchQuery], () => resetPage())

function openEditLicense(item: License) {
  editLicense.value = {
    _id: item._id, name: item.name,
    publisher: item.publisher && typeof item.publisher === 'object' ? item.publisher._id : (item.publisher || ''),
    categoryId: item.categoryId && typeof item.categoryId === 'object' ? item.categoryId._id : (item.categoryId || ''),
    licenseType: item.licenseType,
    licenseKey: item.licenseKey || '', totalSeats: item.totalSeats,
    costPerSeat: item.costPerSeat, billingCycle: item.billingCycle,
    expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
    notes: item.notes || ''
  }
  showEditDialog.value = true
}

async function saveEditLicense() {
  saving.value = true
  try {
    const { _id, ...data } = editLicense.value
    const payload: Record<string, unknown> = { ...data }
    if (payload.expirationDate) payload.expirationDate = (payload.expirationDate as Date).toISOString()
    else delete payload.expirationDate
    if (!payload.categoryId) delete payload.categoryId
    await api.patch(`/licenses/${_id}`, payload)
    showEditDialog.value = false; await fetchLicenses()
  } catch (err: unknown) { error.value = extractApiError(err, t('licenses.updateError')) } finally { saving.value = false }
}

async function fetchEmployees() {
  try {
    const res = await api.get('/employees')
    employees.value = res.data.map((e: { _id: string; firstName: string; lastName: string }) => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
  } catch {  console.warn('[Licenses] Failed to load employees') }
}

function openCheckoutSeat(item: License) {
  checkoutLicense.value = item
  checkoutEmployeeIds.value = []
  checkoutNotes.value = ''
  showCheckoutDialog.value = true
}

function openSeatsDetail(item: License) {
  seatsLicense.value = item
  showSeatsDialog.value = true
}

const { getEmployeeName: sanitizeEmployeeName } = useSanitization()

function getEmployeeName(emp: unknown): string {
  const sanitized = sanitizeEmployeeName(emp)
  if (sanitized !== '—' && sanitized !== 'Unbekannt / Gelöscht' && typeof emp !== 'string') {
    return sanitized
  }

  const empId = typeof emp === 'object' && emp !== null ? String((emp as Record<string, unknown>)._id || '') : String(emp)
  if (empId) {
    const found = employees.value.find(e => e.value === empId)
    if (found) return found.label
  }

  return sanitized
}

function getEmployeeId(emp: unknown): string {
  if (emp && typeof emp === 'object') {
    const obj = emp as Record<string, unknown>
    return String(obj._id || emp)
  }
  return String(emp)
}

async function submitCheckoutSeat() {
  if (!checkoutLicense.value || !checkoutEmployeeIds.value || checkoutEmployeeIds.value.length === 0) return
  saving.value = true
  try {
    await api.post(`/licenses/${checkoutLicense.value._id}/checkout`, {
      employeeIds: checkoutEmployeeIds.value,
      notes: checkoutNotes.value || undefined
    })
    showCheckoutDialog.value = false
    await fetchLicenses()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('licenses.checkoutError'))
  } finally { saving.value = false }
}

async function checkinSeat(licenseId: string, employeeId: string) {
  try {
    await api.post(`/licenses/${licenseId}/checkin`, { employeeId })
    showSeatsDialog.value = false
    await fetchLicenses()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('licenses.checkinError'))
  }
}

onMounted(() => { fetchLicenses(); fetchEmployees(); fetchLookups() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing:-0.02em;">{{ $t('licenses.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('licenses.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('licenses.addLicense')" class="btn-glow-primary" @click="showAddDialog = true" />
        </div>
      </div>

      <div v-if="summary" class="kpi-grid mb-4">
        <div class="kpi-card" style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.12);flex-shrink:0;"><i class="pi pi-id-card"></i></div>
          <div><div class="kpi-value" style="font-size:1.5rem;">{{ summary.totalLicenses }}</div><div class="kpi-label">{{ $t('licenses.totalLicenses') }}</div></div>
        </div>
        <div class="kpi-card" style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,0.12);flex-shrink:0;"><i class="pi pi-users"></i></div>
          <div><div class="kpi-value" style="font-size:1.5rem;">{{ summary.totalSeats }}</div><div class="kpi-label">{{ $t('licenses.totalSeats') }}</div></div>
        </div>
        <div class="kpi-card" style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.12);flex-shrink:0;"><i class="pi pi-chart-pie"></i></div>
          <div><div class="kpi-value" style="font-size:1.5rem;">{{ Math.round(summary.utilization) }}%</div><div class="kpi-label">{{ $t('licenses.utilization') }}</div></div>
        </div>
        <div class="kpi-card" style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.12);flex-shrink:0;"><i class="pi pi-dollar"></i></div>
          <div><div class="kpi-value" style="font-size:1.5rem;">{{ formatCurrency(summary.totalCost) }}</div><div class="kpi-label">{{ $t('licenses.totalCost') }}</div></div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('licenses.searchPlaceholder')" class="an-search-input" @update:modelValue="fetchLicenses" />
        </div>
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
            <tr v-for="item in paginatedItems" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;" :data-label="$t('common.actions')">
                <Button v-if="isManager" icon="pi pi-user-plus" size="small" text severity="success" v-tooltip.top="t('licenses.checkoutSeat')" @click="openCheckoutSeat(item)" class="mr-1" />
                <Button v-if="(item.seats?.length || 0) > 0" icon="pi pi-users" size="small" text severity="info" v-tooltip.top="t('licenses.viewSeats')" @click="openSeatsDetail(item)" class="mr-1" />
                <Button v-if="isManager" icon="pi pi-pencil" size="small" text severity="primary" @click="openEditLicense(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'"><span class="font-bold">{{ item.name }}</span></template>
                <template v-else-if="col.key === 'seats'">
                  <Tag :value="`${item.seats?.length || 0} / ${item.totalSeats === -1 ? '∞' : item.totalSeats}`" :severity="item.totalSeats === -1 || item.availableSeats > 0 ? 'success' : 'danger'" />
                </template>
                <template v-else-if="col.key === 'isActive'">
                  <Tag :value="item.isActive ? $t('common.active') : $t('common.inactive')" :severity="item.isActive ? 'success' : 'secondary'" />
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="licenses.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td></tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <EntityFormDialog
        v-model:visible="showAddDialog"
        :header="$t('licenses.addLicense')"
        width="650px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        @save="addLicense"
      >
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('common.name') }}</label><InputText v-model="newLicense.name" class="w-full mt-2" /></div>
          <div><label>{{ $t('common.publisher') }}</label><QuickCreateSelect v-model="newLicense.publisher" :options="publisherOptions" createEndpoint="/manufacturers" :entityLabel="$t('common.publisher')" class="w-full mt-2" @created="fetchLookups" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.category') }}</label><QuickCreateSelect v-model="newLicense.categoryId" :options="categoryOptions" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'license' }" class="w-full mt-2" @created="fetchLookups" /></div>
            <div style="flex:1;"><label>{{ $t('common.type') }}</label><Select v-model="newLicense.licenseType" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('licenses.seats') }}</label><InputNumber v-model="newLicense.totalSeats" :min="0" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.costPerSeat') }}</label><InputNumber v-model="newLicense.costPerSeat" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.billing') }}</label><Select v-model="newLicense.billingCycle" :options="billingOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('licenses.expires') }}</label><DatePicker v-model="newLicense.expirationDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
          </div>
          <div><label>{{ $t('licenses.licenseKey') }}</label><InputText v-model="newLicense.licenseKey" class="w-full mt-2" :placeholder="$t('common.optional')" /></div>
          <div><label>{{ $t('common.notes') }}</label><Textarea v-model="newLicense.notes" rows="2" class="w-full mt-2" /></div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        v-model:visible="showEditDialog"
        :header="$t('licenses.editLicense')"
        width="650px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        @save="saveEditLicense"
      >
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('common.name') }}</label><InputText v-model="editLicense.name" class="w-full mt-2" /></div>
          <div><label>{{ $t('common.publisher') }}</label><QuickCreateSelect v-model="editLicense.publisher" :options="publisherOptions" createEndpoint="/manufacturers" :entityLabel="$t('common.publisher')" class="w-full mt-2" @created="fetchLookups" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.category') }}</label><QuickCreateSelect v-model="editLicense.categoryId" :options="categoryOptions" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'license' }" class="w-full mt-2" @created="fetchLookups" /></div>
            <div style="flex:1;"><label>{{ $t('common.type') }}</label><Select v-model="editLicense.licenseType" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('licenses.seats') }}</label><InputNumber v-model="editLicense.totalSeats" :min="0" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.costPerSeat') }}</label><InputNumber v-model="editLicense.costPerSeat" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.billing') }}</label><Select v-model="editLicense.billingCycle" :options="billingOptions" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('licenses.expires') }}</label><DatePicker v-model="editLicense.expirationDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
          </div>
          <div><label>{{ $t('licenses.licenseKey') }}</label><InputText v-model="editLicense.licenseKey" class="w-full mt-2" /></div>
          <div><label>{{ $t('common.notes') }}</label><Textarea v-model="editLicense.notes" rows="2" class="w-full mt-2" /></div>
        </div>
      </EntityFormDialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteLicense" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="SoftwareLicense" :entityId="historyEntityId" />
      </Dialog>

      <EntityFormDialog
        v-model:visible="showCheckoutDialog"
        :header="t('licenses.checkoutSeat') + ': ' + (checkoutLicense?.name || '')"
        width="450px"
        :saveLabel="t('licenses.checkoutSeat')"
        saveIcon="pi pi-user-plus"
        saveSeverity="success"
        :loading="saving"
        :disabled="!checkoutEmployeeIds || checkoutEmployeeIds.length === 0"
        @save="submitCheckoutSeat"
      >
        <div class="flex flex-column gap-3">
          <div>
            <label>{{ $t('common.employee') }}</label>
            <MultiSelect v-model="checkoutEmployeeIds" :options="employees" optionLabel="label" optionValue="value" :placeholder="$t('common.selectEmployee')" filter display="chip" class="w-full mt-2" />
          </div>
          <div>
            <label>{{ $t('common.notes') }}</label>
            <Textarea v-model="checkoutNotes" rows="2" class="w-full mt-2" />
          </div>
          <Message v-if="checkoutLicense" severity="info" :closable="false">
            {{ t('licenses.seats') }}: {{ checkoutLicense.seats?.length || 0 }} / {{ checkoutLicense.totalSeats === -1 ? '∞' : checkoutLicense.totalSeats }}
          </Message>
        </div>
      </EntityFormDialog>

      <Dialog v-model:visible="showSeatsDialog" :header="t('licenses.viewSeats') + ': ' + (seatsLicense?.name || '')" :style="{width:'550px'}" modal>
        <div v-if="seatsLicense?.seats?.length" class="flex flex-column gap-2">
          <div v-for="seat in seatsLicense.seats" :key="getEmployeeId(seat.employeeId)" class="flex align-items-center justify-content-between p-3" style="border:1px solid var(--an-border-dark);border-radius:var(--radius-md);">
            <div>
              <div class="font-bold">{{ getEmployeeName(seat.employeeId) }}</div>
              <div style="font-size:12px;color:var(--an-text-muted);">{{ t('licenses.checkedOutAt') }}: {{ new Date(seat.checkedOutAt).toLocaleDateString('de-DE') }}</div>
            </div>
            <Button icon="pi pi-sign-in" size="small" severity="warn" :label="t('licenses.checkin')" @click="checkinSeat(seatsLicense!._id, getEmployeeId(seat.employeeId))" />
          </div>
        </div>
        <p v-else style="color:var(--an-text-muted);">{{ $t('common.noData') }}</p>
      </Dialog>
    </div>
  </div>
</template>
