<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()

const PRIME_ICONS = [
  'pi pi-tag', 'pi pi-desktop', 'pi pi-mobile', 'pi pi-tablet', 'pi pi-server',
  'pi pi-wifi', 'pi pi-print', 'pi pi-monitor', 'pi pi-keyboard', 'pi pi-microchip',
  'pi pi-box', 'pi pi-briefcase', 'pi pi-building', 'pi pi-car', 'pi pi-camera',
  'pi pi-chart-bar', 'pi pi-check-circle', 'pi pi-clipboard', 'pi pi-clock',
  'pi pi-cloud', 'pi pi-cog', 'pi pi-code', 'pi pi-database', 'pi pi-envelope',
  'pi pi-exclamation-triangle', 'pi pi-eye', 'pi pi-file', 'pi pi-flag',
  'pi pi-folder', 'pi pi-gift', 'pi pi-globe', 'pi pi-hammer', 'pi pi-headphones',
  'pi pi-heart', 'pi pi-home', 'pi pi-id-card', 'pi pi-image', 'pi pi-inbox',
  'pi pi-key', 'pi pi-lightbulb', 'pi pi-link', 'pi pi-lock', 'pi pi-map',
  'pi pi-megaphone', 'pi pi-palette', 'pi pi-paperclip', 'pi pi-pencil',
  'pi pi-phone', 'pi pi-power-off', 'pi pi-receipt', 'pi pi-refresh',
  'pi pi-shield', 'pi pi-shopping-bag', 'pi pi-shopping-cart', 'pi pi-sitemap',
  'pi pi-sliders-h', 'pi pi-sparkles', 'pi pi-star', 'pi pi-stopwatch',
  'pi pi-sun', 'pi pi-tags', 'pi pi-thumbs-up', 'pi pi-ticket', 'pi pi-truck',
  'pi pi-trophy', 'pi pi-upload', 'pi pi-user', 'pi pi-users', 'pi pi-video',
  'pi pi-volume-up', 'pi pi-wallet', 'pi pi-wrench', 'pi pi-circle',
  'pi pi-bolt', 'pi pi-calculator', 'pi pi-directions', 'pi pi-ethernet',
  'pi pi-gauge', 'pi pi-graduation-cap', 'pi pi-objects-column', 'pi pi-warehouse'
].map(icon => ({ label: icon.replace('pi pi-', ''), value: icon }))

const ENTITY_TYPES = [
  { value: 'hardware', title: t('common.hardware'), icon: 'pi pi-desktop' },
  { value: 'peripheral', title: t('common.peripherals'), icon: 'pi pi-keyboard' },
  { value: 'consumable', title: t('common.consumables'), icon: 'pi pi-box' },
  { value: 'component', title: t('common.components'), icon: 'pi pi-microchip' },
  { value: 'license', title: t('common.licenses'), icon: 'pi pi-id-card' }
]

interface Category {
  _id: string
  name: string
  entityType: string
  icon: string
  color: string
  description?: string
  isDefault: boolean
}

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialog = ref(false)
const editing = ref<Category | null>(null)
const filterType = ref<string | null>(null)
const deleteDialog = ref(false)
const deletingItem = ref<Category | null>(null)

const form = ref({
  name: '',
  entityType: 'hardware',
  icon: 'pi pi-tag',
  color: '#1976D2',
  description: '',
  isDefault: false
})

const filtered = computed(() => {
  if (!filterType.value) return categories.value
  return categories.value.filter(c => c.entityType === filterType.value)
})

async function load() {
  loading.value = true
  try {
    const res = await api.get('/categories')
    categories.value = res.data
  } catch { error.value = t('categories.loadError') }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', entityType: 'hardware', icon: 'pi pi-tag', color: '#1976D2', description: '', isDefault: false }
  dialog.value = true
}

function openEdit(cat: Category) {
  editing.value = cat
  form.value = { name: cat.name, entityType: cat.entityType, icon: cat.icon, color: cat.color, description: cat.description || '', isDefault: cat.isDefault }
  dialog.value = true
}

