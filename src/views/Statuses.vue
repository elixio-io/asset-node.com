<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()

const PRIME_ICONS = [
  'pi pi-circle', 'pi pi-check-circle', 'pi pi-exclamation-triangle', 'pi pi-tag',
  'pi pi-desktop', 'pi pi-mobile', 'pi pi-tablet', 'pi pi-server', 'pi pi-wifi',
  'pi pi-print', 'pi pi-monitor', 'pi pi-keyboard', 'pi pi-microchip', 'pi pi-box',
  'pi pi-briefcase', 'pi pi-building', 'pi pi-car', 'pi pi-camera', 'pi pi-chart-bar',
  'pi pi-clipboard', 'pi pi-clock', 'pi pi-cloud', 'pi pi-cog', 'pi pi-code',
  'pi pi-database', 'pi pi-envelope', 'pi pi-eye', 'pi pi-file', 'pi pi-flag',
  'pi pi-folder', 'pi pi-gift', 'pi pi-globe', 'pi pi-hammer', 'pi pi-headphones',
  'pi pi-heart', 'pi pi-home', 'pi pi-id-card', 'pi pi-image', 'pi pi-inbox',
  'pi pi-key', 'pi pi-lightbulb', 'pi pi-link', 'pi pi-lock', 'pi pi-map',
  'pi pi-megaphone', 'pi pi-palette', 'pi pi-paperclip', 'pi pi-pencil',
  'pi pi-phone', 'pi pi-power-off', 'pi pi-receipt', 'pi pi-refresh',
  'pi pi-shield', 'pi pi-shopping-bag', 'pi pi-shopping-cart', 'pi pi-sitemap',
  'pi pi-sliders-h', 'pi pi-sparkles', 'pi pi-star', 'pi pi-stopwatch',
  'pi pi-sun', 'pi pi-tags', 'pi pi-thumbs-up', 'pi pi-ticket', 'pi pi-truck',
  'pi pi-trophy', 'pi pi-upload', 'pi pi-user', 'pi pi-users', 'pi pi-video',
  'pi pi-volume-up', 'pi pi-wallet', 'pi pi-wrench', 'pi pi-bolt',
  'pi pi-calculator', 'pi pi-directions', 'pi pi-ethernet', 'pi pi-gauge',
  'pi pi-graduation-cap', 'pi pi-objects-column', 'pi pi-warehouse'
].map(icon => ({ label: icon.replace('pi pi-', ''), value: icon }))

const STATUS_TYPES = [
  { value: 'deployable', label: t('statuses.typeDeployable'), severity: 'success' },
  { value: 'deployed', label: t('statuses.typeDeployed'), severity: 'info' },
  { value: 'undeployable', label: t('statuses.typeUndeployable'), severity: 'danger' },
  { value: 'pending', label: t('statuses.typePending'), severity: 'warn' },
  { value: 'archived', label: t('statuses.typeArchived'), severity: 'secondary' }
]

interface StatusItem {
  _id: string
  name: string
  type: string
  color: string
  icon: string
  isDefault: boolean
  description?: string
}

const statuses = ref<StatusItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialog = ref(false)
const editing = ref<StatusItem | null>(null)
const deleteDialog = ref(false)
const deletingItem = ref<StatusItem | null>(null)

const form = ref({
  name: '',
  type: 'deployable',
  color: '#1976D2',
  icon: 'pi pi-circle',
  description: '',
  isDefault: false
})

async function load() {
  loading.value = true
  try { const res = await api.get('/statuses'); statuses.value = res.data }
  catch { error.value = t('statuses.loadError') }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', type: 'deployable', color: '#1976D2', icon: 'pi pi-circle', description: '', isDefault: false }
  dialog.value = true
}

function openEdit(s: StatusItem) {
  editing.value = s
  form.value = { name: s.name, type: s.type, color: s.color, icon: s.icon, description: s.description || '', isDefault: s.isDefault }
  dialog.value = true
}

async function save() {
  try {
    if (editing.value) { await api.put(`/statuses/${editing.value._id}`, form.value) }
    else { await api.post('/statuses', form.value) }
    dialog.value = false; await load()
  } catch (err: any) { error.value = err?.response?.data?.error || t('statuses.saveError') }
}

