<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
import OnboardingDrawer from '../components/OnboardingDrawer.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ToggleSwitch from 'primevue/toggleswitch'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import ChangeHistory from '../components/ChangeHistory.vue'
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
const isAdmin = authStore.isAdmin
const isManager = authStore.isManager

const { t } = useI18n()


interface NamedRef { _id: string; name: string }
interface Employee {
  _id: string; firstName: string; lastName: string; email: string
  departmentId?: NamedRef | null; locationId?: NamedRef | null
  jobTitle?: string; phone?: string; managerId?: { _id: string; firstName: string; lastName: string } | null
  userId?: string | null; isActive: boolean; startDate?: string; endDate?: string; createdAt: string
}

const employees = ref<Employee[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')


const departments = ref<NamedRef[]>([])
const locations = ref<NamedRef[]>([])
const customFieldDefinitions = ref<any[]>([])
const showAddDialog = ref(false)
const newEmployee = ref({ firstName: '', lastName: '', email: '', departmentId: '' as string, locationId: '' as string, jobTitle: '', phone: '', managerId: '', startDate: null as Date | null, endDate: null as Date | null, customFields: {} as Record<string, any> })
const saving = ref(false)
const showEditDialog = ref(false)
const editEmployee = ref({ _id: '', firstName: '', lastName: '', email: '', departmentId: '' as string, locationId: '' as string, jobTitle: '', phone: '', managerId: '', isActive: true, startDate: null as Date | null, endDate: null as Date | null, customFields: {} as Record<string, any> })
const managerOptions = ref<{ label: string; value: string }[]>([])
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const deleteDialog = ref(false)
const deletingEmployee = ref<Employee | null>(null)
const editTab = ref(0)
const enrichedData = ref<any>(null)
const enrichedLoading = ref(false)

const showQuickAssignDialog = ref(false)
const quickAssignType = ref<'hardware'|'peripheral'|'license'|'consumable'>('hardware')
const availableItems = ref<any[]>([])
const selectedItemId = ref<string>('')
const assignQuantity = ref(1)
const assignCategoryFilter = ref('')
const assignCategories = ref<any[]>([])
const quickAssignLoading = ref(false)
const quickAssignSaving = ref(false)

const showQuickReturnDialog = ref(false)
const quickReturnItem = ref<any>(null)
const quickReturnType = ref<'assignment'|'peripheral'|'license'|'consumable'>('assignment')
const quickReturnCondition = ref('good')

async function refreshEnrichedData() {
  if (!editEmployee.value._id) return
  enrichedLoading.value = true
  try {
    const { data } = await api.get(`/employees/${editEmployee.value._id}`)
    enrichedData.value = data._related || null
  } catch {
  } finally {
    enrichedLoading.value = false
  }
}

const manageFieldsDialog = ref(false)
const fieldsForm = ref({ name: '', fieldType: 'text', options: [] as string[], required: false, helpText: '', order: 0 })
const editingField = ref<any>(null)
const fieldOptionInput = ref('')

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'pi pi-align-left' },
  { value: 'number', label: 'Number', icon: 'pi pi-hashtag' },
  { value: 'date', label: 'Date', icon: 'pi pi-calendar' },
  { value: 'boolean', label: 'Yes / No', icon: 'pi pi-check-square' },
  { value: 'select', label: 'Dropdown', icon: 'pi pi-list' },
  { value: 'url', label: 'URL', icon: 'pi pi-link' },
  { value: 'email', label: 'Email', icon: 'pi pi-envelope' }
]

function openManageFields() {
  manageFieldsDialog.value = true
}

function openCreateField() {
  editingField.value = null
  fieldsForm.value = { name: '', fieldType: 'text', options: [], required: false, helpText: '', order: customFieldDefinitions.value.length }
}

function openEditField(f: any) {
  editingField.value = f
  fieldsForm.value = { ...f, options: [...f.options] }
}

function addFieldOption() {
  const v = fieldOptionInput.value.trim()
  if (v && !fieldsForm.value.options.includes(v)) {
    fieldsForm.value.options.push(v)
    fieldOptionInput.value = ''
  }
}

function removeFieldOption(idx: number) {
  fieldsForm.value.options.splice(idx, 1)
}

async function saveField() {
  saving.value = true
  try {
    const payload = { ...fieldsForm.value, entityType: 'employee' }
    if (editingField.value) {
      await api.put(`/custom-fields/${editingField.value._id}`, payload)
    } else {
      await api.post('/custom-fields', payload)
    }
    openCreateField()
    await fetchLookups()
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to save field')
  } finally {
    saving.value = false
  }
}

async function removeField(f: any) {
  if (!confirm('Are you sure you want to delete this field?')) return
  try {
    await api.delete(`/custom-fields/${f._id}`)
    if (editingField.value?._id === f._id) openCreateField()
    await fetchLookups()
  } catch (err: unknown) {
    error.value = extractApiError(err, 'Failed to delete field')
  }
}

async function openQuickAssign(type: 'hardware'|'peripheral'|'license'|'consumable') {
  quickAssignType.value = type
  selectedItemId.value = ''
  assignQuantity.value = 1
  assignCategoryFilter.value = ''
  availableItems.value = []
  showQuickAssignDialog.value = true
  quickAssignLoading.value = true
  try {
    if (type === 'hardware') {
      assignCategories.value = (await api.get('/categories')).data.filter((c: any) => c.entityType === 'hardware' || !c.entityType)
      availableItems.value = (await api.get('/hardware', { params: { statusSlug: 'available' } })).data
    } else if (type === 'peripheral') {
      assignCategories.value = (await api.get('/categories')).data.filter((c: any) => c.entityType === 'peripheral' || !c.entityType)
      availableItems.value = (await api.get('/peripherals', { params: { statusSlug: 'available' } })).data
    } else if (type === 'license') {
      availableItems.value = (await api.get('/licenses')).data
    } else if (type === 'consumable') {
      availableItems.value = (await api.get('/consumables')).data
    }
  } catch (e) {
    console.error(e)
  } finally {
    quickAssignLoading.value = false
  }
}

