<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'

const { t } = useI18n()

interface Dept {
  _id: string; name: string
  managerId?: { _id: string; firstName: string; lastName: string; email: string } | null
  locationId?: { _id: string; name: string; address?: string } | null
  description?: string
}

const departments = ref<Dept[]>([])
const employees = ref<{ _id: string; firstName: string; lastName: string; email: string }[]>([])
const locations = ref<{ _id: string; name: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialog = ref(false)
const editing = ref<Dept | null>(null)
const form = ref({ name: '', managerId: null as string | null, locationId: null as string | null, description: '' })
const deleteDialog = ref(false)
const deletingItem = ref<Dept | null>(null)

const employeeOptions = ref<{ label: string; value: string }[]>([])
const locationOptions = ref<{ label: string; value: string }[]>([])

async function load() {
  loading.value = true
  try {
    const [deptRes, empRes, locRes] = await Promise.all([api.get('/departments'), api.get('/employees'), api.get('/locations')])
    departments.value = deptRes.data
    const emps = Array.isArray(empRes.data) ? empRes.data : empRes.data.employees || []
    employees.value = emps
    employeeOptions.value = emps.map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
    locations.value = locRes.data
    locationOptions.value = locRes.data.map((l: any) => ({ label: l.name, value: l._id }))
  } catch { error.value = 'Failed to load departments' }
  finally { loading.value = false }
}

function openCreate() { editing.value = null; form.value = { name: '', managerId: null, locationId: null, description: '' }; dialog.value = true }
function openEdit(dept: Dept) {
  editing.value = dept
  form.value = { name: dept.name, managerId: dept.managerId?._id || null, locationId: dept.locationId?._id || null, description: dept.description || '' }
  dialog.value = true
}

async function save() {
  try {
    if (editing.value) { await api.put(`/departments/${editing.value._id}`, form.value) }
    else { await api.post('/departments', form.value) }
    dialog.value = false; await load()
  } catch (err: any) { error.value = err?.response?.data?.error || 'Save failed' }
}

function confirmDelete(item: Dept) { deletingItem.value = item; deleteDialog.value = true }
async function remove() {
  if (!deletingItem.value) return
  try { await api.delete(`/departments/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await load() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Delete failed' }
}

const departmentColumns: ColumnDef[] = [
  { key: 'name', label: t('common.name'), default: true },
  { key: 'managerId', label: t('departments.manager'), default: true },
  { key: 'locationId', label: t('departments.location'), default: true },
  { key: 'description', label: t('common.description'), default: true },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('departments', departmentColumns)

function getCellValue(item: Dept, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'managerId': return item.managerId ? `${item.managerId.firstName} ${item.managerId.lastName}` : '—'
    case 'locationId': return item.locationId?.name || '—'
    case 'description': return item.description || '—'
    default: return '—'
  }
}

const filteredDepartments = computed(() =>
  departments.value
)
const { sortKey, sortDir, toggleSort, sorted: sortedDepts } = useTableSort(filteredDepartments, departmentColumns, getCellValue)

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('departments.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('departments.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button severity="primary" icon="pi pi-plus" :label="$t('departments.addDepartment')" @click="openCreate" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead><tr>
            <template v-for="col in visibleColumns" :key="col.key">

              <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />

              <th v-else style="text-align: right;">{{ $t('common.actions') }}</th>

            </template>
          </tr>
          </thead>
          <tbody>
            <tr v-for="dept in sortedDepts" :key="dept._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align: right;">
                <Button icon="pi pi-pencil" size="small" text rounded @click="openEdit(dept)" />
                <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = dept._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(dept)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'"><span class="font-bold">{{ dept.name }}</span></template>
                <template v-else-if="col.key === 'managerId'">
                  <template v-if="dept.managerId"><i class="pi pi-user mr-1"></i>{{ dept.managerId.firstName }} {{ dept.managerId.lastName }}</template>
                  <span v-else style="color: var(--an-text-muted);">—</span>
                </template>
                <template v-else-if="col.key === 'locationId'">
                  <template v-if="dept.locationId"><i class="pi pi-map-marker mr-1"></i>{{ dept.locationId.name }}</template>
                  <span v-else style="color: var(--an-text-muted);">—</span>
                </template>
                <template v-else-if="col.key === 'description'">
                  <span style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; color: var(--an-text-muted);">{{ dept.description || '—' }}</span>
                </template>
              </td>
              </template>
            </tr>
            <tr v-if="departments.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color: var(--an-text-muted);">{{ $t('departments.noDepartments') }}</td></tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editing ? $t('departments.editDepartment') : $t('departments.newDepartment')" :style="{ width: '500px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2"><label>{{ $t('departments.departmentName') }}</label><InputText v-model="form.name" class="w-full" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('departments.manager') }}</label><Select v-model="form.managerId" :options="employeeOptions" optionLabel="label" optionValue="value" class="w-full" showClear /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('departments.location') }}</label><QuickCreateSelect v-model="form.locationId" :options="locations" createEndpoint="/locations" :entityLabel="$t('hardware.location')" class="w-full" showClear @created="load" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('common.description') }}</label><Textarea v-model="form.description" rows="2" class="w-full" /></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="dialog = false" />
          <Button :label="editing ? $t('common.update') : $t('common.create')" severity="primary" :disabled="!form.name" @click="save" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="remove" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Department" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

