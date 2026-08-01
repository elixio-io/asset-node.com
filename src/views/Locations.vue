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
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()

interface Location {
  _id: string; name: string
  address?: { street?: string; city?: string; state?: string; zip?: string; country?: string }
  contactName?: string; contactEmail?: string; contactPhone?: string; isActive: boolean; createdAt: string
}

const locations = ref<Location[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const deleteDialog = ref(false)
const deletingItem = ref<Location | null>(null)
const saving = ref(false)
const newLocation = ref({ name: '', address: { street: '', city: '', state: '', zip: '', country: '' }, contactName: '', contactEmail: '', contactPhone: '', isActive: true })
const editLocation = ref({ _id: '', name: '', address: { street: '', city: '', state: '', zip: '', country: '' }, contactName: '', contactEmail: '', contactPhone: '', isActive: true })
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)

const locationColumns: ColumnDef[] = [
  { key: 'name', label: t('common.name'), default: true },
  { key: 'street', label: t('common.street'), default: false },
  { key: 'city', label: t('locations.city'), default: true },
  { key: 'state', label: t('common.state'), default: false },
  { key: 'zip', label: t('common.zip'), default: false },
  { key: 'country', label: t('locations.country'), default: true },
  { key: 'contactName', label: t('locations.contactName'), default: true },
  { key: 'contactEmail', label: t('locations.contactEmail'), default: false },
  { key: 'contactPhone', label: t('locations.contactPhone'), default: false },
  { key: 'isActive', label: t('common.status'), default: true, format: 'tag' },
]
const { allColumns: enrichedColumns, visibleColumns, visibleKeys, toggleColumn, reorderColumns, isVisible, resetToDefaults } = useTableColumns('locations', locationColumns)

const filteredLocations = computed(() =>
  locations.value
)
const { sortKey, sortDir, toggleSort, sorted: sortedLocations } = useTableSort(filteredLocations, locationColumns, getCellValue)

function getCellValue(item: Location, key: string): string {
  switch (key) {
    case 'name': return item.name
    case 'street': return item.address?.street || '—'
    case 'city': return item.address?.city || '—'
    case 'state': return item.address?.state || '—'
    case 'zip': return item.address?.zip || '—'
    case 'country': return item.address?.country || '—'
    case 'contactName': return item.contactName || '—'
    case 'contactEmail': return item.contactEmail || '—'
    case 'contactPhone': return item.contactPhone || '—'
    default: return '—'
  }
}

