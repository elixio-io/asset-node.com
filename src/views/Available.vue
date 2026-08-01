<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import type { Hardware } from '../types/hardware'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

interface Employee {
  _id: string
  firstName: string
  lastName: string
  email: string
  department?: string
}

interface PopulatedHardware extends Omit<Hardware, 'assignedTo'> {
  assignedTo?: Employee | null
}

const authStore = useAuthStore()
const canCustomize = authStore.canCustomizeColumns
const availableHardware = ref<PopulatedHardware[]>([])
const employees = ref<Employee[]>([])
const editingId = ref<string | null>(null)
const selectedEmployee = ref<Employee | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const { t } = useI18n()
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const availableColumns: ColumnDef[] = [
  { key: 'serialNumber', label: t('hardware.serialNumber'), default: true },
  { key: 'model', label: t('hardware.model'), default: true },
  { key: 'categoryId', label: t('common.category'), default: true },
  { key: 'manufacturerId', label: t('hardware.manufacturer'), default: true },
  { key: 'purchaseDate', label: t('hardware.purchaseDate'), default: true, format: 'date' },
  { key: 'warrantyExpiry', label: t('hardware.warrantyExpiry'), default: true, format: 'date' },
  { key: 'purchasePrice', label: t('hardware.purchasePrice'), default: false, format: 'currency' },
  { key: 'locationId', label: t('common.location'), default: false },
  { key: 'notes', label: t('common.notes'), default: false },
]

const {
  allColumns: enrichedColumns,
  visibleColumns,
  visibleKeys,
  toggleColumn,
  reorderColumns,
  isVisible,
  resetToDefaults,
} = useTableColumns('available', availableColumns)

const filteredAvailable = computed(() =>
  availableHardware.value
)
const { sortKey, sortDir, toggleSort, sorted: sortedAvailable } = useTableSort(filteredAvailable, availableColumns, (item: any, key: string) => {
  const col = availableColumns.find(c => c.key === key)
  return col ? formatCellValue(item, col) : '—'
})

function formatCellValue(item: PopulatedHardware, col: ColumnDef): string {
  const val = (item as any)[col.key]
  if (val == null) return '—'
  switch (col.format) {
    case 'date': return new Date(val).toLocaleDateString('de-DE')
    case 'currency': return typeof val === 'number' ? `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : String(val)
    default:
      if (['categoryId', 'manufacturerId', 'locationId'].includes(col.key)) {
        if (typeof val === 'object' && val?.name) return val.name
        if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '—'
        return String(val)
      }
      return String(val)
  }
}

async function fetchAvailable() {
  try {
    const [hwResponse, empResponse] = await Promise.all([
      api.get<PopulatedHardware[]>('/hardware?statusSlug=available'),
      api.get<Employee[]>('/employees')
    ])
    availableHardware.value = hwResponse.data
    employees.value = empResponse.data
  } catch (err) {
    error.value = 'Failed to load available hardware'
  } finally {
    loading.value = false
  }
}

function startEditing(item: PopulatedHardware) {
  editingId.value = item._id
  selectedEmployee.value = null
}

async function assignHardware(item: PopulatedHardware) {
  if (!selectedEmployee.value) return
  try {
    await api.put(`/hardware/${item._id}`, {
      assignedTo: selectedEmployee.value._id,
      statusSlug: 'assigned'
    })
    await fetchAvailable()
    editingId.value = null
    selectedEmployee.value = null
  } catch (err) {
    error.value = 'Failed to assign hardware'
  }
}

function cancelEditing() {
  editingId.value = null
  selectedEmployee.value = null
}

function employeeLabel(emp: Employee): string {
  return `${emp.firstName} ${emp.lastName}`
}

onMounted(fetchAvailable)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('available.title') }}</h1>
        </div>
        <ColumnPicker
          v-if="canCustomize"
          :allColumns="enrichedColumns"
          :visibleKeys="visibleKeys"
          :isVisible="isVisible"
          @toggle="toggleColumn"
          @reorder="reorderColumns"
          @reset="resetToDefaults"
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
                <th v-else class="text-center" v-tooltip.top="$t('common.actions')"><i class="pi pi-cog text-lg" style="color: var(--an-text-subtle);"></i></th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sortedAvailable" :key="item._id" class="data-row">
              <template v-if="editingId === item._id">
                <template v-for="col in visibleColumns" :key="col.key">
                <td v-if="col.key === '_actions'">
                  <div class="flex gap-2 align-items-center flex-nowrap">
                    <Select
                      v-model="selectedEmployee"
                      :options="employees"
                      :optionLabel="employeeLabel"
                      :placeholder="$t('common.selectEmployee')"
                      filter
                      class="employee-select"
                    />
                    <Button severity="primary" size="small" :label="$t('common.assign')" :disabled="!selectedEmployee" class="mr-1" @click="assignHardware(item)" />
                    <Button severity="danger" size="small" outlined :label="$t('common.cancel')" @click="cancelEditing" />
                  </div>
                </td>
                <td v-else :data-label="col.label">
                  <template v-if="col.key === 'warrantyExpiry'">
                    <Tag v-if="item.warrantyExpiry" :value="new Date(item.warrantyExpiry!).toLocaleDateString('de-DE')" :severity="new Date(item.warrantyExpiry) > new Date() ? 'success' : 'danger'" />
                    <span v-else>-</span>
                  </template>
                  <span v-else>{{ formatCellValue(item, col) }}</span>
                </td>
                </template>
              </template>
              <template v-else>
                <template v-for="col in visibleColumns" :key="col.key">
                <td v-if="col.key === '_actions'" class="text-center" style="white-space:nowrap;">
                  <Button severity="primary" size="small" outlined icon="pi pi-user-plus" :label="$t('common.assign')" @click="startEditing(item)" class="mr-1" />
                  <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" />
                </td>
                <td v-else :data-label="col.label">
                  <template v-if="col.key === 'warrantyExpiry'">
                    <Tag v-if="item.warrantyExpiry" :value="new Date(item.warrantyExpiry!).toLocaleDateString('de-DE')" :severity="new Date(item.warrantyExpiry) > new Date() ? 'success' : 'danger'" />
                    <span v-else>-</span>
                  </template>
                  <span v-else>{{ formatCellValue(item, col) }}</span>
                </td>
                </template>
              </template>
            </tr>
            <tr v-if="availableHardware.length === 0">
              <td :colspan="visibleColumns.length" class="text-center p-4" style="color: var(--an-text-muted);">{{ $t('available.noAssetsFound') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
      <ChangeHistory v-if="historyEntityId" entityType="Hardware" :entityId="historyEntityId" />
    </Dialog>
  </div>
</template>

<style scoped>

.employee-select { min-width: 200px; }
</style>