const filteredAssignItems = computed(() => {
  if (!assignCategoryFilter.value) return availableItems.value
  return availableItems.value.filter((item: any) => {
    const catId = item.categoryId?._id || item.categoryId
    return catId === assignCategoryFilter.value
  })
})

function assignItemLabel(item: any): string {
  const parts: string[] = []
  const name = item.name || item.model || item.serialNumber || 'Unknown'
  parts.push(name)
  const cat = item.categoryId?.name
  if (cat) parts.push(`[${cat}]`)
  const mfr = item.manufacturerId?.name
  if (mfr) parts.push(`· ${mfr}`)
  if (item.serialNumber && item.model && item.serialNumber !== item.model) parts.push(`(${item.serialNumber})`)
  return parts.join(' ')
}

async function performQuickAssign() {
  if (!selectedItemId.value) return
  quickAssignSaving.value = true
  try {
    const empId = editEmployee.value._id
    if (quickAssignType.value === 'hardware') {
      await api.post('/assignments', {
        employeeId: empId,
        hardware: [selectedItemId.value],
        expectedReturnDate: null,
        notes: 'Quick Assigned from Employee Details'
      })
    } else if (quickAssignType.value === 'peripheral') {
      await api.put(`/peripherals/${selectedItemId.value}`, { assignedTo: empId })
    } else if (quickAssignType.value === 'license') {
      await api.post(`/licenses/${selectedItemId.value}/checkout`, { employeeIds: [empId] })
    } else if (quickAssignType.value === 'consumable') {
      await api.post(`/consumables/${selectedItemId.value}/checkout`, { employeeId: empId, quantity: assignQuantity.value })
    }
    showQuickAssignDialog.value = false
    await refreshEnrichedData()
  } catch (err) {
    error.value = extractApiError(err, 'Failed to assign')
  } finally {
    quickAssignSaving.value = false
  }
}

function openQuickReturn(type: 'assignment'|'peripheral'|'license'|'consumable', item: any) {
  quickReturnType.value = type
  quickReturnItem.value = item
  quickReturnCondition.value = 'good'
  showQuickReturnDialog.value = true
}

async function performQuickReturn() {
  quickAssignSaving.value = true
  try {
    if (quickReturnType.value === 'assignment') {
      await api.post(`/assignments/${quickReturnItem.value._id}/complete-return`, {
        returnCondition: quickReturnCondition.value,
        notes: 'Quick Returned'
      })
    } else if (quickReturnType.value === 'peripheral') {
      await api.put(`/peripherals/${quickReturnItem.value._id}`, { assignedTo: null })
    } else if (quickReturnType.value === 'license') {
      await api.post(`/licenses/${quickReturnItem.value._id}/checkin`, { employeeIds: [editEmployee.value._id] })
    }
    showQuickReturnDialog.value = false
    await refreshEnrichedData()
  } catch(err) {
    error.value = extractApiError(err, 'Failed to return')
  } finally {
    quickAssignSaving.value = false
  }
}

function getActiveAssignmentForHardware(hwId: string) {
  if (!enrichedData.value?.assignments) return null
  return enrichedData.value.assignments.find((a: any) =>
    a.status === 'active' && a.hardware?.some((h: any) => h._id === hwId)
  )
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('de-DE') : '—' }
function fmtCurrency(v: number, currency = 'EUR') { return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v) }

const employeeColumns: ColumnDef[] = [
  { key: 'name', label: t('employees.firstName'), default: true },
  { key: 'email', label: t('common.email'), default: true },
  { key: 'department', label: t('common.department'), default: true },
  { key: 'location', label: t('hardware.location'), default: false },
  { key: 'jobTitle', label: t('employees.jobTitle'), default: true },
  { key: 'phone', label: t('common.phone'), default: false },
  { key: 'manager', label: t('employees.manager'), default: false },
  { key: 'startDate', label: t('employees.startDate'), default: false, format: 'date' },
  { key: 'endDate', label: t('employees.endDate'), default: false, format: 'date' },
  { key: 'status', label: t('common.status'), default: true, format: 'tag' },
  { key: 'createdAt', label: t('common.createdAt'), default: false, format: 'date' },
]

const {
  allColumns: enrichedColumns,
  visibleColumns,
  visibleKeys,
  toggleColumn,
  reorderColumns,
  isVisible,
  resetToDefaults,
} = useTableColumns('employees', employeeColumns)

function formatCellValue(item: Employee, col: ColumnDef): string {
  switch (col.key) {
    case 'name': return `${item.firstName} ${item.lastName}`
    case 'email': return item.email
    case 'department': return item.departmentId?.name || '—'
    case 'location': return item.locationId?.name || '—'
    case 'jobTitle': return item.jobTitle || '—'
    case 'phone': return item.phone || '—'
    case 'manager':
      return item.managerId ? `${item.managerId.firstName} ${item.managerId.lastName}` : '—'
    case 'startDate':
      return item.startDate ? new Date(item.startDate).toLocaleDateString('de-DE') : '—'
    case 'endDate':
      return item.endDate ? new Date(item.endDate).toLocaleDateString('de-DE') : '—'
    case 'status':
      return item.isActive ? t('common.active') : t('common.inactive')
    case 'createdAt':
      return new Date(item.createdAt).toLocaleDateString('de-DE')
    default: return '—'
  }
}