async function fetchLocations() {
  loading.value = true; error.value = null
  try { locations.value = (await api.get('/locations')).data } catch { error.value = 'Failed to load locations' } finally { loading.value = false }
}
async function addLocation() {
  saving.value = true
  try { await api.post('/locations', newLocation.value); showAddDialog.value = false; newLocation.value = { name: '', address: { street: '', city: '', state: '', zip: '', country: '' }, contactName: '', contactEmail: '', contactPhone: '', isActive: true }; await fetchLocations() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Failed to add location' } finally { saving.value = false }
}
function confirmDelete(item: Location) {
  deletingItem.value = item
  deleteDialog.value = true
}
async function deleteLocation() {
  if (!deletingItem.value) return
  try { await api.delete(`/locations/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await fetchLocations() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Failed to delete location' }
}
function openEditLocation(item: Location) {
  editLocation.value = { _id: item._id, name: item.name, address: { street: item.address?.street || '', city: item.address?.city || '', state: item.address?.state || '', zip: item.address?.zip || '', country: item.address?.country || '' }, contactName: item.contactName || '', contactEmail: item.contactEmail || '', contactPhone: item.contactPhone || '', isActive: item.isActive }
  showEditDialog.value = true
}
async function saveEditLocation() {
  saving.value = true
  try { const { _id, ...data } = editLocation.value; await api.put(`/locations/${_id}`, data); showEditDialog.value = false; await fetchLocations() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Failed to update location' } finally { saving.value = false }
}
function openHistory(id: string) { historyEntityId.value = id; historyDialogVisible.value = true }
onMounted(fetchLocations)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div><h1 class="text-2xl font-bold">{{ $t('locations.title') }}</h1></div>
        <div class="flex align-items-center gap-2">
          <ColumnPicker :allColumns="enrichedColumns" :visibleKeys="visibleKeys" :isVisible="isVisible" @toggle="toggleColumn" @reorder="reorderColumns" @reset="resetToDefaults" />
          <Button severity="primary" icon="pi pi-plus" :label="$t('locations.addLocation')" @click="showAddDialog = true" />
        </div>
      </div>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="searchQuery" :placeholder="$t('locations.searchPlaceholder')" class="an-search-input" @update:modelValue="fetchLocations" />
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
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
            <tr v-for="item in sortedLocations" :key="item._id" class="data-row">
              <template v-for="col in visibleColumns" :key="col.key">

              <td v-if="col.key === '_actions'" style="text-align:right;white-space:nowrap;">
                <Button icon="pi pi-pencil" size="small" text severity="primary" @click="openEditLocation(item)" class="mr-1" />
                <Button icon="pi pi-history" size="small" text severity="help" @click.stop="openHistory(item._id)" class="mr-1" v-tooltip.top="$t('common.history')" />
                <Button icon="pi pi-trash" size="small" text severity="danger" @click="confirmDelete(item)" />
              </td>
              <td v-else :data-label="col.label">
                <template v-if="col.key === 'name'">
                  <div class="flex align-items-center gap-2"><i class="pi pi-map-marker"></i><span class="font-bold">{{ item.name }}</span></div>
                </template>
                <template v-else-if="col.key === 'isActive'">
                  <Tag :value="item.isActive ? $t('common.active') : $t('common.inactive')" :severity="item.isActive ? 'success' : 'secondary'" />
                </template>
                <template v-else-if="col.key === 'contactEmail'">
                  <a v-if="item.contactEmail" :href="`mailto:${item.contactEmail}`" style="color:var(--p-primary-color);">{{ item.contactEmail }}</a>
                  <span v-else style="color:var(--an-text-muted);">—</span>
                </template>
                <template v-else>{{ getCellValue(item, col.key) }}</template>
              </td>
              </template>
            </tr>
            <tr v-if="locations.length === 0"><td :colspan="visibleColumns.length" class="text-center p-4" style="color:var(--an-text-muted);">{{ $t('common.noData') }}</td></tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="showAddDialog" :header="$t('locations.addLocation')" :style="{width:'500px'}" modal>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('locations.locationName') }}</label><InputText v-model="newLocation.name" class="w-full mt-2" /></div>
          <div><label>{{ $t('common.street') }}</label><InputText v-model="newLocation.address.street" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:2;"><label>{{ $t('locations.city') }}</label><InputText v-model="newLocation.address.city" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.state') }}</label><InputText v-model="newLocation.address.state" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.zip') }}</label><InputText v-model="newLocation.address.zip" class="w-full mt-2" /></div>
          </div>
          <div><label>{{ $t('locations.country') }}</label><InputText v-model="newLocation.address.country" class="w-full mt-2" /></div>
          <div><label>{{ $t('locations.contactName') }}</label><InputText v-model="newLocation.contactName" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('locations.contactEmail') }}</label><InputText v-model="newLocation.contactEmail" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('locations.contactPhone') }}</label><InputText v-model="newLocation.contactPhone" class="w-full mt-2" /></div>
          </div>
          <div class="flex align-items-center gap-2 mt-1"><ToggleSwitch v-model="newLocation.isActive" /><label>{{ $t('common.active') }}</label></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showAddDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="addLocation" />
        </template>
      </Dialog>

      <Dialog v-model:visible="showEditDialog" :header="$t('locations.editLocation')" :style="{width:'500px'}" modal>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('locations.locationName') }}</label><InputText v-model="editLocation.name" class="w-full mt-2" /></div>
          <div><label>{{ $t('common.street') }}</label><InputText v-model="editLocation.address.street" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:2;"><label>{{ $t('locations.city') }}</label><InputText v-model="editLocation.address.city" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.state') }}</label><InputText v-model="editLocation.address.state" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('common.zip') }}</label><InputText v-model="editLocation.address.zip" class="w-full mt-2" /></div>
          </div>
          <div><label>{{ $t('locations.country') }}</label><InputText v-model="editLocation.address.country" class="w-full mt-2" /></div>
          <div><label>{{ $t('locations.contactName') }}</label><InputText v-model="editLocation.contactName" class="w-full mt-2" /></div>
          <div class="flex gap-3">
            <div style="flex:1;"><label>{{ $t('locations.contactEmail') }}</label><InputText v-model="editLocation.contactEmail" class="w-full mt-2" /></div>
            <div style="flex:1;"><label>{{ $t('locations.contactPhone') }}</label><InputText v-model="editLocation.contactPhone" class="w-full mt-2" /></div>
          </div>
          <div class="flex align-items-center gap-2 mt-1"><ToggleSwitch v-model="editLocation.isActive" /><label>{{ $t('common.active') }}</label></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showEditDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="saveEditLocation" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingItem?.name }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteLocation" />
        </template>
      </Dialog>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" :entity-type="'Location'" :entity-id="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

