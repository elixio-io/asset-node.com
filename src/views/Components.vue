<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import EntityFormDialog from '../components/EntityFormDialog.vue'
import ChangeHistory from '../components/ChangeHistory.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'
import { useCategoryTranslation } from '../composables/useEntityTranslation'

const { t } = useI18n()
const { translateCategoryName } = useCategoryTranslation()

interface ComponentItem {
  _id: string
  name: string
  categoryId?: { _id: string; name: string } | null
  serialNumber?: string
  manufacturerId?: { _id: string; name: string } | null
  model?: string
  hardwareId?: { _id: string; serialNumber?: string; model?: string } | null
  installedAt?: string
  purchasePrice?: number
  status: string
}

interface HardwareItem {
  _id: string
  serialNumber: string
  model: string
}

const categoryOptions = ref<{ _id: string; name: string }[]>([])

const items = ref<ComponentItem[]>([])
const hardwareList = ref<HardwareItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const search = ref('')
const dialog = ref(false)
const deleteDialog = ref(false)
const attachDialog = ref(false)
const saving = ref(false)
const editingItem = ref<ComponentItem | null>(null)
const deletingItem = ref<ComponentItem | null>(null)
const attachingItem = ref<ComponentItem | null>(null)
const attachHardwareId = ref('')
const manufacturers = ref<{ _id: string; name: string }[]>([])

const form = ref({
  name: '', categoryId: '' as string, serialNumber: '', manufacturerId: '' as string, model: '',
  purchasePrice: 0, notes: '', status: 'available'
})

const filtered = computed(() => {
  let data = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    data = data.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.categoryId?.name?.toLowerCase().includes(q) ||
      c.serialNumber?.toLowerCase().includes(q) ||
      c.manufacturerId?.name?.toLowerCase().includes(q)
    )
  }
  return data
})


const statusSeverityMap: Record<string, string> = {
  installed: 'success', available: 'info', defective: 'danger'
}

const componentColumns: ColumnDef[] = [
  { key: 'name', label: t('components.name'), default: true },
  { key: 'categoryId', label: t('components.type'), default: true },
  { key: 'serialNumber', label: t('components.serial'), default: true },
  { key: 'manufacturerId', label: t('hardware.manufacturer'), default: false },
  { key: 'model', label: t('hardware.model'), default: false },
  { key: 'hardwareId', label: t('components.installedIn'), default: true },
  { key: 'purchasePrice', label: t('components.price'), default: false, format: 'currency' },
  { key: 'status', label: t('components.status'), default: true, format: 'tag' },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('components', componentColumns)

function getCellValue(item: ComponentItem, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'categoryId': return translateCategoryName(item.categoryId)
    case 'serialNumber': return item.serialNumber || '—'
    case 'manufacturerId': return item.manufacturerId?.name || '—'
    case 'model': return item.model || '—'
    case 'hardwareId': return item.hardwareId ? `${item.hardwareId.serialNumber || item.hardwareId.model}` : '—'
    case 'purchasePrice': return item.purchasePrice ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.purchasePrice) : '—'
    default: return '—'
  }
}
const { sortKey, sortDir, toggleSort, sorted } = useTableSort(filtered, componentColumns, getCellValue)

const hardwareOptions = computed(() => hardwareList.value.map(h => ({
  label: `${h.serialNumber} — ${h.model}`,
  value: h._id
})))

async function fetchItems() {
  loading.value = true
  try {
    const [compRes, hwRes] = await Promise.all([
      api.get('/components'),
      api.get('/hardware')
    ])
    items.value = compRes.data
    hardwareList.value = hwRes.data
  } catch { error.value = t('components.loadError') }
  finally { loading.value = false }
}

async function fetchLookups() {
  try {
    const [mfgRes, catRes] = await Promise.all([
      api.get('/manufacturers'),
      api.get('/categories', { params: { entityType: 'component' } })
    ])
    manufacturers.value = mfgRes.data
    categoryOptions.value = catRes.data
  } catch {  console.warn('[Components] Failed to load lookup data') }
}

function openCreate() {
  editingItem.value = null
  form.value = { name: '', categoryId: '', serialNumber: '', manufacturerId: '', model: '', purchasePrice: 0, notes: '', status: 'available' }
  dialog.value = true
}

function openEdit(item: ComponentItem) {
  editingItem.value = item
  form.value = {
    name: item.name, categoryId: item.categoryId?._id || '', serialNumber: item.serialNumber || '',
    manufacturerId: item.manufacturerId?._id || '', model: item.model || '',
    purchasePrice: item.purchasePrice || 0, notes: '', status: item.status || 'available'
  }
  dialog.value = true
}

function confirmDelete(item: ComponentItem) { deletingItem.value = item; deleteDialog.value = true }

function openAttach(item: ComponentItem) {
  attachingItem.value = item
  attachHardwareId.value = ''
  attachDialog.value = true
}