async function save() {
  try {
    if (editing.value) {
      await api.put(`/categories/${editing.value._id}`, form.value)
    } else {
      await api.post('/categories', form.value)
    }
    dialog.value = false
    await load()
  } catch (err: any) {
    error.value = err?.response?.data?.error || t('categories.saveError')
  }
}

function confirmDelete(item: Category) { deletingItem.value = item; deleteDialog.value = true }
async function remove() {
  if (!deletingItem.value) return
  try {
    await api.delete(`/categories/${deletingItem.value._id}`)
    deleteDialog.value = false; deletingItem.value = null
    await load()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    error.value = e.response?.data?.error || t('categories.deleteError')
  }
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('categories.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('categories.subtitle') }}</p>
        </div>
        <Button severity="primary" icon="pi pi-plus" :label="$t('categories.addCategory')" @click="openCreate" />
      </div>

      <div class="filter-bar">
        <Button :severity="!filterType ? 'primary' : 'secondary'" size="small" :outlined="!!filterType" :label="$t('common.all')" @click="filterType = null" class="mr-2" />
        <Button v-for="et in ENTITY_TYPES" :key="et.value" :severity="filterType === et.value ? 'primary' : 'secondary'" size="small" :outlined="filterType !== et.value" :icon="et.icon" :label="et.title" @click="filterType = et.value" class="mr-2" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
      </div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ $t('common.color') }}</th>
              <th>{{ $t('common.name') }}</th>
              <th>{{ $t('categories.entityType') }}</th>
              <th>{{ $t('common.icon') }}</th>
              <th>{{ $t('common.default') }}</th>
              <th class="text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in filtered" :key="cat._id" class="data-row">
              <td><span class="color-dot" :style="{ background: cat.color }"></span></td>
              <td class="font-bold">{{ cat.name }}</td>
              <td><Tag :value="cat.entityType" severity="secondary" /></td>
              <td><i :class="cat.icon" style="font-size: 1rem;"></i></td>
              <td><i v-if="cat.isDefault" class="pi pi-check" style="color: var(--an-emerald);"></i></td>
              <td class="text-right">
                <Button icon="pi pi-pencil" size="small" text rounded @click="openEdit(cat)" />
                <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = cat._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(cat)" />
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="6" class="text-center p-4" style="color: var(--an-text-muted);">{{ $t('categories.noCategories') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editing ? $t('categories.editCategory') : $t('categories.newCategory')" :style="{ width: '500px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label>{{ $t('common.name') }}</label>
            <InputText v-model="form.name" class="w-full" />
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ $t('categories.entityType') }}</label>
            <Select v-model="form.entityType" :options="ENTITY_TYPES" optionLabel="title" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ $t('categories.iconClass') }}</label>
            <Select v-model="form.icon" :options="PRIME_ICONS" optionLabel="label" optionValue="value" class="w-full" filter :filterPlaceholder="$t('common.search')">
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
          <div class="flex flex-column gap-2">
            <label>{{ $t('common.color') }}</label>
            <div class="color-picker-row">
              <input type="color" v-model="form.color" class="color-input" />
              <span class="color-hex">{{ form.color }}</span>
            </div>
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ $t('common.description') }}</label>
            <Textarea v-model="form.description" rows="2" class="w-full" />
          </div>
          <div class="flex align-items-center gap-2">
            <ToggleSwitch v-model="form.isDefault" />
            <label>{{ $t('common.defaultCategory') }}</label>
          </div>
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
        <ChangeHistory v-if="historyEntityId" entityType="Category" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

<style scoped>

.color-dot { width: 24px; height: 24px; border-radius: 50%; display: inline-block; }
.icon-option { display: flex; align-items: center; gap: 10px; }
.icon-option i { font-size: 1.1rem; width: 24px; text-align: center; }
.color-picker-row { display: flex; align-items: center; gap: 12px; }
.color-input { width: 48px; height: 40px; border: 1px solid var(--an-border-dark); border-radius: var(--radius-md); background: transparent; cursor: pointer; padding: 2px; }
.color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.color-input::-webkit-color-swatch { border-radius: 4px; border: none; }
.color-hex { font-size: 14px; color: var(--an-text-subtle); font-family: monospace; }
</style>
