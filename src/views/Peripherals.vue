<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import PaginationBar from '../components/PaginationBar.vue'
import { usePagination } from '../composables/usePagination'
import { useStatusTranslation, useCategoryTranslation } from '../composables/useEntityTranslation'
import { useSanitization } from '../composables/useSanitization'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'
import EntityFormDialog from '../components/EntityFormDialog.vue'

const { t } = useI18n()
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager

interface Peripheral {
  _id: string
  model: string
  serialNumber?: string
  categoryId?: { _id: string; name: string; icon?: string; color?: string } | null
  statusId?: { _id: string; name: string; type?: string; color?: string } | null
  manufacturerId?: { _id: string; name: string } | null
  assignedTo?: { _id: string; firstName: string; lastName: string } | null
  purchaseDate?: string
  purchasePrice?: number
  warrantyExpiry?: string
  notes?: string
}

const peripherals = ref<Peripheral[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')



const showAddDialog = ref(false)
const showEditDialog = ref(false)
const deleteDialog = ref(false)
const deletingItem = ref<Peripheral | null>(null)
const saving = ref(false)

const newPeripheral = ref({
  categoryId: '' as string,
  model: '',
  serialNumber: '',
  manufacturerId: '' as string,
  statusId: '' as string,
  purchaseDate: null as Date | null,
  purchasePrice: null as number | null,
  warrantyExpiry: null as Date | null,
  notes: ''
})

const editPeripheral = ref({
  _id: '',
  categoryId: '' as string,
  model: '',
  serialNumber: '',
  manufacturerId: '' as string,
  statusId: '' as string,
  assignedTo: '' as string,
  purchaseDate: null as Date | null,
  purchasePrice: null as number | null,
  warrantyExpiry: null as Date | null,
  notes: ''
})

const employees = ref<{ _id: string; firstName: string; lastName: string }[]>([])
const employeeOptions = ref<{ label: string; value: string }[]>([])
const manufacturers = ref<{ _id: string; name: string }[]>([])
const statuses = ref<{ _id: string; name: string; slug?: string; type?: string }[]>([])
const categories = ref<{ _id: string; name: string }[]>([])
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const { translateStatusName, getStatusSeverity, translatedStatuses: makeTranslatedStatuses } = useStatusTranslation()
const translatedStatuses = makeTranslatedStatuses(statuses)

const { translateCategoryName } = useCategoryTranslation()

const peripheralColumns: ColumnDef[] = [
  { key: 'category', label: t('common.category'), default: true },
  { key: 'model', label: t('hardware.model'), default: true },
  { key: 'serialNumber', label: t('hardware.serialNumber'), default: true },
  { key: 'manufacturer', label: t('hardware.manufacturer'), default: true },
  { key: 'assignedTo', label: t('hardware.assignedTo'), default: true, format: 'employee' },
  { key: 'purchaseDate', label: t('hardware.purchaseDate'), default: false, format: 'date' },
  { key: 'purchasePrice', label: t('hardware.purchasePrice'), default: false },
  { key: 'warrantyExpiry', label: t('hardware.warrantyExpiry'), default: false, format: 'date' },
  { key: 'notes', label: t('common.notes'), default: false },
  { key: 'status', label: t('common.status'), default: true, format: 'tag' },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('peripherals', peripheralColumns)



const { getRelatedName, getEmployeeName } = useSanitization()

function getCellValue(item: Peripheral, key: string): string {
  switch (key) {
    case 'category': return translateCategoryName(item.categoryId as any)
    case 'model': return item.model
    case 'serialNumber': return item.serialNumber || '—'
    case 'manufacturer': return getRelatedName(item.manufacturerId)
    case 'assignedTo': return getEmployeeName(item.assignedTo)
    case 'purchaseDate': return item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('de-DE') : '—'
    case 'purchasePrice': return item.purchasePrice ? `€${item.purchasePrice.toLocaleString('de-DE')}` : '—'
    case 'warrantyExpiry': return item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString('de-DE') : '—'
    case 'notes': return item.notes || '—'
    default: return '—'
  }
}

const { sortKey, sortDir, toggleSort, sorted: sortedPeripherals } = useTableSort(peripherals, peripheralColumns, getCellValue)
const { paginatedItems, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedPeripherals, 25)
watch([searchQuery], () => resetPage())

async function fetchPeripherals() {
  loading.value = true; error.value = null
  try {
    const params: Record<string, string> = {}
    if (searchQuery.value) params.search = searchQuery.value
    peripherals.value = (await api.get('/peripherals', { params })).data
  } catch {
    error.value = 'Failed to load peripherals'
  } finally {
    loading.value = false
  }
}

async function fetchEmployees() {
  try {
    const res = await api.get('/employees')
    employees.value = res.data
    employeeOptions.value = [
      { label: '— ' + t('common.noData') + ' —', value: '' },
      ...res.data.map((e: { _id: string; firstName: string; lastName: string }) => ({
        label: `${e.firstName} ${e.lastName}`, value: e._id
      }))
    ]
  } catch {  console.warn('[Peripherals] Failed to load employees') }
}

async function fetchLookups() {
  try {
    const [mfgRes, statusRes, catRes] = await Promise.all([
      api.get('/manufacturers'),
      api.get('/statuses'),
      api.get('/categories', { params: { entityType: 'peripheral' } })
    ])
    manufacturers.value = mfgRes.data
    statuses.value = statusRes.data
    categories.value = catRes.data
  } catch {  console.warn('[Peripherals] Failed to load lookup data') }
}

function resetNewPeripheralForm() {
  newPeripheral.value = {
    categoryId: '',
    model: '',
    serialNumber: '',
    manufacturerId: '',
    statusId: '',
    purchaseDate: null,
    purchasePrice: null,
    warrantyExpiry: null,
    notes: ''
  }
}

async function addPeripheral() {
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      categoryId: newPeripheral.value.categoryId,
      model: newPeripheral.value.model,
    }
    if (newPeripheral.value.serialNumber) payload.serialNumber = newPeripheral.value.serialNumber
    if (newPeripheral.value.manufacturerId) payload.manufacturerId = newPeripheral.value.manufacturerId
    if (newPeripheral.value.statusId) payload.statusId = newPeripheral.value.statusId
    if (newPeripheral.value.purchaseDate) payload.purchaseDate = newPeripheral.value.purchaseDate
    if (newPeripheral.value.purchasePrice) payload.purchasePrice = newPeripheral.value.purchasePrice
    if (newPeripheral.value.warrantyExpiry) payload.warrantyExpiry = newPeripheral.value.warrantyExpiry
    if (newPeripheral.value.notes) payload.notes = newPeripheral.value.notes

    await api.post('/peripherals', payload)
    showAddDialog.value = false
    resetNewPeripheralForm()
    await fetchPeripherals()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    error.value = e.response?.data?.error || 'Failed to add peripheral'
  } finally {
    saving.value = false
  }
}

