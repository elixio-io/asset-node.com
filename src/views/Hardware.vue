<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import type { Hardware, NamedRef } from '../types/hardware'
import { useStatusTranslation, useCategoryTranslation } from '../composables/useEntityTranslation'
import { useTableColumns } from '../composables/useTableColumns'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import PaginationBar from '../components/PaginationBar.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'
import { usePagination } from '../composables/usePagination'
import { useTableSort } from '../composables/useTableSort'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'
import EntityFormDialog from '../components/EntityFormDialog.vue'

const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager
const canCustomize = authStore.canCustomizeColumns

const hardware = ref<Hardware[]>([])
const employees = ref<any[]>([])
const categories = ref<NamedRef[]>([])
const statuses = ref<NamedRef[]>([])
const manufacturers = ref<NamedRef[]>([])
const locations = ref<NamedRef[]>([])
const departments = ref<NamedRef[]>([])
const suppliers = ref<NamedRef[]>([])
const knownModels = ref<string[]>([])
const filteredModels = ref<string[]>([])
const editingId = ref<string | null>(null)
const editingItem = reactive<Record<string, any>>({})
const loading = ref(true)
const error = ref<string | null>(null)
const deleteConfirmDialog = ref(false)
const deleteTargetId = ref<string | null>(null)
const deleteTargetName = ref('')
const { t } = useI18n()
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const showAddDialog = ref(false)
const newHw = reactive({
  model: '',
  serialNumber: '',
  assetTag: '',
  categoryId: '',
  statusId: '',
  manufacturerId: '',
  locationId: '',
  purchaseDate: new Date() as Date | null,
  purchasePrice: null as number | null,
  notes: ''
})

const filterCategory = ref<string>('')
const filterStatus = ref<string>('')
const searchQuery = ref<string>('')


const { translateStatusName, getStatusSeverity, translatedStatuses: makeTranslatedStatuses } = useStatusTranslation()
const translatedStatuses = makeTranslatedStatuses(statuses)

const { translateCategoryName, translatedCategories: makeTranslatedCategories } = useCategoryTranslation()
const translatedCategories = makeTranslatedCategories(categories)

function getItemStatusSeverity(item: Hardware): string {
  const status = item.statusId
  if (typeof status === 'object' && status !== null) return getStatusSeverity(status as any)
  return 'secondary'
}

const categoryOptions = computed(() => [
  { label: t('hardware.allCategories'), value: '' },
  ...translatedCategories.value.map((c: NamedRef) => ({ label: c.name, value: c._id }))
])

const statusOptions = computed(() => [
  { label: t('hardware.allStatuses'), value: '' },
  ...translatedStatuses.value.map(s => ({ label: s.name, value: s._id }))
])

const hardwareColumns: ColumnDef[] = [
  { key: 'assetTag', label: t('hardware.assetTag'), default: true },
  { key: 'serialNumber', label: t('hardware.serialNumber'), default: true },
  { key: 'model', label: t('hardware.model'), default: true },
  { key: 'categoryId', label: t('hardware.category'), default: true, format: 'tag' },
  { key: 'manufacturerId', label: t('hardware.manufacturer'), default: true },
  { key: 'statusId', label: t('hardware.status'), default: true, format: 'tag' },
  { key: 'purchaseDate', label: t('hardware.purchaseDate'), default: true, format: 'date' },
  { key: 'purchasePrice', label: t('hardware.purchasePrice'), default: false, format: 'currency' },
  { key: 'warrantyExpiry', label: t('hardware.warrantyExpiry'), default: false, format: 'date' },
  { key: 'endOfLife', label: t('hardware.endOfLife'), default: false, format: 'date' },
  { key: 'locationId', label: t('hardware.location'), default: true },
  { key: 'assignedTo', label: t('hardware.assignedTo'), default: true, format: 'employee' },
  { key: 'notes', label: t('hardware.notes'), default: false, },
  { key: 'tags', label: t('hardware.tags'), default: false, },
  { key: 'createdAt', label: t('hardware.createdAt'), default: false, format: 'date' },
  { key: 'updatedAt', label: t('hardware.updatedAt'), default: false, format: 'date' },
]

const {
  allColumns: enrichedColumns,
  visibleColumns,
  visibleKeys,
  toggleColumn,
  reorderColumns,
  isVisible,
  resetToDefaults,
} = useTableColumns('hardware', hardwareColumns)

