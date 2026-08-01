<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableSort } from '../composables/useTableSort'
import type { ColumnDef } from '../composables/useTableColumns'
import ColumnPicker from '../components/ColumnPicker.vue'
import SortableHeader from '../components/SortableHeader.vue'

const { t } = useI18n()
interface KitItem { itemType: 'hardware' | 'peripheral' | 'license' | 'consumable'; category?: string; referenceId?: string; quantity: number }
interface Kit { _id: string; name: string; locationId?: { _id: string; name: string } | null; items: KitItem[]; notes?: string; createdAt: string }
interface Employee { _id: string; firstName: string; lastName: string; fullName: string }
interface Location { _id: string; name: string }

const items = ref<Kit[]>([])
const employees = ref<Employee[]>([])
const locations = ref<Location[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const search = ref('')
const dialog = ref(false)
const deleteDialog = ref(false)
const deployDialog = ref(false)
const saving = ref(false)
const deploying = ref(false)
const editingItem = ref<Kit | null>(null)
const deletingItem = ref<Kit | null>(null)
const deployingKit = ref<Kit | null>(null)
const deployEmployeeId = ref('')
const ITEM_TYPES = [{ label: 'Hardware', value: 'hardware' }, { label: 'Peripheral', value: 'peripheral' }, { label: 'License', value: 'license' }, { label: 'Consumable', value: 'consumable' }]
const form = ref<{ name: string; locationId: string; items: KitItem[]; notes: string }>({ name: '', locationId: '', items: [], notes: '' })
const locationOptions = computed(() => locations.value.map(l => ({ label: l.name, value: l._id })))
const employeeOptions = computed(() => employees.value.filter((e: any) => e.isActive !== false).map(e => ({ label: e.fullName, value: e._id })))
const filtered = computed(() => {
  let data = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    data = data.filter(k => k.name.toLowerCase().includes(q) || k.notes?.toLowerCase().includes(q))
  }
  return data
})


const kitColumns: ColumnDef[] = [
  { key: 'name', label: t('kits.name'), default: true },
  { key: 'location', label: t('kits.location'), default: true },
  { key: 'itemsCount', label: t('kits.itemsCount'), default: true },
  { key: 'createdAt', label: t('common.createdAt'), default: false, format: 'date' },
  { key: 'notes', label: t('kits.notes'), default: true },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('kits', kitColumns)

function getCellValue(item: Kit, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'location': return item.locationId?.name || '—'
    case 'itemsCount': return String(item.items?.length || 0)
    case 'createdAt': return new Date(item.createdAt).toLocaleDateString('de-DE')
    case 'notes': return item.notes || '—'
    default: return '—'
  }
}
const { sortKey, sortDir, toggleSort, sorted } = useTableSort(filtered, kitColumns, getCellValue)