const { sortKey, sortDir, toggleSort, sorted: sortedEmployees } = useTableSort(employees, employeeColumns, (item: any, key: string) => {
  const col = employeeColumns.find(c => c.key === key)
  return col ? formatCellValue(item, col) : '—'
})
const { paginatedItems, page, pageSize, totalItems, totalPages, resetPage } = usePagination(sortedEmployees, 25)
watch([searchQuery], () => resetPage())

function getInitials(item: Employee): string {
  return (item.firstName?.[0] || '') + (item.lastName?.[0] || '')
}

async function fetchLookups() {
  try {
    const [deptRes, locRes, cfRes] = await Promise.all([
      api.get('/departments'),
      api.get('/locations'),
      api.get('/custom-fields/entity/employee')
    ])
    departments.value = deptRes.data
    locations.value = locRes.data
    customFieldDefinitions.value = cfRes.data
  } catch {  }
}

async function fetchEmployees() {
  loading.value = true; error.value = null
  try {
    const params: Record<string, string> = {}
    if (searchQuery.value) params.search = searchQuery.value
    employees.value = (await api.get('/employees', { params })).data
    managerOptions.value = employees.value
      .filter(e => e.isActive)
      .map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
  } catch (err) { error.value = 'Failed to load employees'; console.error(err) }
  finally { loading.value = false }
}

async function addEmployee() {
  saving.value = true
  try {
    const payload: Record<string, unknown> = { ...newEmployee.value }
    if (!payload.managerId) delete payload.managerId
    if (!payload.departmentId) delete payload.departmentId
    if (!payload.locationId) delete payload.locationId
    if (payload.startDate) payload.startDate = (payload.startDate as Date).toISOString()
    else delete payload.startDate
    if (payload.endDate) payload.endDate = (payload.endDate as Date).toISOString()
    else delete payload.endDate

    if (Object.keys(payload.customFields as any || {}).length === 0) {
      delete payload.customFields
    }

    await api.post('/employees', payload)
    showAddDialog.value = false
    newEmployee.value = { firstName: '', lastName: '', email: '', departmentId: '', locationId: '', jobTitle: '', phone: '', managerId: '', startDate: null, endDate: null, customFields: {} }
    await fetchEmployees()
  } catch (err: unknown) { error.value = extractApiError(err, 'Failed to add employee') }
  finally { saving.value = false }
}