const { sortKey, sortDir, toggleSort, sorted: sortedHardware } = useTableSort(hardware, hardwareColumns, (item: any, key: string) => {
  const col = hardwareColumns.find(c => c.key === key)
  return col ? formatCellValue(item, col) : '—'
})

const { paginatedItems, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedHardware, 25)
watch([searchQuery, filterCategory, filterStatus], () => resetPage())


function refName(val: any): string {
  if (val == null) return '—'
  if (typeof val === 'object' && val.name) return val.name
  if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '—'
  return String(val)
}

function formatCellValue(item: any, col: ColumnDef): string {
  const val = item[col.key]
  if (val == null) return '—'

  if (col.key === 'statusId' && typeof val === 'object' && val?.slug) {
    return translateStatusName(val)
  }
  if (col.key === 'categoryId' && typeof val === 'object') {
    return translateCategoryName(val)
  }
  if (['manufacturerId', 'statusId', 'locationId', 'departmentId', 'supplierId'].includes(col.key)) {
    return refName(val)
  }

  switch (col.format) {
    case 'date':
      return new Date(val).toLocaleDateString('de-DE')
    case 'employee':
      if (typeof val === 'object' && val.firstName) {
        return `${val.firstName} ${val.lastName}`
      }
      if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '—'
      return String(val)
    case 'currency':
      return typeof val === 'number' ? `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : String(val)
    default:
      if (Array.isArray(val)) return val.join(', ')
      return String(val)
  }
}

function employeeLabel(emp: any): string {
  return `${emp.firstName} ${emp.lastName} (${emp.email})`
}

async function fetchHardware() {
  try {
    const params = new URLSearchParams()
    if (filterCategory.value) params.set('categoryId', filterCategory.value)
    if (filterStatus.value) params.set('statusId', filterStatus.value)
    if (searchQuery.value) params.set('search', searchQuery.value)
    const query = params.toString()
    const response = await api.get(`/hardware${query ? `?${query}` : ''}`)
    hardware.value = response.data
  } catch (err) {
    error.value = 'Failed to load hardware'
  } finally {
    loading.value = false
  }
}

async function fetchLookups() {
  try {
    const [catRes, statRes, mfgRes, locRes, deptRes, supRes, empRes, modelRes] = await Promise.all([
      api.get('/categories', { params: { entityType: 'hardware' } }),
      api.get('/statuses'),
      api.get('/manufacturers'),
      api.get('/locations'),
      api.get('/departments'),
      api.get('/suppliers'),
      api.get('/employees'),
      api.get('/hardware/models/distinct')
    ])
    categories.value = catRes.data
    statuses.value = statRes.data
    manufacturers.value = mfgRes.data
    locations.value = locRes.data
    departments.value = deptRes.data
    suppliers.value = supRes.data
    employees.value = empRes.data
    knownModels.value = modelRes.data
  } catch {  }
}

function searchModels(event: { query: string }) {
  const q = event.query.toLowerCase()
  filteredModels.value = knownModels.value.filter(m => m.toLowerCase().includes(q))
}


function fkId(val: any): string | null {
  if (val == null) return null
  if (typeof val === 'object' && val._id) return val._id
  return String(val)
}

const editDialogVisible = ref(false)

function startEditing(item: Hardware) {
  editingId.value = item._id
  editingItem.serialNumber = item.serialNumber || ''
  editingItem.model = item.model
  editingItem.categoryId = fkId(item.categoryId)
  editingItem.manufacturerId = fkId(item.manufacturerId)
  editingItem.statusId = fkId(item.statusId)
  editingItem.purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : null
  editingItem.purchasePrice = item.purchasePrice
  editingItem.locationId = fkId(item.locationId)
  editingItem.assignedTo = typeof item.assignedTo === 'object' && item.assignedTo?._id
    ? item.assignedTo._id
    : item.assignedTo
  editingItem.notes = item.notes

  editDialogVisible.value = true
}

function cancelEditing() {
  editingId.value = null
  Object.keys(editingItem).forEach(key => delete editingItem[key])
  editDialogVisible.value = false
}

const resolveAssignmentPromptVisible = ref(false)
const resolveAssignmentAction = ref<string>('return_available')
const resolveAssignmentNotes = ref<string>('')
const pendingSaveItem = ref<Hardware | null>(null)

async function saveChanges(item: Hardware | { _id: string }, resolvePayload?: any) {
  try {
    const payload = { ...editingItem }
    if (resolvePayload) {
      payload.resolveAssignment = resolvePayload
    }
    await api.put(`/hardware/${item._id}`, payload)
    await fetchHardware()
    editingId.value = null
    editDialogVisible.value = false
    resolveAssignmentPromptVisible.value = false
    pendingSaveItem.value = null
  } catch (err: any) {
    if (err.response?.status === 409 && err.response?.data?.requiresResolution) {
      pendingSaveItem.value = item
      resolveAssignmentAction.value = 'return_available'
      resolveAssignmentNotes.value = ''
      resolveAssignmentPromptVisible.value = true
    } else {
      error.value = extractApiError(err, 'Failed to update hardware')
    }
  }
}

function confirmResolveAssignment() {
  if (!pendingSaveItem.value) return
  let actionStr = 'return'
  let conditionStr = 'good'
  if (resolveAssignmentAction.value === 'return_available') {
    actionStr = 'return'
    conditionStr = 'good'
  } else if (resolveAssignmentAction.value === 'return_defective') {
    actionStr = 'return'
    conditionStr = 'damaged'
  } else if (resolveAssignmentAction.value === 'unassign') {
    actionStr = 'unassign'
  }

  saveChanges(pendingSaveItem.value, {
    action: actionStr,
    returnCondition: conditionStr,
    notes: resolveAssignmentNotes.value
  })
}

function addNewHardware() {
  Object.assign(newHw, {
    model: '',
    serialNumber: '',
    assetTag: '',
    categoryId: categories.value[0]?._id || '',
    statusId: statuses.value[0]?._id || '',
    manufacturerId: manufacturers.value[0]?._id || '',
    locationId: '',
    purchaseDate: new Date(),
    purchasePrice: null,
    notes: ''
  })
  showAddDialog.value = true
}

async function submitNewHardware() {
  if (!newHw.categoryId || !newHw.statusId || !newHw.manufacturerId) {
    error.value = t('hardware.missingLookups')
    return
  }
  try {
    const payload: Record<string, any> = {
      model: newHw.model || 'New Asset',
      categoryId: newHw.categoryId,
      statusId: newHw.statusId,
      manufacturerId: newHw.manufacturerId,
      purchaseDate: newHw.purchaseDate ? (newHw.purchaseDate as Date).toISOString() : new Date().toISOString()
    }
    if (newHw.serialNumber) payload.serialNumber = newHw.serialNumber
    if (newHw.assetTag) payload.assetTag = newHw.assetTag
    if (newHw.locationId) payload.locationId = newHw.locationId
    if (newHw.purchasePrice != null) payload.purchasePrice = newHw.purchasePrice
    if (newHw.notes) payload.notes = newHw.notes

    await api.post('/hardware', payload)
    showAddDialog.value = false
    await fetchHardware()
  } catch (err) {
    error.value = extractApiError(err, 'Failed to create new hardware')
  }
}

function promptDelete(item: Hardware) {
  deleteTargetId.value = item._id
  const mfgName = refName(item.manufacturerId)
  deleteTargetName.value = `${mfgName} ${item.model} (${item.serialNumber || item.assetTag || ''})`
  deleteConfirmDialog.value = true
}

async function confirmDelete() {
  if (!deleteTargetId.value) return
  try {
    await api.delete(`/hardware/${deleteTargetId.value}`)
    deleteConfirmDialog.value = false
    deleteTargetId.value = null
    await fetchHardware()
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to delete hardware')
  }
}

onMounted(() => {
  fetchLookups()
  fetchHardware()
})
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">
        {{ error }}
      </Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing: -0.02em;">{{ $t('hardware.assetInventory') }}</h1>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">{{ $t('hardware.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker
            :allColumns="enrichedColumns"
            :visibleKeys="visibleKeys"
            :isVisible="isVisible"
            @toggle="toggleColumn"
            @reorder="reorderColumns"
            @reset="resetToDefaults"
          />
          <Button
            v-if="isManager"
            severity="primary"
            icon="pi pi-plus"
            :label="$t('hardware.addAsset')"
            class="btn-glow-primary"
            @click="addNewHardware"
          />
        </div>
      </div>

      <div class="filter-bar surface-card">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText
            v-model="searchQuery"
            :placeholder="$t('hardware.searchPlaceholder')"
            class="an-search-input"
            @update:model-value="fetchHardware"
          />
        </div>
        <Select
          v-model="filterCategory"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="$t('common.allCategories')"
          @update:model-value="fetchHardware"
          style="max-width: 200px;"
        />
        <Select
          v-model="filterStatus"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="$t('common.allStatuses')"
          @update:model-value="fetchHardware"
          style="max-width: 200px;"
        />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
      </div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <template v-for="col in visibleColumns" :key="col.key">
                <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
                <th v-else style="width: 100px; text-align: right;" v-tooltip.top="$t('common.actions')">
                  <i class="pi pi-cog text-lg" style="color: var(--an-text-subtle);"></i>
                </th>
              </template>
            </tr>

          </thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">
              <td v-if="col.key === '_actions'" class="actions-cell" :data-label="$t('common.actions')">
                <Button v-if="isManager" icon="pi pi-pencil" text rounded size="small" @click="startEditing(item)" class="mr-1" />
                <Button icon="pi pi-history" text rounded size="small" severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" text rounded size="small" severity="danger" @click="promptDelete(item)" />
              </td>
              <td v-else :data-label="col.label" :class="{ 'font-bold': col.key === 'assetTag' || col.key === 'serialNumber' }">
                <Tag
                  v-if="col.key === 'statusId'"
                  :value="(item as any)[col.key]?.slug ? translateStatusName((item as any)[col.key]) : refName((item as any)[col.key])"
                  :severity="getItemStatusSeverity(item)"
                />
                <span v-else>{{ formatCellValue(item, col) }}</span>
              </td>
              </template>
            </tr>
            <tr v-if="hardware.length === 0">
              <td :colspan="visibleColumns.length" class="text-center p-5" style="color: var(--an-text-muted);">
                <i class="pi pi-box" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>
                {{ $t('common.noResults') }}
              </td>
            </tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <Dialog v-model:visible="deleteConfirmDialog" :header="$t('common.confirmDelete')" :style="{ width: '450px' }" modal>
        <p>{{ $t('common.deleteConfirmText', { name: deleteTargetName }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteConfirmDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="confirmDelete" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Hardware" :entityId="historyEntityId" />
      </Dialog>

      <EntityFormDialog
        v-model:visible="showAddDialog"
        :header="$t('hardware.addAsset')"
        :saveLabel="$t('hardware.addAsset')"
        saveIcon="pi pi-plus"
        :disabled="!newHw.categoryId || !newHw.statusId || !newHw.manufacturerId"
        @save="submitNewHardware"
      >
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.model') }} *</label>
              <AutoComplete
                v-model="newHw.model"
                :suggestions="filteredModels"
                @complete="searchModels"
                :dropdown="true"
                class="w-full"
                :placeholder="$t('common.model')"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.serialNumber') }}</label>
              <InputText v-model="newHw.serialNumber" class="w-full" :placeholder="$t('hardware.serialNumber')" />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.category') }} *</label>
              <QuickCreateSelect
                v-model="newHw.categoryId"
                :options="categories"
                createEndpoint="/categories"
                :entityLabel="$t('common.category')"
                :extraFields="{ entityType: 'hardware' }"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.status') }} *</label>
              <QuickCreateSelect
                v-model="newHw.statusId"
                :options="translatedStatuses"
                createEndpoint="/statuses"
                :entityLabel="$t('common.status')"
                :extraFields="{ type: 'deployable' }"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.manufacturer') }} *</label>
              <QuickCreateSelect
                v-model="newHw.manufacturerId"
                :options="manufacturers"
                createEndpoint="/manufacturers"
                :entityLabel="$t('common.manufacturer')"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.location') }}</label>
              <QuickCreateSelect
                v-model="newHw.locationId"
                :options="locations"
                createEndpoint="/locations"
                :entityLabel="$t('hardware.location')"
                class="w-full"
                showClear
                @created="fetchLookups"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.purchaseDate') }}</label>
              <DatePicker v-model="newHw.purchaseDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.purchasePrice') }}</label>
              <InputNumber v-model="newHw.purchasePrice" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.notes') }}</label>
            <InputText v-model="newHw.notes" class="w-full" :placeholder="$t('common.notes')" />
          </div>
      </EntityFormDialog>

      <EntityFormDialog
        v-model:visible="editDialogVisible"
        :header="$t('hardware.editAsset', 'Edit Asset')"
        :disabled="!editingItem.categoryId || !editingItem.statusId || !editingItem.manufacturerId"
        @save="saveChanges({ _id: editingId })"
        @hide="cancelEditing"
        @cancel="cancelEditing"
      >
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.model') }} *</label>
              <AutoComplete
                v-model="editingItem.model"
                :suggestions="filteredModels"
                @complete="searchModels"
                :dropdown="true"
                class="w-full"
                :placeholder="$t('common.model')"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.serialNumber') }}</label>
              <InputText v-model="editingItem.serialNumber" class="w-full" :placeholder="$t('hardware.serialNumber')" />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.category') }} *</label>
              <QuickCreateSelect
                v-model="editingItem.categoryId"
                :options="categories"
                createEndpoint="/categories"
                :entityLabel="$t('common.category')"
                :extraFields="{ entityType: 'hardware' }"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.status') }} *</label>
              <QuickCreateSelect
                v-model="editingItem.statusId"
                :options="translatedStatuses"
                createEndpoint="/statuses"
                :entityLabel="$t('common.status')"
                :extraFields="{ type: 'deployable' }"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.manufacturer') }} *</label>
              <QuickCreateSelect
                v-model="editingItem.manufacturerId"
                :options="manufacturers"
                createEndpoint="/manufacturers"
                :entityLabel="$t('common.manufacturer')"
                class="w-full"
                @created="fetchLookups"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.location') }}</label>
              <QuickCreateSelect
                v-model="editingItem.locationId"
                :options="locations"
                createEndpoint="/locations"
                :entityLabel="$t('hardware.location')"
                class="w-full"
                showClear
                @created="fetchLookups"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.purchaseDate') }}</label>
              <DatePicker v-model="editingItem.purchaseDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.purchasePrice') }}</label>
              <InputNumber v-model="editingItem.purchasePrice" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="0.00" />
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('hardware.assignedTo', 'Assigned To') }}</label>
              <Select
                v-model="editingItem.assignedTo"
                :options="employees"
                :optionLabel="employeeLabel"
                optionValue="_id"
                :placeholder="$t('common.selectEmployee')"
                filter
                showClear
                class="w-full"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1 font-semibold" style="font-size:13px;">{{ $t('common.notes') }}</label>
              <InputText v-model="editingItem.notes" class="w-full" :placeholder="$t('common.notes')" />
            </div>
          </div>
      </EntityFormDialog>

      <Dialog v-model:visible="resolveAssignmentPromptVisible" header="Active Assignment Detected" :style="{ width: '500px' }" modal>
        <p class="mb-4">
          This device is currently part of an active assignment. By removing the assignee, you are modifying an assigned device. What would you like to do with the assignment?
        </p>

        <div class="flex flex-column gap-3 mb-4">
          <div class="flex align-items-center">
            <input type="radio" id="res_avail" value="return_available" v-model="resolveAssignmentAction" class="mr-2" />
            <label for="res_avail" class="font-medium">Return Device &amp; Mark as Available</label>
          </div>
          <div class="flex align-items-center">
            <input type="radio" id="res_def" value="return_defective" v-model="resolveAssignmentAction" class="mr-2" />
            <label for="res_def" class="font-medium">Return Device &amp; Mark as Defective</label>
          </div>
          <div class="flex align-items-center">
            <input type="radio" id="res_unassign" value="unassign" v-model="resolveAssignmentAction" class="mr-2" />
            <label for="res_unassign" class="font-medium">Just Unassign (Advanced - Leaves Assignment Active)</label>
          </div>
        </div>

        <div v-if="resolveAssignmentAction !== 'unassign'" class="flex flex-column gap-2">
          <label class="font-medium text-sm">Return Notes (Optional)</label>
          <InputText v-model="resolveAssignmentNotes" placeholder="Condition details, etc." class="w-full" />
        </div>

        <template #footer>
          <Button label="Cancel" text @click="resolveAssignmentPromptVisible = false" />
          <Button label="Confirm Action" severity="primary" @click="confirmResolveAssignment" />
        </template>
      </Dialog>
    </div>
  </div>
</template>