async function fetchItems() {
  loading.value = true; error.value = null
  try { const [k, e, l] = await Promise.all([api.get('/kits'), api.get('/employees'), api.get('/locations')]); items.value = k.data; employees.value = e.data; locations.value = l.data }
  catch { error.value = t('kits.loadError') } finally { loading.value = false }
}
function openCreate() { editingItem.value = null; form.value = { name: '', locationId: '', items: [], notes: '' }; dialog.value = true }
function openEdit(kit: Kit) { editingItem.value = kit; form.value = { name: kit.name, locationId: (kit.locationId as any)?._id || '', items: [...kit.items], notes: kit.notes || '' }; dialog.value = true }
function addKitItem() { form.value.items.push({ itemType: 'hardware', category: '', quantity: 1 }) }
function removeKitItem(idx: number) { form.value.items.splice(idx, 1) }
function confirmDelete(kit: Kit) { deletingItem.value = kit; deleteDialog.value = true }
function openDeploy(kit: Kit) { deployingKit.value = kit; deployEmployeeId.value = ''; deployDialog.value = true }
async function save() {
  saving.value = true; error.value = null
  try { const p: any = { name: form.value.name, items: form.value.items, notes: form.value.notes || undefined, locationId: form.value.locationId || null }; if (editingItem.value) await api.patch(`/kits/${editingItem.value._id}`, p); else await api.post('/kits', p); dialog.value = false; await fetchItems() }
  catch (e: any) { error.value = e?.response?.data?.error || t('kits.saveError') } finally { saving.value = false }
}
async function deleteItem() { if (!deletingItem.value) return; try { await api.delete(`/kits/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await fetchItems() } catch { error.value = t('kits.deleteError') } }
async function cloneKit(kit: Kit) { try { await api.post(`/kits/${kit._id}/clone`); await fetchItems() } catch { error.value = t('kits.cloneError') } }
async function deployKit() {
  if (!deployingKit.value || !deployEmployeeId.value) return; deploying.value = true; error.value = null
  try { const r = await api.post(`/kits/${deployingKit.value._id}/deploy`, { employeeId: deployEmployeeId.value }); deployDialog.value = false; const emp = employees.value.find(e => e._id === deployEmployeeId.value); alert(`Kit deployed: ${r.data.hardwareAssigned} hardware, ${r.data.peripheralsAssigned} peripherals assigned to ${emp?.fullName || 'employee'}`); await fetchItems() }
  catch (e: any) { error.value = e?.response?.data?.error || t('kits.deployError'); if (e?.response?.data?.details) error.value += ': ' + e.response.data.details.join(', ') }
  finally { deploying.value = false }
}
onMounted(fetchItems)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing:-0.02em;">{{ t('kits.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-subtle);font-size:14px;">{{ t('kits.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button severity="primary" icon="pi pi-plus" :label="t('kits.add')" class="btn-glow-primary" @click="openCreate" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="search" :placeholder="t('kits.search')" class="an-search-input" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead><tr>
            <template v-for="col in visibleColumns" :key="col.key">

              <SortableHeader v-if="col.key !== '_actions'" :col="col" :sort-key="sortKey" :sort-dir="sortDir" @sort="toggleSort" />

              <th v-else style="text-align:right;width:180px;">{{ t('common.actions') }}</th>

            </template>
          </tr>
          </thead>
          <tbody>
            <tr v-for="kit in sorted" :key="kit._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;width:180px;">
                <Button icon="pi pi-send" text size="small" rounded severity="success" :title="t('kits.deploy')" @click="openDeploy(kit)" />
                <Button icon="pi pi-copy" text size="small" rounded :title="t('kits.clone')" @click="cloneKit(kit)" />
                <Button icon="pi pi-pencil" text size="small" rounded @click="openEdit(kit)" />
                <Button icon="pi pi-history" text size="small" rounded severity="secondary" @click="historyEntityId = kit._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" text size="small" rounded severity="danger" @click="confirmDelete(kit)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'"><span class="font-bold">{{ kit.name }}</span></template>
                <template v-else-if="col.key === 'location'">{{ kit.locationId?.name || '—' }}</template>
                <template v-else-if="col.key === 'itemsCount'"><Tag :value="(kit.items?.length || 0) + ' ' + t('kits.items')" severity="primary" /></template>
                <template v-else-if="col.key === 'createdAt'">{{ new Date(kit.createdAt).toLocaleDateString('de-DE') }}</template>
                <template v-else-if="col.key === 'notes'"><span v-if="kit.notes" style="max-width:220px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :title="kit.notes">{{ kit.notes }}</span><span v-else style="color:var(--an-text-muted);">—</span></template>
                <template v-else>—</template>
              </td>
              </template>
            </tr>
            <tr v-if="sorted.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ t('common.noData') }}</td></tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editingItem ? t('kits.edit') : t('kits.add')" :style="{width:'700px'}" modal>
        <div class="flex flex-column gap-3">
          <div><label>{{ t('kits.name') }}</label><InputText v-model="form.name" class="w-full mt-2" /></div>
          <div><label>{{ t('kits.location') }}</label><Select v-model="form.locationId" :options="locationOptions" optionLabel="label" optionValue="value" class="w-full mt-2" showClear /></div>
          <div class="font-bold mt-2">{{ t('kits.contents') }}</div>
          <div v-for="(ki, idx) in form.items" :key="idx" class="flex gap-2 align-items-center" style="border:1px solid var(--an-border-dark);border-radius:var(--radius-md);padding:8px;">
            <Select v-model="ki.itemType" :options="ITEM_TYPES" optionLabel="label" optionValue="value" style="width:140px;" />
            <InputText v-model="ki.category" :placeholder="t('kits.category')" style="flex:1;" />
            <InputNumber v-model="ki.quantity" :min="1" class="w-full" :inputStyle="{ width: '80px' }" />
            <Button icon="pi pi-times" text size="small" severity="danger" @click="removeKitItem(idx)" />
          </div>
          <Button outlined size="small" icon="pi pi-plus" :label="t('kits.addItem')" @click="addKitItem" />
          <div><label>{{ t('kits.notes') }}</label><Textarea v-model="form.notes" rows="2" class="w-full mt-2" /></div>
        </div>
        <template #footer>
          <Button :label="t('common.cancel')" text @click="dialog = false" />
          <Button :label="t('common.save')" severity="primary" :loading="saving" :disabled="!form.name" @click="save" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deployDialog" :header="t('kits.deployTitle')" :style="{width:'480px'}" modal>
        <p class="mb-3">{{ t('kits.deployMessage', { name: deployingKit?.name }) }}</p>
        <Select v-model="deployEmployeeId" :options="employeeOptions" optionLabel="label" optionValue="value" class="w-full" />
        <template #footer>
          <Button :label="t('common.cancel')" text @click="deployDialog = false" />
          <Button :label="t('kits.deploy')" severity="success" :loading="deploying" :disabled="!deployEmployeeId" @click="deployKit" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="t('kits.deleteConfirm')" :style="{width:'400px'}" modal>
        <p>{{ t('kits.deleteMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="t('common.delete')" severity="danger" @click="deleteItem" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Kit" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