function confirmDeleteEmployee(item: Employee) { deletingEmployee.value = item; deleteDialog.value = true }
async function deleteEmployee() {
  if (!deletingEmployee.value) return
  try { await api.delete(`/employees/${deletingEmployee.value._id}`); deleteDialog.value = false; deletingEmployee.value = null; await fetchEmployees() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Failed to delete employee' }
}

async function openEdit(item: Employee) {
  editEmployee.value = {
    _id: item._id, firstName: item.firstName, lastName: item.lastName,
    email: item.email, departmentId: item.departmentId?._id || '', locationId: item.locationId?._id || '',
    jobTitle: item.jobTitle || '',
    phone: item.phone || '', managerId: item.managerId?._id || '',
    isActive: item.isActive,
    startDate: item.startDate ? new Date(item.startDate) : null,
    endDate: item.endDate ? new Date(item.endDate) : null,
    customFields: { ...(item.customFields || {}) }
  }
  editTab.value = 0
  enrichedData.value = null
  showEditDialog.value = true
  enrichedLoading.value = true
  try {
    const { data } = await api.get(`/employees/${item._id}`)
    enrichedData.value = data._related || null
  } catch { enrichedData.value = null }
  finally { enrichedLoading.value = false }
}

async function saveEdit() {
  saving.value = true
  try {
    const { _id, ...data } = editEmployee.value
    const payload: Record<string, unknown> = { ...data }
    if (!payload.managerId) payload.managerId = null
    if (!payload.departmentId) payload.departmentId = null
    if (!payload.locationId) payload.locationId = null
    if (payload.startDate) payload.startDate = (payload.startDate as Date).toISOString()
    else delete payload.startDate
    if (payload.endDate) payload.endDate = (payload.endDate as Date).toISOString()
    else delete payload.endDate

    if (Object.keys(payload.customFields as any || {}).length === 0) {
      delete payload.customFields
    }

    await api.put(`/employees/${_id}`, payload)
    showEditDialog.value = false; await fetchEmployees()
  } catch (err: unknown) { error.value = extractApiError(err, 'Failed to update employee') }
  finally { saving.value = false }
}

const showOnboardDrawer = ref(false)
const onboardMode = ref<'onboard' | 'offboard'>('onboard')
function openOnboard() { onboardMode.value = 'onboard'; showOnboardDrawer.value = true }
function openOffboard() { onboardMode.value = 'offboard'; showOnboardDrawer.value = true }
function onOnboardComplete() { fetchEmployees() }

onMounted(() => { fetchLookups(); fetchEmployees() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing: -0.02em;">{{ $t('employees.title') }}</h1>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">{{ $t('employees.subtitle') }}</p>
        </div>
        <div class="flex gap-2 flex-wrap align-items-center">
          <ColumnPicker
            :allColumns="enrichedColumns"
            :visibleKeys="visibleKeys"
            :isVisible="isVisible"
            @toggle="toggleColumn"
            @reorder="reorderColumns"
            @reset="resetToDefaults"
          />
          <Button v-if="isManager" severity="success" icon="pi pi-user-plus" :label="$t('onboarding.title')" @click="openOnboard" />
          <Button v-if="isManager" severity="danger" icon="pi pi-user-minus" :label="$t('onboarding.offboarding')" @click="openOffboard" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('employees.addEmployee')" class="btn-glow-primary" @click="showAddDialog = true" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('employees.searchPlaceholder')" class="an-search-input" @update:modelValue="fetchEmployees" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

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
              <td v-if="col.key === '_actions'" style="text-align:right; white-space: nowrap;" :data-label="$t('common.actions')">
                <Button v-if="isManager" icon="pi pi-pencil" size="small" text rounded severity="primary" @click="openEdit(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDeleteEmployee(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'">
                  <router-link :to="'/employees/' + item._id" class="flex align-items-center gap-2 employee-name-link">
                    <div class="avatar-circle"><span>{{ getInitials(item) }}</span></div>
                    <div>
                      <div class="font-bold">{{ item.firstName }} {{ item.lastName }}</div>
                      <div v-if="isVisible('manager') === false && item.managerId" style="font-size: 12px; color: var(--an-text-muted);">
                        {{ $t('employees.reportsTo', { name: item.managerId.firstName + ' ' + item.managerId.lastName }) }}
                      </div>
                    </div>
                  </router-link>
                </template>
                <template v-else-if="col.key === 'status'">
                  <Tag :value="item.isActive ? $t('common.active') : $t('common.inactive')" :severity="item.isActive ? 'success' : 'secondary'" />
                </template>
                <template v-else>
                  {{ formatCellValue(item, col) }}
                </template>
              </td>
              </template>
            </tr>
          </tbody>
        </table>
        <PaginationBar
          :page="page" :totalPages="totalPages" :totalItems="totalItems" :pageSize="pageSize"
          @update:page="page = $event" @update:pageSize="pageSize = $event"
        />
      </div>

      <Dialog v-model:visible="showAddDialog" :header="$t('employees.addEmployee')" :style="{ width: '500px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="grid">
            <div class="col-6"><label>{{ $t('employees.firstName') }}</label><InputText v-model="newEmployee.firstName" class="w-full mt-2" required /></div>
            <div class="col-6"><label>{{ $t('employees.lastName') }}</label><InputText v-model="newEmployee.lastName" class="w-full mt-2" required /></div>
          </div>
          <div class="flex flex-column gap-2"><label>{{ $t('common.email') }}</label><InputText v-model="newEmployee.email" type="email" class="w-full" required /></div>
          <div class="grid">
            <div class="col-6">
              <label>{{ $t('common.department') }}</label>
              <QuickCreateSelect v-model="newEmployee.departmentId" :options="departments" createEndpoint="/departments" :entityLabel="$t('common.department')" class="w-full mt-2" showClear @created="fetchLookups" />
            </div>
            <div class="col-6">
              <label>{{ $t('hardware.location') }}</label>
              <QuickCreateSelect v-model="newEmployee.locationId" :options="locations" createEndpoint="/locations" :entityLabel="$t('hardware.location')" class="w-full mt-2" showClear @created="fetchLookups" />
            </div>
          </div>
          <div class="flex flex-column gap-2"><label>{{ $t('employees.jobTitle') }}</label><InputText v-model="newEmployee.jobTitle" class="w-full" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('common.phone') }}</label><InputText v-model="newEmployee.phone" class="w-full" /></div>
          <div class="flex flex-column gap-2"><label>{{ $t('employees.manager') }}</label><Select v-model="newEmployee.managerId" :options="managerOptions" optionLabel="label" optionValue="value" class="w-full" showClear :placeholder="$t('common.select')" /></div>
          <div class="grid">
            <div class="col-6"><label>{{ $t('employees.startDate') }}</label><DatePicker v-model="newEmployee.startDate" class="w-full mt-2" dateFormat="dd.mm.yy" showIcon /></div>
            <div class="col-6"><label>{{ $t('employees.endDate') }}</label><DatePicker v-model="newEmployee.endDate" class="w-full mt-2" dateFormat="dd.mm.yy" showIcon /></div>
          </div>

          <div v-if="customFieldDefinitions.length > 0 || isManager || isAdmin" class="flex justify-content-between align-items-center mt-4 mb-2">
            <h3 class="m-0 text-lg font-semibold" v-if="customFieldDefinitions.length > 0">{{ $t('common.customFields') || 'Custom Fields' }}</h3>
            <div v-else></div>
            <Button v-if="isManager || isAdmin" size="small" icon="pi pi-cog" :label="$t('common.manageFields') || 'Manage Fields'" text @click="openManageFields" />
          </div>
          <div class="grid" v-if="customFieldDefinitions.length > 0">
            <div class="col-6 flex flex-column gap-2" v-for="cf in customFieldDefinitions" :key="cf._id">
              <label>{{ cf.name }} <span v-if="cf.required" class="text-red-500">*</span></label>
              <InputText v-if="cf.fieldType === 'text'" v-model="(newEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
              <InputNumber v-else-if="cf.fieldType === 'number'" v-model="(newEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
              <DatePicker v-else-if="cf.fieldType === 'date'" v-model="(newEmployee.customFields as any)[cf.name]" class="w-full" dateFormat="dd.mm.yy" showIcon />
              <Select v-else-if="cf.fieldType === 'select'" v-model="(newEmployee.customFields as any)[cf.name]" :options="cf.options || []" class="w-full" showClear :required="cf.required" />
              <ToggleSwitch v-else-if="cf.fieldType === 'boolean'" v-model="(newEmployee.customFields as any)[cf.name]" />
              <InputText v-else-if="cf.fieldType === 'url' || cf.fieldType === 'email'" :type="cf.fieldType" v-model="(newEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
            </div>
          </div>

        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showAddDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="addEmployee" />
        </template>
      </Dialog>

      <Dialog v-model:visible="showEditDialog" :header="$t('employees.editEmployee')" :style="{ width: '950px', minHeight: '700px', maxHeight: '700px' }" modal class="ed-dialog">
        <TabView v-model:activeIndex="editTab">
          <TabPanel>
            <template #header><i class="pi pi-user mr-2" /><span>{{ $t('employees.detail.profile') }}</span></template>
            <div class="flex flex-column gap-3">
              <div class="grid">
                <div class="col-6"><label>{{ $t('employees.firstName') }}</label><InputText v-model="editEmployee.firstName" class="w-full mt-2" required /></div>
                <div class="col-6"><label>{{ $t('employees.lastName') }}</label><InputText v-model="editEmployee.lastName" class="w-full mt-2" required /></div>
              </div>
              <div class="flex flex-column gap-2"><label>{{ $t('common.email') }}</label><InputText v-model="editEmployee.email" type="email" class="w-full" required /></div>
              <div class="grid">
                <div class="col-6"><label>{{ $t('common.department') }}</label><QuickCreateSelect v-model="editEmployee.departmentId" :options="departments" createEndpoint="/departments" :entityLabel="$t('common.department')" class="w-full mt-2" showClear @created="fetchLookups" /></div>
                <div class="col-6"><label>{{ $t('hardware.location') }}</label><QuickCreateSelect v-model="editEmployee.locationId" :options="locations" createEndpoint="/locations" :entityLabel="$t('hardware.location')" class="w-full mt-2" showClear @created="fetchLookups" /></div>
              </div>
              <div class="flex flex-column gap-2"><label>{{ $t('employees.jobTitle') }}</label><InputText v-model="editEmployee.jobTitle" class="w-full" /></div>
              <div class="flex flex-column gap-2"><label>{{ $t('common.phone') }}</label><InputText v-model="editEmployee.phone" class="w-full" /></div>
              <div class="flex flex-column gap-2"><label>{{ $t('employees.manager') }}</label><Select v-model="editEmployee.managerId" :options="managerOptions" optionLabel="label" optionValue="value" class="w-full" showClear :placeholder="$t('common.select')" /></div>
              <div class="flex align-items-center gap-3"><label>{{ $t('common.status') }}</label><ToggleSwitch v-model="editEmployee.isActive" /><Tag :value="editEmployee.isActive ? $t('common.active') : $t('common.inactive')" :severity="editEmployee.isActive ? 'success' : 'secondary'" /></div>
              <div class="grid">
                <div class="col-6"><label>{{ $t('employees.startDate') }}</label><DatePicker v-model="editEmployee.startDate" class="w-full mt-2" dateFormat="dd.mm.yy" showIcon /></div>
                <div class="col-6"><label>{{ $t('employees.endDate') }}</label><DatePicker v-model="editEmployee.endDate" class="w-full mt-2" dateFormat="dd.mm.yy" showIcon /></div>
              </div>

              <div v-if="customFieldDefinitions.length > 0 || isManager || isAdmin" class="flex justify-content-between align-items-center mt-4 mb-2">
                <h3 class="m-0 text-lg font-semibold" v-if="customFieldDefinitions.length > 0">{{ $t('common.customFields') || 'Custom Fields' }}</h3>
                <div v-else></div>
                <Button v-if="isManager || isAdmin" size="small" icon="pi pi-cog" :label="$t('common.manageFields') || 'Manage Fields'" text @click="openManageFields" />
              </div>
              <div class="grid" v-if="customFieldDefinitions.length > 0">
                <div class="col-6 flex flex-column gap-2" v-for="cf in customFieldDefinitions" :key="cf._id">
                  <label>{{ cf.name }} <span v-if="cf.required" class="text-red-500">*</span></label>
                  <InputText v-if="cf.fieldType === 'text'" v-model="(editEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
                  <InputNumber v-else-if="cf.fieldType === 'number'" v-model="(editEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
                  <DatePicker v-else-if="cf.fieldType === 'date'" v-model="(editEmployee.customFields as any)[cf.name]" class="w-full" dateFormat="dd.mm.yy" showIcon />
                  <Select v-else-if="cf.fieldType === 'select'" v-model="(editEmployee.customFields as any)[cf.name]" :options="cf.options || []" class="w-full" showClear :required="cf.required" />
                  <ToggleSwitch v-else-if="cf.fieldType === 'boolean'" v-model="(editEmployee.customFields as any)[cf.name]" />
                  <InputText v-else-if="cf.fieldType === 'url' || cf.fieldType === 'email'" :type="cf.fieldType" v-model="(editEmployee.customFields as any)[cf.name]" class="w-full" :required="cf.required" />
                </div>
              </div>

            </div>
          </TabPanel>

          <TabPanel>
            <template #header><i class="pi pi-desktop mr-2" /><span>{{ $t('employees.detail.hardware') }}</span><Tag v-if="enrichedData?.hardware?.length" class="ml-2" severity="secondary" rounded>{{ enrichedData.hardware.length }}</Tag></template>
            <div class="flex justify-content-between align-items-center mb-3">
              <h3 class="m-0 text-lg font-semibold">{{ $t('employees.detail.hardware') }}</h3>
              <Button v-if="isManager" size="small" icon="pi pi-plus" :label="$t('common.assign')" @click="openQuickAssign('hardware')" />
            </div>
            <div v-if="enrichedLoading" class="ed-empty"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;" /></div>
            <div v-else-if="!enrichedData?.hardware?.length" class="ed-empty"><i class="pi pi-desktop" style="font-size:2rem;opacity:.3;" /><p>{{ $t('employees.detail.noHardware') }}</p></div>
            <div v-else class="ed-asset-list">
              <div v-for="hw in enrichedData.hardware" :key="hw._id" class="ed-asset-row">
                <div class="flex align-items-center gap-3" style="flex:1;min-width:0;"><i class="pi pi-desktop ed-icon" /><div style="min-width:0;"><div class="font-bold text-ellipsis">{{ hw.model }}</div><div class="ed-sub">{{ hw.serialNumber }}<span v-if="hw.manufacturerId"> · {{ hw.manufacturerId.name }}</span></div></div></div>
                <div class="flex align-items-center gap-2">
                  <span v-if="hw.purchasePrice" class="ed-sub">{{ fmtCurrency(hw.purchasePrice) }}</span>
                  <Tag v-if="hw.statusId" :value="hw.statusId.name" :style="{ background: hw.statusId.color || 'var(--an-border-dark)', color: '#fff', fontSize: '11px' }" />
                  <Button v-if="isManager && getActiveAssignmentForHardware(hw._id)" icon="pi pi-refresh" text size="small" severity="secondary" @click="openQuickReturn('assignment', getActiveAssignmentForHardware(hw._id))" v-tooltip="$t('common.return')" />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><i class="pi pi-tablet mr-2" /><span>{{ $t('employees.detail.peripherals') }}</span><Tag v-if="enrichedData?.peripherals?.length" class="ml-2" severity="secondary" rounded>{{ enrichedData.peripherals.length }}</Tag></template>
            <div class="flex justify-content-between align-items-center mb-3">
              <h3 class="m-0 text-lg font-semibold">{{ $t('employees.detail.peripherals') }}</h3>
              <Button v-if="isManager" size="small" icon="pi pi-plus" :label="$t('common.assign')" @click="openQuickAssign('peripheral')" />
            </div>
            <div v-if="enrichedLoading" class="ed-empty"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;" /></div>
            <div v-else-if="!enrichedData?.peripherals?.length" class="ed-empty"><i class="pi pi-tablet" style="font-size:2rem;opacity:.3;" /><p>{{ $t('employees.detail.noPeripherals') }}</p></div>
            <div v-else class="ed-asset-list">
              <div v-for="p in enrichedData.peripherals" :key="p._id" class="ed-asset-row">
                <div class="flex align-items-center gap-3" style="flex:1;min-width:0;"><i class="pi pi-tablet ed-icon" /><div style="min-width:0;"><div class="font-bold text-ellipsis">{{ p.model }}</div><div class="ed-sub">{{ p.serialNumber }}<span v-if="p.manufacturerId"> · {{ p.manufacturerId.name }}</span></div></div></div>
                <div class="flex align-items-center gap-2">
                  <Tag v-if="p.statusId" :value="p.statusId.name" :style="{ background: p.statusId.color || 'var(--an-border-dark)', color: '#fff', fontSize: '11px' }" />
                  <Button v-if="isManager" icon="pi pi-refresh" text size="small" severity="secondary" @click="openQuickReturn('peripheral', p)" v-tooltip="$t('common.return')" />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><i class="pi pi-key mr-2" /><span>{{ $t('employees.detail.licenses') }}</span><Tag v-if="enrichedData?.licenseSeats?.length" class="ml-2" severity="secondary" rounded>{{ enrichedData.licenseSeats.length }}</Tag></template>
            <div class="flex justify-content-between align-items-center mb-3">
              <h3 class="m-0 text-lg font-semibold">{{ $t('employees.detail.licenses') }}</h3>
              <Button v-if="isManager" size="small" icon="pi pi-plus" :label="$t('common.assign')" @click="openQuickAssign('license')" />
            </div>
            <div v-if="enrichedLoading" class="ed-empty"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;" /></div>
            <div v-else-if="!enrichedData?.licenseSeats?.length" class="ed-empty"><i class="pi pi-key" style="font-size:2rem;opacity:.3;" /><p>{{ $t('employees.detail.noLicenses') }}</p></div>
            <div v-else class="ed-asset-list">
              <div v-for="lic in enrichedData.licenseSeats" :key="lic._id" class="ed-asset-row">
                <div class="flex align-items-center gap-3" style="flex:1;min-width:0;"><i class="pi pi-key ed-icon" /><div style="min-width:0;"><div class="font-bold text-ellipsis">{{ lic.name }}</div><div class="ed-sub">{{ lic.publisher || '—' }} · {{ lic.licenseType }}</div></div></div>
                <div class="flex align-items-center gap-2">
                  <span class="ed-sub">{{ fmtCurrency(lic.costPerSeat || 0, lic.currency) }}/seat</span>
                  <Button v-if="isManager" icon="pi pi-times" text size="small" severity="danger" @click="openQuickReturn('license', lic)" v-tooltip="'Revoke Seat'" />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><i class="pi pi-box mr-2" /><span>{{ $t('employees.detail.consumables') }}</span><Tag v-if="enrichedData?.consumableCheckouts?.length" class="ml-2" severity="secondary" rounded>{{ enrichedData.consumableCheckouts.reduce((s, c) => s + (c.checkouts?.length || 0), 0) }}</Tag></template>
            <div class="flex justify-content-between align-items-center mb-3">
              <h3 class="m-0 text-lg font-semibold">{{ $t('employees.detail.consumables') }}</h3>
              <Button v-if="isManager" size="small" icon="pi pi-plus" :label="$t('common.assign')" @click="openQuickAssign('consumable')" />
            </div>
            <div v-if="enrichedLoading" class="ed-empty"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;" /></div>
            <div v-else-if="!enrichedData?.consumableCheckouts?.length" class="ed-empty"><i class="pi pi-box" style="font-size:2rem;opacity:.3;" /><p>{{ $t('employees.detail.noConsumables') }}</p></div>
            <div v-else class="ed-asset-list">
              <template v-for="con in enrichedData.consumableCheckouts" :key="con._id">
                <div v-for="co in con.checkouts" :key="co._id" class="ed-asset-row">
                  <div class="flex align-items-center gap-3" style="flex:1;"><i class="pi pi-box ed-icon" /><div><div class="font-bold">{{ con.name }}</div><div class="ed-sub">{{ fmtDate(co.checkedOutAt) }}</div></div></div>
                  <div class="flex align-items-center gap-2"><Tag :value="'× ' + co.quantity" severity="info" /><span class="ed-sub">{{ fmtCurrency(con.unitCost || 0, con.currency) }}</span></div>
                </div>
              </template>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><i class="pi pi-history mr-2" /><span>{{ $t('employees.detail.assignmentHistory') }}</span><Tag v-if="enrichedData?.assignments?.length" class="ml-2" severity="secondary" rounded>{{ enrichedData.assignments.length }}</Tag></template>
            <div v-if="enrichedLoading" class="ed-empty"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;" /></div>
            <div v-else-if="!enrichedData?.assignments?.length" class="ed-empty"><i class="pi pi-history" style="font-size:2rem;opacity:.3;" /><p>{{ $t('employees.detail.noHistory') }}</p></div>
            <div v-else class="ed-asset-list">
              <div v-for="a in enrichedData.assignments" :key="a._id" class="ed-asset-row">
                <div class="flex align-items-center gap-3" style="flex:1;min-width:0;"><i class="pi pi-history ed-icon" /><div style="min-width:0;"><div class="font-bold text-ellipsis">{{ a.hardware?.model || '—' }}</div><div class="ed-sub">{{ a.hardware?.serialNumber || '' }} · {{ fmtDate(a.createdAt) }}</div></div></div>
                <Tag :value="a.status" :severity="a.status === 'active' ? 'success' : a.status === 'returned' ? 'info' : 'warn'" />
              </div>
            </div>
          </TabPanel>
        </TabView>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showEditDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="saveEdit" />
        </template>
      </Dialog>

      <OnboardingDrawer v-model="showOnboardDrawer" :mode="onboardMode" :employees="employees.filter(e => e.isActive)" @completed="onOnboardComplete" />

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingEmployee ? `${deletingEmployee.firstName} ${deletingEmployee.lastName}` : '' }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteEmployee" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Employee" :entityId="historyEntityId" />
      </Dialog>

      <Dialog v-model:visible="showQuickAssignDialog" :header="$t('common.assign')" :style="{ width: '500px' }" modal>
        <div class="flex flex-column gap-3 pt-2">
          <div v-if="quickAssignLoading" class="flex justify-content-center p-4"><i class="pi pi-spin pi-spinner text-2xl" /></div>
          <div v-else-if="availableItems.length === 0" class="p-4 text-center text-500">No items available.</div>
          <div v-else class="flex flex-column gap-3">
            <div v-if="(quickAssignType === 'hardware' || quickAssignType === 'peripheral') && assignCategories.length > 1" class="flex flex-column gap-2">
              <label class="font-semibold">{{ $t('common.category') || 'Category' }}</label>
              <Select v-model="assignCategoryFilter" :options="assignCategories" optionValue="_id" optionLabel="name" class="w-full" showClear :placeholder="$t('common.all') || 'All categories'" />
            </div>
            <label class="font-semibold">{{ $t('common.select') }}</label>
            <Select v-model="selectedItemId" :options="filteredAssignItems" optionValue="_id" :optionLabel="assignItemLabel" class="w-full" filter>
              <template #option="slotProps">
                <div class="flex align-items-center gap-2">
                  <i v-if="slotProps.option.categoryId?.icon" :class="slotProps.option.categoryId.icon" style="font-size:.9rem;opacity:.6;" />
                  <div style="min-width:0;">
                    <div class="font-semibold">{{ slotProps.option.name || slotProps.option.model || slotProps.option.serialNumber }}</div>
                    <div class="text-xs text-color-secondary">{{ [slotProps.option.categoryId?.name, slotProps.option.manufacturerId?.name, slotProps.option.serialNumber].filter(Boolean).join(' · ') }}</div>
                  </div>
                </div>
              </template>
            </Select>

            <div v-if="quickAssignType === 'consumable'" class="flex flex-column gap-2 mt-2">
              <label class="font-semibold">Quantity</label>
              <InputText v-model.number="assignQuantity" type="number" min="1" class="w-full" />
            </div>
          </div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showQuickAssignDialog = false" />
          <Button :label="$t('common.assign')" severity="primary" :loading="quickAssignSaving" :disabled="!selectedItemId" @click="performQuickAssign" />
        </template>
      </Dialog>

      <Dialog v-model:visible="showQuickReturnDialog" :header="$t('common.return')" :style="{ width: '400px' }" modal>
        <div class="flex flex-column gap-3 pt-2">
          <p class="m-0 text-color-secondary" v-if="quickReturnType === 'license'">Are you sure you want to revoke this license seat?</p>
          <div v-if="quickReturnType === 'assignment'" class="flex flex-column gap-2">
            <label class="font-semibold">Return Condition</label>
            <Select v-model="quickReturnCondition" :options="[{label:'Good', value:'good'}, {label:'Fair', value:'fair'}, {label:'Damaged', value:'damaged'}]" optionLabel="label" optionValue="value" class="w-full" />
          </div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showQuickReturnDialog = false" />
          <Button :label="quickReturnType === 'license' ? 'Revoke' : $t('common.return')" :severity="quickReturnType === 'license' ? 'danger' : 'primary'" :loading="quickAssignSaving" @click="performQuickReturn" />
        </template>
      </Dialog>
      <Dialog v-model:visible="manageFieldsDialog" :header="$t('common.manageFields') || 'Manage Custom Fields'" :style="{ width: '800px', minHeight: '500px' }" modal @hide="editingField = null">
        <div class="grid h-full">
          <div class="col-5 border-right-1 surface-border pr-3">
            <div class="flex justify-content-between align-items-center mb-3">
              <h3 class="m-0 text-lg">{{ $t('common.fields') || 'Fields' }}</h3>
              <Button icon="pi pi-plus" size="small" @click="openCreateField" />
            </div>
            <div class="flex flex-column gap-2 overflow-y-auto" style="max-height: 400px;">
              <div v-if="customFieldDefinitions.length === 0" class="text-color-secondary text-sm">No custom fields defined yet.</div>
              <div v-for="cf in customFieldDefinitions" :key="cf._id"
                   class="p-2 border-round cursor-pointer hover:surface-hover flex justify-content-between align-items-center border-1"
                   :class="editingField?._id === cf._id ? 'border-primary surface-hover' : 'surface-border'"
                   @click="openEditField(cf)">
                <div>
                  <div class="font-semibold">{{ cf.name }}</div>
                  <div class="text-xs text-color-secondary">{{ cf.fieldType }}</div>
                </div>
                <div class="flex gap-2">
                  <Tag v-if="cf.required" severity="danger" value="Req" class="text-xs" />
                  <Button icon="pi pi-trash" text severity="danger" size="small" @click.stop="removeField(cf)" />
                </div>
              </div>
            </div>
          </div>
          <div class="col-7 pl-4">
            <h3 class="m-0 text-lg mb-3">{{ editingField ? ($t('common.edit') || 'Edit') + ' ' + editingField.name : ($t('common.createNew') || 'Create New Field') }}</h3>
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-2">
                <label>Field Name <span class="text-red-500">*</span></label>
                <InputText v-model="fieldsForm.name" class="w-full" required autofocus />
              </div>
              <div class="flex flex-column gap-2">
                <label>Field Type <span class="text-red-500">*</span></label>
                <Select v-model="fieldsForm.fieldType" :options="FIELD_TYPES" optionLabel="label" optionValue="value" class="w-full">
                  <template #value="slotProps">
                    <div v-if="slotProps.value" class="flex align-items-center gap-2">
                      <i :class="FIELD_TYPES.find(t => t.value === slotProps.value)?.icon" />
                      <span>{{ FIELD_TYPES.find(t => t.value === slotProps.value)?.label }}</span>
                    </div>
                  </template>
                  <template #option="slotProps">
                    <div class="flex align-items-center gap-2">
                      <i :class="slotProps.option.icon" />
                      <span>{{ slotProps.option.label }}</span>
                    </div>
                  </template>
                </Select>
              </div>
              <div v-if="fieldsForm.fieldType === 'select'" class="flex flex-column gap-2 p-3 surface-ground border-round border-1 surface-border">
                <label class="font-semibold">Dropdown Options</label>
                <div class="flex gap-2">
                  <InputText v-model="fieldOptionInput" @keydown.enter="addFieldOption" class="flex-1" placeholder="Type option and press enter..." />
                  <Button icon="pi pi-plus" @click="addFieldOption" />
                </div>
                <div class="flex flex-wrap gap-2 mt-2">
                  <Tag v-for="(opt, idx) in fieldsForm.options" :key="opt" :value="opt" class="px-3 py-2 flex align-items-center gap-2">
                    {{ opt }}
                    <i class="pi pi-times cursor-pointer hover:text-red-500 ml-2" @click="removeFieldOption(idx)" />
                  </Tag>
                  <div v-if="fieldsForm.options.length === 0" class="text-sm text-color-secondary mt-1">No options added yet.</div>
                </div>
              </div>
              <div class="flex align-items-center gap-2 mt-2">
                <ToggleSwitch v-model="fieldsForm.required" inputId="reqSwitch" />
                <label for="reqSwitch" class="cursor-pointer">Required Field</label>
              </div>
              <div class="flex flex-column gap-2 mt-2">
                <label>Help Text (Optional)</label>
                <InputText v-model="fieldsForm.helpText" class="w-full" placeholder="Hint shown to users..." />
              </div>
            </div>
            <div class="flex justify-content-end gap-2 mt-4">
              <Button v-if="editingField" :label="$t('common.cancel') || 'Cancel'" severity="secondary" text @click="openCreateField" />
              <Button :label="$t('common.save') || 'Save'" severity="primary" @click="saveField" :disabled="!fieldsForm.name || (fieldsForm.fieldType === 'select' && fieldsForm.options.length === 0)" :loading="saving" />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>
