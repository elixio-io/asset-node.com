<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useFormatters } from '../composables/useFormatters'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import EntityFormDialog from '../components/EntityFormDialog.vue'
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

interface Consumable {
  _id: string
  name: string
  categoryId?: { _id: string; name: string } | null
  manufacturerId?: { _id: string; name: string } | null
  modelNumber?: string
  totalQuantity: number
  minimumQuantity: number
  isLowStock: boolean
  unitCost: number
  supplierId?: { _id: string; name: string } | null
  isActive: boolean
}

const consumables = ref<Consumable[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showAddDialog = ref(false)
const newConsumable = ref({
  name: '', categoryId: '' as string, manufacturerId: '' as string, modelNumber: '', totalQuantity: 0, minimumQuantity: 5, unitCost: 0, supplierId: '' as string, notes: ''
})
const saving = ref(false)
const showEditDialog = ref(false)
const deleteDialog = ref(false)
const deletingItem = ref<Consumable | null>(null)
const editConsumable = ref({
  _id: '', name: '', categoryId: '' as string, manufacturerId: '' as string, modelNumber: '', totalQuantity: 0, minimumQuantity: 5, unitCost: 0, supplierId: '' as string, notes: ''
})
const summary = ref<{ totalItems: number; totalValue: number; lowStockCount: number } | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const categoryOptions = ref<{ _id: string; name: string }[]>([])
const manufacturerOptions = ref<{ _id: string; name: string }[]>([])
const supplierOptions = ref<{ _id: string; name: string }[]>([])

const consumableColumns: ColumnDef[] = [
  { key: 'name', label: t('common.name'), default: true },
  { key: 'categoryId', label: t('common.type'), default: true },
  { key: 'manufacturerId', label: t('hardware.manufacturer'), default: true },
  { key: 'modelNumber', label: t('hardware.model'), default: false },
  { key: 'totalQuantity', label: t('common.quantity'), default: true },
  { key: 'minimumQuantity', label: t('common.minQty'), default: true },
  { key: 'unitCost', label: t('common.unitCost'), default: true, format: 'currency' },
  { key: 'supplierId', label: t('common.supplier'), default: false },
  { key: 'notes', label: t('common.notes'), default: false },
  { key: 'isActive', label: t('common.status'), default: true, format: 'tag' },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('consumables', consumableColumns)



const { fmtCurrency: formatCurrency } = useFormatters()

function getCellValue(item: Consumable, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'categoryId': return translateCategoryName(item.categoryId)
    case 'manufacturerId': return item.manufacturerId?.name || '—'
    case 'modelNumber': return item.modelNumber || '—'
    case 'totalQuantity': return String(item.totalQuantity)
    case 'minimumQuantity': return String(item.minimumQuantity)
    case 'unitCost': return formatCurrency(item.unitCost)
    case 'supplierId': return item.supplierId?.name || '—'
    case 'notes': return '—'
    default: return '—'
  }
}
const { sortKey, sortDir, toggleSort, sorted: sortedConsumables } = useTableSort(consumables, consumableColumns, getCellValue)

async function fetchConsumables() {
  loading.value = true; error.value = null
  try {
    const [listRes, summaryRes] = await Promise.all([
      api.get('/consumables', { params: searchQuery.value ? { search: searchQuery.value } : {} }),
      api.get('/consumables/summary/stats')
    ])
    consumables.value = listRes.data
    const s = summaryRes.data
    summary.value = {
      totalItems: s.totalItems || 0,
      totalValue: s.totalValue || 0,
      lowStockCount: s.lowStockAlerts || 0
    }
  } catch (err) { error.value = 'Failed to load consumables' }
  finally { loading.value = false }
}

async function fetchLookups() {
  try {
    const [catRes, mfgRes, supRes] = await Promise.all([
      api.get('/categories', { params: { entityType: 'consumable' } }),
      api.get('/manufacturers'),
      api.get('/suppliers')
    ])
    categoryOptions.value = catRes.data
    manufacturerOptions.value = mfgRes.data
    supplierOptions.value = supRes.data
  } catch {  console.warn('[Consumables] Failed to load lookup data') }
}

const showCheckoutDialog = ref(false)
const checkoutItem = ref<Consumable | null>(null)
const employees = ref<{ label: string; value: string }[]>([])
const checkoutForm = ref({ employeeId: '', quantity: 1, notes: '' })

async function addConsumable() {
  saving.value = true
  try {
    const payload: Record<string, unknown> = { ...newConsumable.value }
    if (!payload.categoryId) delete payload.categoryId
    if (!payload.manufacturerId) delete payload.manufacturerId
    if (!payload.supplierId) delete payload.supplierId
    await api.post('/consumables', payload)
    showAddDialog.value = false
    newConsumable.value = { name: '', categoryId: '', manufacturerId: '', modelNumber: '', totalQuantity: 0, minimumQuantity: 5, unitCost: 0, supplierId: '', notes: '' }
    await fetchConsumables()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to add consumable' }
  finally { saving.value = false }
}

function confirmDelete(item: Consumable) { deletingItem.value = item; deleteDialog.value = true }
async function deleteConsumable() {
  if (!deletingItem.value) return
  try { await api.delete(`/consumables/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await fetchConsumables() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Failed to delete consumable' }
}

function openEditConsumable(item: Consumable) {
  editConsumable.value = {
    _id: item._id, name: item.name,
    categoryId: item.categoryId?._id || '',
    manufacturerId: item.manufacturerId?._id || '',
    modelNumber: item.modelNumber || '',
    totalQuantity: item.totalQuantity, minimumQuantity: item.minimumQuantity,
    unitCost: item.unitCost, supplierId: item.supplierId?._id || '', notes: ''
  }
  showEditDialog.value = true
}

async function saveEditConsumable() {
  saving.value = true
  try {
    const { _id, ...data } = editConsumable.value
    const payload: Record<string, unknown> = { ...data }
    if (!payload.categoryId) delete payload.categoryId
    if (!payload.manufacturerId) delete payload.manufacturerId
    if (!payload.supplierId) delete payload.supplierId
    await api.put(`/consumables/${_id}`, payload)
    showEditDialog.value = false
    await fetchConsumables()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to update consumable' }
  finally { saving.value = false }
}

async function fetchEmployees() {
  try {
    const res = await api.get('/employees')
    employees.value = res.data.map((e: { _id: string; firstName: string; lastName: string }) => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
  } catch {  console.warn('[Consumables] Failed to load employees') }
}

function openCheckout(item: Consumable) {
  checkoutItem.value = item
  checkoutForm.value = { employeeId: '', quantity: 1, notes: '' }
  showCheckoutDialog.value = true
}

async function submitCheckout() {
  if (!checkoutItem.value || !checkoutForm.value.employeeId) return
  saving.value = true
  try {
    await api.post(`/consumables/${checkoutItem.value._id}/checkout`, {
      employeeId: checkoutForm.value.employeeId,
      quantity: checkoutForm.value.quantity,
      notes: checkoutForm.value.notes || undefined
    })
    showCheckoutDialog.value = false
    await fetchConsumables()
  } catch (err: any) {
    error.value = err?.response?.data?.error || t('consumables.checkoutError')
  } finally { saving.value = false }
}

onMounted(() => { fetchConsumables(); fetchEmployees(); fetchLookups() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing: -0.02em;">{{ $t('consumables.title') }}</h1>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">{{ $t('consumables.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('consumables.addConsumable')" class="btn-glow-primary" @click="showAddDialog = true" />
        </div>
      </div>

      <div v-if="summary" class="kpi-grid mb-4">
        <div class="kpi-card">
          <div class="kpi-icon-bg" style="background: rgba(255,255,255,0.12);"><i class="pi pi-box" style="font-size: 1.25rem;"></i></div>
          <div><div class="kpi-value">{{ summary.totalItems }}</div><div class="kpi-label">{{ $t('consumables.totalItems') }}</div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-bg" style="background: rgba(59,130,246,0.12);"><i class="pi pi-dollar" style="font-size: 1.25rem;"></i></div>
          <div><div class="kpi-value">{{ formatCurrency(summary.totalValue) }}</div><div class="kpi-label">{{ $t('consumables.totalValue') }}</div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-bg" style="background: rgba(245,158,11,0.12);"><i class="pi pi-exclamation-circle" style="font-size: 1.25rem;"></i></div>
          <div><div class="kpi-value">{{ summary.lowStockCount }}</div><div class="kpi-label">{{ $t('consumables.lowStockAlerts') }}</div></div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('consumables.searchPlaceholder')" class="an-search-input" @update:modelValue="fetchConsumables" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
      </div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead><tr>
            <template v-for="col in visibleColumns" :key="col.key">
              <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
              <th v-else style="text-align:right;width:60px;"><i class="pi pi-cog" v-tooltip.top="$t('common.actions')"></i></th>
            </template>
          </tr>

          </thead>
          <tbody>
            <tr v-for="item in sortedConsumables" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">
              <td v-if="col.key === '_actions'" style="text-align: right; white-space: nowrap;" :data-label="$t('common.actions')">
                <Button v-if="isManager" icon="pi pi-sign-out" size="small" text rounded severity="success" v-tooltip.top="t('consumables.checkout')" @click="openCheckout(item)" class="mr-1" />
                <Button v-if="isManager" icon="pi pi-pencil" size="small" text rounded severity="primary" @click="openEditConsumable(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'">
                  <div class="font-bold">{{ item.name }}</div>
                </template>
                <template v-else-if="col.key === 'isActive'">
                  <Tag :value="item.isLowStock ? $t('common.lowStock') : $t('common.inStock')" :severity="item.isLowStock ? 'warn' : 'success'" />
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="consumables.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td></tr>
          </tbody>
        </table>
      </div>

      <EntityFormDialog
        v-model:visible="showAddDialog"
        :header="$t('consumables.addConsumable')"
        width="680px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        @save="addConsumable"
      >
        <div class="dialog-form">
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">{{ $t('common.name') }} <span class="required">*</span></label>
              <InputText v-model="newConsumable.name" class="w-full" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('common.category') }}</label>
              <QuickCreateSelect v-model="newConsumable.categoryId" :options="categoryOptions" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'consumable' }" class="w-full" @created="fetchLookups" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('hardware.manufacturer') }}</label>
              <QuickCreateSelect v-model="newConsumable.manufacturerId" :options="manufacturerOptions" createEndpoint="/manufacturers" :entityLabel="$t('common.manufacturer')" class="w-full" @created="fetchLookups" />
            </div>
          </div>
          <div class="form-row three-col">
            <div class="form-group">
              <label class="form-label">{{ $t('common.quantity') }}</label>
              <InputNumber v-model="newConsumable.totalQuantity" :min="0" class="w-full" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('common.minQty') }}</label>
              <InputNumber v-model="newConsumable.minimumQuantity" :min="0" class="w-full" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('common.unitCost') }}</label>
              <InputNumber v-model="newConsumable.unitCost" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('common.supplier') }}</label>
              <QuickCreateSelect v-model="newConsumable.supplierId" :options="supplierOptions" createEndpoint="/suppliers" :entityLabel="$t('common.supplier')" class="w-full" @created="fetchLookups" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('hardware.model') }}</label>
              <InputText v-model="newConsumable.modelNumber" class="w-full" :placeholder="$t('common.optional')" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">{{ $t('common.notes') }}</label>
              <Textarea v-model="newConsumable.notes" rows="2" class="w-full" />
            </div>
          </div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        v-model:visible="showEditDialog"
        :header="$t('consumables.editConsumable')"
        width="680px"
        :saveLabel="$t('common.save')"
        :loading="saving"
        @save="saveEditConsumable"
      >
        <div class="dialog-form">
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">{{ $t('common.name') }} <span class="required">*</span></label>
              <InputText v-model="editConsumable.name" class="w-full" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('common.category') }}</label>
              <QuickCreateSelect v-model="editConsumable.categoryId" :options="categoryOptions" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'consumable' }" class="w-full" @created="fetchLookups" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('hardware.manufacturer') }}</label>
              <QuickCreateSelect v-model="editConsumable.manufacturerId" :options="manufacturerOptions" createEndpoint="/manufacturers" :entityLabel="$t('common.manufacturer')" class="w-full" @created="fetchLookups" />
            </div>
          </div>
          <div class="form-row three-col">
            <div class="form-group">
              <label class="form-label">{{ $t('common.quantity') }}</label>
              <InputNumber v-model="editConsumable.totalQuantity" :min="0" class="w-full" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('common.minQty') }}</label>
              <InputNumber v-model="editConsumable.minimumQuantity" :min="0" class="w-full" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('common.unitCost') }}</label>
              <InputNumber v-model="editConsumable.unitCost" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('common.supplier') }}</label>
              <QuickCreateSelect v-model="editConsumable.supplierId" :options="supplierOptions" createEndpoint="/suppliers" :entityLabel="$t('common.supplier')" class="w-full" @created="fetchLookups" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('hardware.model') }}</label>
              <InputText v-model="editConsumable.modelNumber" class="w-full" :placeholder="$t('common.optional')" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">{{ $t('common.notes') }}</label>
              <Textarea v-model="editConsumable.notes" rows="2" class="w-full" />
            </div>
          </div>
        </div>
      </EntityFormDialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteConsumable" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Consumable" :entityId="historyEntityId" />
      </Dialog>

      <EntityFormDialog
        v-model:visible="showCheckoutDialog"
        :header="t('consumables.checkout') + ': ' + (checkoutItem?.name || '')"
        width="450px"
        :saveLabel="t('consumables.checkout')"
        saveIcon="pi pi-sign-out"
        saveSeverity="success"
        :loading="saving"
        :disabled="!checkoutForm.employeeId || checkoutForm.quantity < 1"
        @save="submitCheckout"
      >
        <div class="flex flex-column gap-3">
          <div>
            <label>{{ $t('common.employee') }}</label>
            <Select v-model="checkoutForm.employeeId" :options="employees" optionLabel="label" optionValue="value" :placeholder="$t('common.selectEmployee')" filter class="w-full mt-2" />
          </div>
          <div>
            <label>{{ $t('common.quantity') }}</label>
            <InputNumber v-model="checkoutForm.quantity" :min="1" :max="checkoutItem?.totalQuantity || 999" class="w-full mt-2" />
          </div>
          <div>
            <label>{{ $t('common.notes') }}</label>
            <Textarea v-model="checkoutForm.notes" rows="2" class="w-full mt-2" />
          </div>
          <Message v-if="checkoutItem" severity="info" :closable="false">
            {{ t('consumables.currentStock') }}: {{ checkoutItem.totalQuantity }}
          </Message>
        </div>
      </EntityFormDialog>
    </div>
  </div>
</template>

<style scoped>

.kpi-grid { grid-template-columns: repeat(3, 1fr); }
.kpi-card { display: flex; align-items: center; gap: 16px; }
.kpi-icon-bg { width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }


.dialog-form { display: flex; flex-direction: column; gap: 16px; padding-top: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-row.three-col { grid-template-columns: 1fr 1fr 1fr; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-group.full-width { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 600; color: var(--an-text-subtle, #a0a0a0); }
.required { color: #ef4444; }
</style>
