<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from './ColumnPicker.vue'
import SortableHeader from './SortableHeader.vue'
import ChangeHistory from './ChangeHistory.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

export interface FormField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'email' | 'url' | 'number'
  required?: boolean
  path?: string
}

interface CellRenderer {
  type: 'link' | 'mailto' | 'tag' | 'bold' | 'icon-bold'
  icon?: string
  severity?: (val: any) => string
  tagLabel?: (val: any) => string
}

export interface CrudColumnDef extends ColumnDef {
  render?: CellRenderer
  searchable?: boolean
}

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  apiEndpoint: string
  columns: CrudColumnDef[]
  formFields: FormField[]
  entityType: string
  storageKey: string
  addLabel: string
  searchPlaceholder: string
  noDataMessage?: string
  addDialogTitle?: string
  editDialogTitle?: string
  deleteDialogTitle?: string
  deleteDialogMessage?: (name: string) => string
}>(), {
  subtitle: '',
  noDataMessage: '',
  addDialogTitle: undefined,
  editDialogTitle: undefined,
  deleteDialogTitle: undefined,
  deleteDialogMessage: undefined,
})

const emit = defineEmits<{
  (e: 'loaded', items: any[]): void
}>()

const { t } = useI18n()

const items = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const dialog = ref(false)
const deleteDialog = ref(false)
const saving = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const form = ref<Record<string, any>>({})
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const columnDefs = computed<ColumnDef[]>(() => props.columns.map(c => ({
  key: c.key,
  label: c.label,
  default: c.default,
  format: c.format,
})))

const { visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns(props.storageKey, columnDefs.value)

function getCellValue(item: any, key: string): string {
  const col = props.columns.find(c => c.key === key)
  if (!col) return '—'
  const val = key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], item) : item[key]
  if (val === undefined || val === null || val === '') return '—'
  if (col.format === 'date') return new Date(val).toLocaleDateString('de-DE')
  if (typeof val === 'object' && val !== null && 'name' in val && val.name) return String(val.name)
  if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '—'
  return String(val)
}

const filtered = computed(() => {
  let data = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    const searchableKeys = props.columns.filter(c => c.searchable !== false).map(c => c.key)
    data = data.filter(item =>
      searchableKeys.some(key => {
        const val = key.includes('.') ? key.split('.').reduce((o: any, k: string) => o?.[k], item) : item[key]
        return val && String(val).toLowerCase().includes(q)
      })
    )
  }
  return data
})

const { sortKey, sortDir, toggleSort, sorted } = useTableSort(filtered, columnDefs.value, getCellValue)

function initForm() {
  const obj: Record<string, any> = {}
  for (const f of props.formFields) {
    obj[f.key] = f.type === 'number' ? 0 : ''
  }
  return obj
}