.avatar-circle { width: 32px; height: 32px; background: var(--p-primary-color); font-weight: 600; font-size: 11px; }
.employee-name-link { text-decoration: none; color: inherit; transition: color 0.15s; }
.employee-name-link:hover .font-bold { color: var(--p-primary-color); }

.ed-dialog :deep(.p-dialog-content) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0;
}
.ed-dialog :deep(.p-tabview) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.ed-dialog :deep(.p-tabview-nav-container) {
  flex-shrink: 0;
}
.ed-dialog :deep(.p-tabview-nav) {
  background: var(--an-surface-elevated);
  border-bottom: 1px solid var(--an-border-light);
  padding: 0 1rem;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.ed-dialog :deep(.p-tabview-nav::-webkit-scrollbar) {
  display: none;
}
.ed-dialog :deep(.p-tabview-nav li) {
  flex-shrink: 0;
}
.ed-dialog :deep(.p-tabview-nav li .p-tabview-nav-link) {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0.875rem 0.75rem;
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--an-text-muted);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ed-dialog :deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
}
.ed-dialog :deep(.p-tabview-panels) {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  min-height: 0;
}

.ed-empty { text-align: center; padding: 32px 16px; color: var(--an-text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ed-asset-list { display: flex; flex-direction: column; gap: 2px; }
.ed-asset-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; transition: background 0.15s; }
.ed-asset-row:hover { background: var(--an-surface-elevated); }
.ed-sub { font-size: 12px; color: var(--an-text-muted); }
.ed-icon { font-size: 1.1rem; color: var(--an-text-subtle); }
.text-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-dialog :deep(.grid > [class*="col-"]) { min-width: 0; }
</style>