async function save() {
  saving.value = true
  error.value = null
  try {
    const payload: Record<string, unknown> = { ...form.value }
    if (!payload.categoryId) delete payload.categoryId
    if (!payload.manufacturerId) delete payload.manufacturerId
    if (editingItem.value) {
      await api.patch(`/components/${editingItem.value._id}`, payload)
    } else {
      await api.post('/components', payload)
    }
    dialog.value = false
    await fetchItems()
  } catch (err: any) {
    error.value = err?.response?.data?.error || t('components.saveError')
  } finally { saving.value = false }
}

async function deleteItem() {
  if (!deletingItem.value) return
  try {
    await api.delete(`/components/${deletingItem.value._id}`)
    deleteDialog.value = false
    await fetchItems()
  } catch { error.value = t('components.deleteError') }
}

async function attachComponent() {
  if (!attachingItem.value || !attachHardwareId.value) return
  try {
    await api.post(`/components/${attachingItem.value._id}/attach`, { hardwareId: attachHardwareId.value })
    attachDialog.value = false
    await fetchItems()
  } catch (err: any) {
    error.value = err?.response?.data?.error || t('components.attachError')
  }
}

async function detachComponent(item: ComponentItem) {
  try {
    await api.post(`/components/${item._id}/detach`)
    await fetchItems()
  } catch (err: any) {
    error.value = err?.response?.data?.error || t('components.detachError')
  }
}

onMounted(() => { fetchItems(); fetchLookups() })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing: -0.02em;">{{ t('components.title') }}</h1>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">{{ t('components.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button severity="primary" icon="pi pi-plus" :label="t('components.add')" class="btn-glow-primary" @click="openCreate" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="search" :placeholder="t('components.search')" class="an-search-input" />
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

              <th v-else style="text-align: right; width: 160px;">{{ t('common.actions') }}</th>

            </template>
          </tr>

          </thead>
          <tbody>
            <tr v-for="item in sorted" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align: right; white-space: nowrap;" :data-label="$t('common.actions')">
                <Button v-if="item.status === 'available'" icon="pi pi-link" text rounded size="small" severity="success" v-tooltip="t('components.attach')" @click="openAttach(item)" />
                <Button v-if="item.status === 'installed'" icon="pi pi-times" text rounded size="small" severity="warn" v-tooltip="t('components.detach')" @click="detachComponent(item)" />
                <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(item)" />
                <Button icon="pi pi-history" text rounded size="small" severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'"><span class="font-bold">{{ item.name }}</span></template>
                <template v-else-if="col.key === 'categoryId'"><Tag :value="translateCategoryName(item.categoryId)" severity="secondary" /></template>
                <template v-else-if="col.key === 'status'"><Tag :value="t(`status.${item.status}`, item.status)" :severity="(statusSeverityMap[item.status] as any) || 'secondary'" /></template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="sorted.length === 0">
              <td :colspan="visibleColumns.length" class="text-center p-4" style="color: var(--an-text-muted);">{{ t('components.noResults') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <EntityFormDialog
        v-model:visible="dialog"
        :header="editingItem ? t('components.edit') : t('components.add')"
        width="600px"
        :saveLabel="t('common.save')"
        :loading="saving"
        :disabled="!form.name"
        @save="save"
      >
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label>{{ t('components.name') }}</label>
            <InputText v-model="form.name" class="w-full" />
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ t('components.type') }}</label>
            <QuickCreateSelect v-model="form.categoryId" :options="categoryOptions" createEndpoint="/categories" :entityLabel="$t('common.category')" :extraFields="{ entityType: 'component' }" class="w-full" @created="fetchLookups" />
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ t('components.serial') }}</label>
            <InputText v-model="form.serialNumber" class="w-full" />
          </div>
          <div class="grid">
            <div class="col-6">
              <label>{{ t('components.manufacturer') }}</label>
              <QuickCreateSelect v-model="form.manufacturerId" :options="manufacturers" createEndpoint="/manufacturers" :entityLabel="$t('common.manufacturer')" class="w-full mt-2" @created="fetchLookups" />
            </div>
            <div class="col-6">
              <label>{{ t('components.model') }}</label>
              <InputText v-model="form.model" class="w-full mt-2" />
            </div>
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ t('components.price') }}</label>
            <InputNumber v-model="form.purchasePrice" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
          <div v-if="editingItem" class="flex flex-column gap-2">
            <label>{{ t('common.status') }}</label>
            <Select v-model="form.status" :options="['available', 'installed', 'defective'].map(s => ({ label: t(`status.${s}`, s), value: s }))" optionLabel="label" optionValue="value" class="w-full" />
          </div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        v-model:visible="attachDialog"
        :header="t('components.attachTitle')"
        width="480px"
        :saveLabel="t('components.attach')"
        saveSeverity="success"
        :disabled="!attachHardwareId"
        @save="attachComponent"
      >
        <p class="mb-3">{{ t('components.attachMessage', { name: attachingItem?.name }) }}</p>
        <Select v-model="attachHardwareId" :options="hardwareOptions" optionLabel="label" optionValue="value" :placeholder="t('components.selectHardware')" class="w-full" />
      </EntityFormDialog>

      <Dialog v-model:visible="deleteDialog" :header="t('components.deleteConfirm')" :style="{ width: '400px' }" modal>
        <p>{{ t('components.deleteMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="t('common.delete')" severity="danger" @click="deleteItem" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Component" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

