<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import PaginationBar from '../components/PaginationBar.vue'
import { usePagination } from '../composables/usePagination'
import { useSanitization } from '../composables/useSanitization'
import Button from 'primevue/button'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager

interface Employee {
  _id: string
  firstName: string
  lastName: string
  email: string
  departmentId?: { _id: string; name: string } | null
}

interface HardwareItem {
  _id: string
  serialNumber: string
  model: string
  manufacturerId?: { _id: string; name: string } | string
  categoryId?: { _id: string; name: string } | string
  status?: string
}

interface Category {
  _id: string
  name: string
  entityType: string
}

interface Assignment {
  _id: string
  employeeId: Employee | null
  hardware: HardwareItem[]
  peripherals: { _id: string; model: string; type: string }[]
  assignmentDate: string
  status: 'active' | 'pendingReturn' | 'returned'
  acknowledgedAt?: string
  returnRequestedAt?: string
  returnedAt?: string
  returnCondition?: string
  notes?: string
  createdAt: string
}

const assignments = ref<Assignment[]>([])
const employees = ref<Employee[]>([])
const availableHardware = ref<HardwareItem[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const showCreateDialog = ref(false)
const selectedCategory = ref<string | null>(null)
const showReturnDialog = ref(false)
const showCompleteReturnDialog = ref(false)
const deleteDialog = ref(false)
const saving = ref(false)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const newAssignment = ref({
  employeeId: '' as string,
  hardware: [] as string[],
  peripherals: [] as string[],
  assignmentDate: new Date() as Date | null,
  notes: ''
})

const returningAssignment = ref<Assignment | null>(null)
const returnCondition = ref<'good' | 'fair' | 'damaged'>('good')
const deletingItem = ref<Assignment | null>(null)

const statusSev: Record<string, string> = {
  active: 'success',
  pendingReturn: 'warn',
  returned: 'secondary'
}
const statusLabel = computed(() => ({
  active: t('assignments.statusActive'),
  pendingReturn: t('assignments.statusPendingReturn'),
  returned: t('assignments.statusReturned')
}))
const conditionOptions = [
  { label: t('assignments.conditionGood'), value: 'good' },
  { label: t('assignments.conditionFair'), value: 'fair' },
  { label: t('assignments.conditionDamaged'), value: 'damaged' }
]

const assignmentColumns: ColumnDef[] = [
  { key: 'employee', label: t('common.employee'), default: true, format: 'employee' },
  { key: 'department', label: t('common.department'), default: true },
  { key: 'hardware', label: t('common.hardware'), default: true },
  { key: 'peripherals', label: t('peripherals.title'), default: false },
  { key: 'assignmentDate', label: t('assignments.assignmentDate'), default: true, format: 'date' },
  { key: 'status', label: t('common.status'), default: true, format: 'tag' },
  { key: 'acknowledgedAt', label: t('assignments.acknowledged'), default: false, format: 'date' },
  { key: 'returnCondition', label: t('assignments.condition'), default: false },
  { key: 'notes', label: t('common.notes'), default: false },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('assignments-v2', assignmentColumns)

const filtered = computed(() => {
  let data = assignments.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    data = data.filter(a => {
      const empName = a.employeeId ? `${a.employeeId.firstName} ${a.employeeId.lastName}`.toLowerCase() : ''
      const hwNames = a.hardware.map(h => `${typeof h.manufacturerId === 'object' && h.manufacturerId ? h.manufacturerId.name : ''} ${h.model} ${h.serialNumber}`.toLowerCase()).join(' ')
      return empName.includes(q) || hwNames.includes(q) || a.status.includes(q)
    })
  }
  return data
})

const { sortKey, sortDir, toggleSort, sorted: sortedAssignments } = useTableSort(filtered, assignmentColumns, getCellValue)
const { paginatedItems, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedAssignments, 25)
watch([searchQuery], () => resetPage())

const employeeOptions = computed(() =>
  employees.value.map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
)

const categoryOptions = computed(() =>
  categories.value.map(c => ({ label: c.name, value: c._id }))
)

function getHardwareLabel(h: HardwareItem): string {
  const mfrName = typeof h.manufacturerId === 'object' && h.manufacturerId ? h.manufacturerId.name : ''
  const model = h.model || ''
  const prefix = mfrName && !model.toLowerCase().includes(mfrName.toLowerCase()) ? `${mfrName} ` : ''
  return `${prefix}${model} (${h.serialNumber || 'N/A'})`
}

const hardwareOptions = computed(() => {
  let hw = availableHardware.value.filter(h => !h.status || h.status === 'available')
  if (selectedCategory.value) {
    hw = hw.filter(h => {
      const catId = typeof h.categoryId === 'object' && h.categoryId ? h.categoryId._id : h.categoryId
      return catId === selectedCategory.value
    })
  }
  return hw.map(h => ({ label: getHardwareLabel(h), value: h._id }))
})

function getCellValue(item: Assignment, key: string): string {
  switch (key) {
    case 'employee':
      return item.employeeId ? `${item.employeeId.firstName} ${item.employeeId.lastName}` : '—'
    case 'department':
      return item.employeeId?.departmentId?.name || '—'
    case 'hardware':
      return item.hardware.map(h => getHardwareLabel(h).replace(/ \(.*\)$/, '')).join(', ') || '—'
    case 'peripherals':
      return item.peripherals?.map(p => {
        const { getRelatedName } = useSanitization()
        const catName = getRelatedName(p.categoryId)
        return `${catName}: ${p.model}`
      }).join(', ') || '—'
    case 'assignmentDate':
      return new Date(item.assignmentDate).toLocaleDateString('de-DE')
    case 'acknowledgedAt':
      return item.acknowledgedAt ? new Date(item.acknowledgedAt).toLocaleDateString('de-DE') : '—'
    case 'returnCondition':
      return item.returnCondition || '—'
    case 'notes':
      return item.notes || '—'
    default:
      return '—'
  }
}

async function fetchAssignments() {
  loading.value = true; error.value = null
  try {
    const [assignRes, empRes, hwRes, catRes] = await Promise.all([
      api.get<Assignment[]>('/assignments'),
      api.get<Employee[]>('/employees'),
      api.get<HardwareItem[]>('/hardware?status=available'),
      api.get<Category[]>('/categories')
    ])
    assignments.value = assignRes.data
    employees.value = empRes.data
    availableHardware.value = hwRes.data
    categories.value = (catRes.data || []).filter((c: Category) => c.entityType === 'hardware')
  } catch {
    error.value = t('assignments.loadError')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  newAssignment.value = { employeeId: '', hardware: [], peripherals: [], assignmentDate: new Date(), notes: '' }
  selectedCategory.value = null
  showCreateDialog.value = true
}

async function createAssignment() {
  if (!newAssignment.value.employeeId || newAssignment.value.hardware.length === 0) return
  saving.value = true; error.value = null
  try {
    const payload: Record<string, unknown> = {
      employeeId: newAssignment.value.employeeId,
      hardware: newAssignment.value.hardware,
      notes: newAssignment.value.notes || undefined
    }
    if (newAssignment.value.assignmentDate) {
      payload.assignmentDate = (newAssignment.value.assignmentDate as Date).toISOString()
    }
    await api.post('/assignments', payload)
    showCreateDialog.value = false
    await fetchAssignments()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('assignments.createError'))
  } finally {
    saving.value = false
  }
}

function openReturn(item: Assignment) {
  returningAssignment.value = item
  if (item.status === 'active') {
    showReturnDialog.value = true
  } else if (item.status === 'pendingReturn') {
    returnCondition.value = 'good'
    showCompleteReturnDialog.value = true
  }
}

async function requestReturn() {
  if (!returningAssignment.value) return
  saving.value = true
  try {
    await api.post(`/assignments/${returningAssignment.value._id}/return`, { notes: '' })
    showReturnDialog.value = false
    await fetchAssignments()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('assignments.returnError'))
  } finally {
    saving.value = false
  }
}