function confirmDelete(item: StatusItem) { deletingItem.value = item; deleteDialog.value = true }
async function remove() {
  if (!deletingItem.value) return
  try { await api.delete(`/statuses/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await load() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || t('statuses.deleteError') }
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('statuses.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ $t('statuses.subtitle') }}</p>
        </div>
        <Button severity="primary" icon="pi pi-plus" :label="$t('statuses.addStatus')" @click="openCreate" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <div v-else class="an-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ $t('common.color') }}</th>
              <th>{{ $t('common.name') }}</th>
              <th>{{ $t('common.type') }}</th>
              <th>{{ $t('common.icon') }}</th>
              <th>{{ $t('common.default') }}</th>
              <th class="text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in statuses" :key="s._id">
              <td><div class="color-dot" :style="{background: s.color}"></div></td>
              <td class="font-bold">{{ s.name }}</td>
              <td><Tag :value="s.type" :severity="STATUS_TYPES.find(t => t.value === s.type)?.severity || 'secondary'" /></td>
              <td><i :class="s.icon"></i></td>
              <td><i :class="s.isDefault ? 'pi pi-check' : 'pi pi-times'" :style="{color: s.isDefault ? 'var(--p-green-500)' : 'var(--an-text-muted)'}"></i></td>
              <td class="text-right">
                <Button icon="pi pi-pencil" size="small" text @click="openEdit(s)" />
                <Button icon="pi pi-history" size="small" text severity="secondary" @click="historyEntityId = s._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" size="small" text severity="danger" @click="confirmDelete(s)" />
              </td>
            </tr>
            <tr v-if="statuses.length === 0">
              <td colspan="6" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('statuses.noStatuses') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editing ? $t('statuses.editStatus') : $t('statuses.newStatus')" :style="{width:'500px'}" modal>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('statuses.statusName') }}</label><InputText v-model="form.name" class="w-full mt-2" :placeholder="$t('statuses.statusNamePlaceholder')" /></div>
          <div><label>{{ $t('statuses.semanticType') }}</label><Select v-model="form.type" :options="STATUS_TYPES" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          <div>
            <label>{{ $t('statuses.iconClass') }}</label>
            <Select v-model="form.icon" :options="PRIME_ICONS" optionLabel="label" optionValue="value" class="w-full mt-2" filter :filterPlaceholder="$t('common.search')">
              <template #value="slotProps">
                <div v-if="slotProps.value" class="icon-option">
                  <i :class="slotProps.value" />
                  <span>{{ slotProps.value.replace('pi pi-', '') }}</span>
                </div>
              </template>
              <template #option="slotProps">
                <div class="icon-option">
                  <i :class="slotProps.option.value" />
                  <span>{{ slotProps.option.label }}</span>
                </div>
              </template>
            </Select>
          </div>
          <div>
            <label>{{ $t('common.color') }}</label>
            <div class="color-picker-row mt-2">
              <input type="color" v-model="form.color" class="color-input" />
              <span class="color-hex">{{ form.color }}</span>
            </div>
          </div>
          <div><label>{{ $t('common.description') }}</label><Textarea v-model="form.description" class="w-full mt-2" rows="2" /></div>
          <div class="flex align-items-center gap-2"><ToggleSwitch v-model="form.isDefault" /><label>{{ $t('common.defaultStatus') }}</label></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="dialog = false" />
          <Button severity="primary" :disabled="!form.name" :label="editing ? $t('common.update') : $t('common.create')" @click="save" />
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
        <ChangeHistory v-if="historyEntityId" entityType="Status" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

<style scoped>


.color-dot { width: 24px; height: 24px; border-radius: 50%; }
.icon-option { display: flex; align-items: center; gap: 10px; }
.icon-option i { font-size: 1.1rem; width: 24px; text-align: center; }
.color-picker-row { display: flex; align-items: center; gap: 12px; }
.color-input { width: 48px; height: 40px; border: 1px solid var(--an-border-dark); border-radius: var(--radius-md); background: transparent; cursor: pointer; padding: 2px; }
.color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.color-input::-webkit-color-swatch { border-radius: 4px; border: none; }
.color-hex { font-size: 14px; color: var(--an-text-subtle); font-family: monospace; }
</style>
