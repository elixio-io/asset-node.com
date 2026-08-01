<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const { t } = useI18n()

const ENTITY_TYPES = [
  { value: 'hardware', label: 'Hardware' }, { value: 'peripheral', label: 'Peripherals' },
  { value: 'consumable', label: 'Consumables' }, { value: 'component', label: 'Components' },
  { value: 'license', label: 'Licenses' }, { value: 'employee', label: 'Employees' },
  { value: 'location', label: 'Locations' }
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'pi pi-align-left' },
  { value: 'number', label: 'Number', icon: 'pi pi-hashtag' },
  { value: 'date', label: 'Date', icon: 'pi pi-calendar' },
  { value: 'boolean', label: 'Yes / No', icon: 'pi pi-check-square' },
  { value: 'select', label: 'Dropdown', icon: 'pi pi-list' },
  { value: 'url', label: 'URL', icon: 'pi pi-link' },
  { value: 'email', label: 'Email', icon: 'pi pi-envelope' }
]

interface CustomFieldDef {
  _id: string; name: string; key: string; entityType: string; fieldType: string
  options: string[]; required: boolean; defaultValue: any; helpText: string; order: number; isActive: boolean
}

const fields = ref<CustomFieldDef[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const dialog = ref(false)
const editing = ref<CustomFieldDef | null>(null)
const filterEntity = ref<string | null>(null)
const deleteDialog = ref(false)
const deletingItem = ref<CustomFieldDef | null>(null)
const optionInput = ref('')
const form = ref({ name: '', entityType: 'hardware', fieldType: 'text', options: [] as string[], required: false, defaultValue: null as any, helpText: '', order: 0 })
const filtered = computed(() => !filterEntity.value ? fields.value : fields.value.filter(f => f.entityType === filterEntity.value))

async function load() {
  loading.value = true
  try { const res = await api.get('/custom-fields'); fields.value = res.data }
  catch { error.value = 'Failed to load custom fields' }
  finally { loading.value = false }
}

function openCreate() { editing.value = null; form.value = { name: '', entityType: 'hardware', fieldType: 'text', options: [], required: false, defaultValue: null, helpText: '', order: 0 }; dialog.value = true }
function openEdit(f: CustomFieldDef) { editing.value = f; form.value = { name: f.name, entityType: f.entityType, fieldType: f.fieldType, options: [...f.options], required: f.required, defaultValue: f.defaultValue, helpText: f.helpText || '', order: f.order }; dialog.value = true }
function addOption() { const val = optionInput.value.trim(); if (val && !form.value.options.includes(val)) { form.value.options.push(val); optionInput.value = '' } }
function removeOption(idx: number) { form.value.options.splice(idx, 1) }
function fieldTypeIcon(type: string): string { return FIELD_TYPES.find(t => t.value === type)?.icon || 'pi pi-question' }

async function save() {
  try {
    if (editing.value) { await api.put(`/custom-fields/${editing.value._id}`, form.value) }
    else { await api.post('/custom-fields', form.value) }
    dialog.value = false; await load()
  } catch (err: any) { error.value = err?.response?.data?.error || 'Save failed' }
}

function confirmDelete(item: CustomFieldDef) { deletingItem.value = item; deleteDialog.value = true }
async function remove() {
  if (!deletingItem.value) return
  try { await api.delete(`/custom-fields/${deletingItem.value._id}`); deleteDialog.value = false; deletingItem.value = null; await load() }
  catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; error.value = e.response?.data?.error || 'Delete failed' }
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('customFields.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('customFields.subtitle') }}</p>
        </div>
        <Button severity="primary" icon="pi pi-plus" :label="$t('customFields.addField')" @click="openCreate" />
      </div>

      <div class="filter-bar flex gap-2 flex-wrap">
        <Tag :severity="!filterEntity ? 'primary' : 'secondary'" :value="$t('common.all')" style="cursor: pointer;" @click="filterEntity = null" />
        <Tag v-for="et in ENTITY_TYPES" :key="et.value" :severity="filterEntity === et.value ? 'primary' : 'secondary'" :value="et.label" style="cursor: pointer;" @click="filterEntity = et.value" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ $t('common.name') }}</th><th>{{ $t('customFields.key') }}</th><th>{{ $t('customFields.entity') }}</th><th>{{ $t('common.type') }}</th><th>{{ $t('common.required') }}</th><th>{{ $t('customFields.options') }}</th><th style="text-align: right;">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in filtered" :key="f._id" class="data-row">
              <td>
                <div class="font-bold">{{ f.name }}</div>
                <div v-if="f.helpText" style="font-size: 12px; color: var(--an-text-muted);">{{ f.helpText }}</div>
              </td>
              <td><code style="font-size: 12px;">{{ f.key }}</code></td>
              <td><Tag size="small" :value="f.entityType" /></td>
              <td><i :class="fieldTypeIcon(f.fieldType)" class="mr-1"></i>{{ FIELD_TYPES.find(t => t.value === f.fieldType)?.label || f.fieldType }}</td>
              <td><i v-if="f.required" class="pi pi-check text-green-500"></i><span v-else class="text-muted">—</span></td>
              <td>
                <template v-if="f.options?.length">
                  <Tag v-for="opt in f.options.slice(0, 3)" :key="opt" :value="opt" size="small" class="mr-1" />
                  <span v-if="f.options.length > 3" style="font-size: 12px; color: var(--an-text-muted);">+{{ f.options.length - 3 }}</span>
                </template>
                <span v-else style="color: var(--an-text-muted);">—</span>
              </td>
              <td style="text-align: right;">
                <Button icon="pi pi-pencil" size="small" text rounded @click="openEdit(f)" />
                <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = f._id; historyDialogVisible = true" />
                <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(f)" />
              </td>
            </tr>
            <tr v-if="filtered.length === 0"><td colspan="7" class="text-center p-4" style="color: var(--an-text-muted);">{{ $t('customFields.noFields') }}</td></tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="dialog" :header="editing ? $t('customFields.editField') : $t('customFields.newField')" :style="{ width: '550px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2"><label>{{ $t('customFields.fieldName') }}</label><InputText v-model="form.name" :placeholder="$t('customFields.fieldNamePlaceholder')" class="w-full" /></div>
          <div class="grid">
            <div class="col-6"><label>{{ $t('customFields.entityType') }}</label><Select v-model="form.entityType" :options="ENTITY_TYPES" optionLabel="label" optionValue="value" class="w-full mt-2" :disabled="!!editing" /></div>
            <div class="col-6"><label>{{ $t('customFields.fieldType') }}</label><Select v-model="form.fieldType" :options="FIELD_TYPES" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
          </div>
          <div v-if="form.fieldType === 'select'">
            <label class="mb-2">{{ $t('customFields.dropdownOptions') }}</label>
            <div class="flex gap-2 mt-2 mb-2">
              <InputText v-model="optionInput" :placeholder="$t('customFields.addOption')" class="flex-1" @keydown.enter.prevent="addOption" />
              <Button icon="pi pi-plus" size="small" severity="primary" @click="addOption" />
            </div>
            <div class="flex gap-1 flex-wrap">
              <Tag v-for="(opt, idx) in form.options" :key="idx" :value="opt" removable @remove="removeOption(idx)" />
            </div>
          </div>
          <div class="flex flex-column gap-2"><label>{{ $t('customFields.helpText') }}</label><InputText v-model="form.helpText" :placeholder="$t('customFields.helpTextPlaceholder')" class="w-full" /></div>
          <div class="grid">
            <div class="col-6 flex align-items-center gap-2"><ToggleSwitch v-model="form.required" /><label>{{ $t('common.required') }}</label></div>
            <div class="col-6"><label>{{ $t('customFields.sortOrder') }}</label><InputNumber v-model="form.order" class="w-full mt-2" /></div>
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
        <ChangeHistory v-if="historyEntityId" entityType="CustomField" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