function confirmDelete(item: Peripheral) { deletingItem.value = item; deleteDialog.value = true }

async function deletePeripheral() {
  if (!deletingItem.value) return
  try {
    await api.delete(`/peripherals/${deletingItem.value._id}`)
    deleteDialog.value = false
    deletingItem.value = null
    await fetchPeripherals()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    error.value = e.response?.data?.error || 'Failed to delete'
  }
}

function openEditPeripheral(item: Peripheral) {
  editPeripheral.value = {
    _id: item._id,
    categoryId: (item.categoryId as any)?._id || '',
    model: item.model,
    serialNumber: item.serialNumber || '',
    manufacturerId: (item.manufacturerId as any)?._id || '',
    statusId: (item.statusId as any)?._id || '',
    assignedTo: (item.assignedTo as any)?._id || '',
    purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
    purchasePrice: item.purchasePrice || null,
    warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry) : null,
    notes: item.notes || ''
  }
  showEditDialog.value = true
}

async function saveEditPeripheral() {
  saving.value = true
  try {
    const { _id, ...data } = editPeripheral.value
    await api.put(`/peripherals/${_id}`, data)
    showEditDialog.value = false
    await fetchPeripherals()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    error.value = e.response?.data?.error || 'Failed to update'
  } finally {
    saving.value = false
  }
}