async function completeReturn() {
  if (!returningAssignment.value) return
  saving.value = true
  try {
    await api.post(`/assignments/${returningAssignment.value._id}/complete-return`, {
      returnCondition: returnCondition.value
    })
    showCompleteReturnDialog.value = false
    await fetchAssignments()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('assignments.returnError'))
  } finally {
    saving.value = false
  }
}

function confirmDelete(item: Assignment) {
  deletingItem.value = item
  deleteDialog.value = true
}

async function deleteAssignment() {
  if (!deletingItem.value) return
  try {
    await api.delete(`/assignments/${deletingItem.value._id}`)
    deleteDialog.value = false
    deletingItem.value = null
    await fetchAssignments()
  } catch (err: unknown) {
    error.value = extractApiError(err, t('assignments.deleteError'))
  }
}

onMounted(fetchAssignments)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing:-0.02em;">{{ $t('assignments.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ $t('assignments.subtitle') }}</p>
        </div>
        <div class="flex gap-2 align-items-center">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('assignments.newAssignment')" @click="openCreate" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('assignments.searchPlaceholder')" class="an-search-input" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <template v-for="col in visibleColumns" :key="col.key">
                <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
                <th v-else style="text-align:right;width:60px;"><i class="pi pi-cog" v-tooltip.top="$t('common.actions')"></i></th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">
              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;" :data-label="$t('common.actions')">
                <Button
                  v-if="item.status === 'active' && isManager"
                  icon="pi pi-undo" size="small" text severity="warn"
                  v-tooltip.top="$t('assignments.requestReturn')"
                  @click="openReturn(item)" class="mr-1"
                />
                <Button
                  v-if="item.status === 'pendingReturn' && isManager"
                  icon="pi pi-check-circle" size="small" text severity="success"
                  v-tooltip.top="$t('assignments.completeReturn')"
                  @click="openReturn(item)" class="mr-1"
                />
                <Button icon="pi pi-history" size="small" text severity="secondary"
                  @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button
                  v-if="item.status !== 'returned' && isAdmin"
                  icon="pi pi-trash" size="small" text severity="danger"
                  @click="confirmDelete(item)"
                />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'employee'">
                  <span class="font-bold">{{ getCellValue(item, 'employee') }}</span>
                </template>
                <template v-else-if="col.key === 'status'">
                  <Tag :value="statusLabel[item.status] || item.status" :severity="(statusSev[item.status] as any) || 'secondary'" />
                </template>
                <template v-else-if="col.key === 'hardware'">
                  <div class="flex flex-column gap-1">
                    <div v-for="hw in item.hardware" :key="hw._id" class="hw-chip">
                      {{ getHardwareLabel(hw).replace(/ \(.*\)$/, '') }}
                      <span style="color:var(--an-text-muted);font-size:12px;margin-left:4px;">({{ hw.serialNumber }})</span>
                    </div>
                  </div>
                  <span v-if="item.hardware.length === 0" style="color:var(--an-text-muted);">—</span>
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="filtered.length === 0">
              <td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td>
            </tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <Dialog v-model:visible="showCreateDialog" :header="$t('assignments.newAssignment')" :style="{width:'600px'}" modal>
        <div class="flex flex-column gap-3">
          <div>
            <label>{{ $t('common.employee') }}</label>
            <Select v-model="newAssignment.employeeId" :options="employeeOptions" optionLabel="label" optionValue="value" :placeholder="$t('common.selectEmployee')" filter class="w-full mt-2" />
          </div>
          <div class="grid">
            <div class="col-12 md:col-4">
              <label>{{ $t('common.category') }}</label>
              <Select v-model="selectedCategory" :options="categoryOptions" optionLabel="label" optionValue="value" :placeholder="$t('common.allCategories')" showClear class="w-full mt-2" />
            </div>
            <div class="col-12 md:col-8">
              <label>{{ $t('common.hardware') }}</label>
              <MultiSelect v-model="newAssignment.hardware" :options="hardwareOptions" optionLabel="label" optionValue="value" :placeholder="$t('assignments.selectHardware')" filter display="chip" class="w-full mt-2" />
            </div>
          </div>
          <div>
            <label>{{ $t('assignments.assignmentDate') }}</label>
            <DatePicker v-model="newAssignment.assignmentDate" dateFormat="dd.mm.yy" class="w-full mt-2" showIcon />
          </div>
          <div>
            <label>{{ $t('common.notes') }}</label>
            <Textarea v-model="newAssignment.notes" rows="2" class="w-full mt-2" />
          </div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showCreateDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" :disabled="!newAssignment.employeeId || newAssignment.hardware.length === 0" @click="createAssignment" />
        </template>
      </Dialog>

      <Dialog v-model:visible="showReturnDialog" :header="$t('assignments.requestReturn')" :style="{width:'450px'}" modal>
        <p>{{ $t('assignments.requestReturnMessage', { employee: returningAssignment?.employeeId ? `${returningAssignment.employeeId.firstName} ${returningAssignment.employeeId.lastName}` : '' }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showReturnDialog = false" />
          <Button :label="$t('assignments.requestReturn')" severity="warn" :loading="saving" @click="requestReturn" />
        </template>
      </Dialog>

      <Dialog v-model:visible="showCompleteReturnDialog" :header="$t('assignments.completeReturn')" :style="{width:'450px'}" modal>
        <div class="flex flex-column gap-3">
          <p>{{ $t('assignments.completeReturnMessage') }}</p>
          <div>
            <label>{{ $t('assignments.condition') }}</label>
            <Select v-model="returnCondition" :options="conditionOptions" optionLabel="label" optionValue="value" class="w-full mt-2" />
          </div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showCompleteReturnDialog = false" />
          <Button :label="$t('assignments.completeReturn')" severity="success" :loading="saving" @click="completeReturn" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('assignments.deleteConfirmMessage') }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteAssignment" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Assignment" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

<style scoped>

.hw-chip { font-size: 13px; line-height: 1.6; }
</style>