async function fetchItems() {
  loading.value = true; error.value = null
  try {
    items.value = (await api.get(props.apiEndpoint)).data
    emit('loaded', items.value)
  } catch {
    error.value = `Failed to load ${props.title.toLowerCase()}`
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingItem.value = null
  form.value = initForm()
  dialog.value = true
}

function openEdit(item: any) {
  editingItem.value = item
  const obj: Record<string, any> = {}
  for (const f of props.formFields) {
    if (f.path) {
      obj[f.key] = f.path.split('.').reduce((o: any, k: string) => o?.[k], item) || ''
    } else {
      obj[f.key] = item[f.key] || (f.type === 'number' ? 0 : '')
    }
  }
  form.value = obj
  dialog.value = true
}

function confirmDelete(item: any) {
  deletingItem.value = item
  deleteDialog.value = true
}

async function save() {
  saving.value = true; error.value = null
  try {
    const payload: Record<string, any> = {}
    for (const [k, v] of Object.entries(form.value)) {
      if (v !== '' && v !== null && v !== undefined) payload[k] = v
    }
    for (const f of props.formFields) {
      if (f.required && !(f.key in payload)) payload[f.key] = form.value[f.key]
    }
    if (editingItem.value) {
      await api.patch(`${props.apiEndpoint}/${editingItem.value._id}`, payload)
    } else {
      await api.post(props.apiEndpoint, payload)
    }
    dialog.value = false
    await fetchItems()
  } catch (err: any) {
    error.value = err?.response?.data?.error || `Failed to save`
  } finally {
    saving.value = false
  }
}

async function deleteItem() {
  if (!deletingItem.value) return
  try {
    await api.delete(`${props.apiEndpoint}/${deletingItem.value._id}`)
    deleteDialog.value = false
    deletingItem.value = null
    await fetchItems()
  } catch {
    error.value = `Failed to delete`
  }
}

function getCellRawValue(item: any, key: string): any {
  return key.includes('.') ? key.split('.').reduce((o: any, k: string) => o?.[k], item) : item[key]
}

onMounted(fetchItems)

defineExpose({ items, fetchItems, loading, error })
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ title }}</h1>
          <p v-if="subtitle" class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ subtitle }}</p>
        </div>
        <div class="flex gap-2 align-items-center">
          <ColumnPicker :allColumns="columnDefs" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button severity="primary" icon="pi pi-plus" :label="addLabel" @click="openCreate" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="search" :placeholder="searchPlaceholder" class="an-search-input" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <template v-for="col in visibleColumns" :key="col.key">
                <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />
                <th v-else style="text-align:right;width:120px;" v-tooltip.top="t('common.actions')">
                  <i class="pi pi-cog text-lg" style="color: var(--an-text-subtle);"></i>
                </th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sorted" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">
              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;">
                <Button icon="pi pi-pencil" text size="small" @click="openEdit(item)" class="mr-1" />
                <Button icon="pi pi-history" text size="small" severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" class="mr-1" />
                <Button icon="pi pi-trash" text size="small" severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else>
                <template v-if="columns.find(c => c.key === col.key)?.render?.type === 'bold' || columns.find(c => c.key === col.key)?.render?.type === 'icon-bold'">
                  <div class="flex align-items-center gap-2">
                    <i v-if="columns.find(c => c.key === col.key)?.render?.icon" :class="columns.find(c => c.key === col.key)?.render?.icon"></i>
                    <span class="font-bold">{{ getCellRawValue(item, col.key) }}</span>
                  </div>
                </template>
                <template v-else-if="columns.find(c => c.key === col.key)?.render?.type === 'link'">
                  <a v-if="getCellRawValue(item, col.key)" :href="getCellRawValue(item, col.key)" target="_blank" style="color:var(--p-primary-color);">{{ getCellRawValue(item, col.key) }}</a>
                  <span v-else style="color:var(--an-text-muted);">—</span>
                </template>
                <template v-else-if="columns.find(c => c.key === col.key)?.render?.type === 'mailto'">
                  <a v-if="getCellRawValue(item, col.key)" :href="`mailto:${getCellRawValue(item, col.key)}`" style="color:var(--p-primary-color);">{{ getCellRawValue(item, col.key) }}</a>
                  <span v-else style="color:var(--an-text-muted);">—</span>
                </template>
                <template v-else-if="columns.find(c => c.key === col.key)?.render?.type === 'tag'">
                  <Tag :value="columns.find(c => c.key === col.key)?.render?.tagLabel?.(getCellRawValue(item, col.key)) || getCellRawValue(item, col.key)" :severity="(columns.find(c => c.key === col.key)?.render?.severity?.(getCellRawValue(item, col.key)) as any) || 'info'" />
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="sorted.length === 0">
              <td :colspan="visibleColumns.length" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ noDataMessage || t('common.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editingItem ? (editDialogTitle || t('common.edit')) : (addDialogTitle || addLabel)" :style="{width:'560px'}" modal>
        <slot name="form" :form="form" :editing="editingItem">
          <div class="flex flex-column gap-3">
            <div v-for="field in formFields" :key="field.key">
              <label>{{ field.label }}</label>
              <Textarea v-if="field.type === 'textarea'" v-model="form[field.key]" rows="3" class="w-full mt-2" />
              <InputText v-else v-model="form[field.key]" class="w-full mt-2" :type="field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'" />
            </div>
          </div>
        </slot>
        <template #footer>
          <Button :label="t('common.cancel')" text @click="dialog = false" />
          <Button :label="t('common.save')" severity="primary" :loading="saving" :disabled="!form[formFields[0]?.key]" @click="save" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="deleteDialogTitle || t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ deleteDialogMessage ? deleteDialogMessage(deletingItem?.name || '') : t('common.deleteConfirmMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="t('common.delete')" severity="danger" @click="deleteItem" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" :entityType="entityType" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