onMounted(() => { fetchPeripherals(); fetchEmployees(); fetchLookups() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing:-0.02em;">{{ $t('peripherals.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('peripherals.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('peripherals.addPeripheral')" @click="showAddDialog = true" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('peripherals.searchPlaceholder')" class="an-search-input" @update:modelValue="fetchPeripherals" />
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
                <Button v-if="isManager" icon="pi pi-pencil" size="small" text severity="primary" @click="openEditPeripheral(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'status'">
                  <Tag :value="(item.statusId as any)?.slug ? translateStatusName(item.statusId as any) : ((item.statusId as any)?.name || '—')" :severity="(getStatusSeverity(item.statusId) as any)" />
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="peripherals.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td></tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <EntityFormDialog
        v-model:visible="showAddDialog"
        :header="$t('peripherals.addPeripheral')"
        width="520px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        :disabled="!newPeripheral.categoryId || !newPeripheral.model"
        @save="addPeripheral"
      >
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.category') }} *</label>
              <QuickCreateSelect v-model="newPeripheral.categoryId" :options="categories" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'peripheral' }" class="w-full mt-2" @created="fetchLookups" />
            </div>
            <div style="flex:1;"><label>{{ $t('hardware.manufacturer') }}</label>
              <QuickCreateSelect v-model="newPeripheral.manufacturerId" :options="manufacturers" createEndpoint="/manufacturers" :entityLabel="$t('common.manufacturer')" class="w-full mt-2" @created="fetchLookups" />
            </div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('hardware.model') }} *</label><InputText v-model="newPeripheral.model" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('hardware.serialNumber') }}</label><InputText v-model="newPeripheral.serialNumber" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.status') }}</label>
              <QuickCreateSelect v-model="newPeripheral.statusId" :options="translatedStatuses" createEndpoint="/statuses" :entityLabel="$t('common.status')" :extraFields="{ type: 'deployable' }" class="w-full mt-2" @created="fetchLookups" />
            </div>
            <div style="flex:1;"><label>{{ $t('hardware.purchasePrice') }}</label><InputNumber v-model="newPeripheral.purchasePrice" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-2" placeholder="€" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('hardware.purchaseDate') }}</label><DatePicker v-model="newPeripheral.purchaseDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
            <div style="flex:1;"><label>{{ $t('hardware.warrantyExpiry') }}</label><DatePicker v-model="newPeripheral.warrantyExpiry" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
          </div>
          <div><label>{{ $t('common.notes') }}</label><Textarea v-model="newPeripheral.notes" rows="2" class="w-full mt-2" /></div>
      </EntityFormDialog>

      <EntityFormDialog
        v-model:visible="showEditDialog"
        :header="$t('peripherals.editPeripheral')"
        width="520px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        :disabled="!editPeripheral.categoryId || !editPeripheral.model"
        @save="saveEditPeripheral"
      >
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.category') }} *</label>
              <QuickCreateSelect v-model="editPeripheral.categoryId" :options="categories" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'peripheral' }" class="w-full mt-2" @created="fetchLookups" />
            </div>
            <div style="flex:1;"><label>{{ $t('hardware.manufacturer') }}</label>
              <QuickCreateSelect v-model="editPeripheral.manufacturerId" :options="manufacturers" createEndpoint="/manufacturers" :entityLabel="$t('common.manufacturer')" class="w-full mt-2" @created="fetchLookups" />
            </div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('hardware.model') }} *</label><InputText v-model="editPeripheral.model" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('hardware.serialNumber') }}</label><InputText v-model="editPeripheral.serialNumber" class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('common.status') }}</label>
              <QuickCreateSelect v-model="editPeripheral.statusId" :options="translatedStatuses" createEndpoint="/statuses" :entityLabel="$t('common.status')" :extraFields="{ type: 'deployable' }" class="w-full mt-2" @created="fetchLookups" />
            </div>
            <div style="flex:1;"><label>{{ $t('hardware.assignedTo') }}</label><Select v-model="editPeripheral.assignedTo" :options="employeeOptions" optionLabel="label" optionValue="value" filter class="w-full mt-2" /></div>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('hardware.purchaseDate') }}</label><DatePicker v-model="editPeripheral.purchaseDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
            <div style="flex:1;"><label>{{ $t('hardware.warrantyExpiry') }}</label><DatePicker v-model="editPeripheral.warrantyExpiry" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon /></div>
          </div>
          <div><label>{{ $t('common.notes') }}</label><Textarea v-model="editPeripheral.notes" rows="2" class="w-full mt-2" /></div>
      </EntityFormDialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingItem?.model }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deletePeripheral" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Peripheral" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

