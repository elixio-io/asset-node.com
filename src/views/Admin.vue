<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import Select from 'primevue/select'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'

interface Employee {
  _id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
}

interface HardwareItem {
  _id: string
  serialNumber: string
  model: string
  categoryId?: { _id: string; name: string } | null
  manufacturerId?: { _id: string; name: string } | null
  statusId?: { _id: string; name: string } | null
  assignedTo?: Employee | string | null
  adminPassword?: string
}

const adminHardware = ref<HardwareItem[]>([])
const manufacturers = ref<{ _id: string; name: string }[]>([])
const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)
const editingId = ref<string | null>(null)
const showPasswordMap = ref<{ [key: string]: boolean }>({})
const editingItem = reactive<{ serialNumber?: string; model?: string; manufacturerId?: string | null; assignedTo?: string | null; adminPassword?: string }>({})
const search = ref('')
const { t } = useI18n()

function getAssignedName(assignedTo: Employee | string | null | undefined): string {
  if (!assignedTo) return ''
  if (typeof assignedTo === 'object' && assignedTo.fullName) return assignedTo.fullName
  if (typeof assignedTo === 'string' && /^[a-f0-9]{24}$/i.test(assignedTo)) return ''
  if (typeof assignedTo === 'string') return assignedTo
  return ''
}

function getAssignedId(assignedTo: Employee | string | null | undefined): string | null {
  if (!assignedTo) return null
  if (typeof assignedTo === 'object' && assignedTo._id) return assignedTo._id
  if (typeof assignedTo === 'string') return assignedTo
  return null
}

async function fetchHardware() {
  loading.value = true
  error.value = null
  try {
    const [hwRes, empRes, mfgRes] = await Promise.all([api.get('/hardware'), api.get('/employees'), api.get('/manufacturers')])
    adminHardware.value = hwRes.data
    employees.value = empRes.data
    manufacturers.value = mfgRes.data
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to load hardware'
  } finally {
    loading.value = false
  }
}

onMounted(fetchHardware)

const filteredHardware = computed(() => {
  if (!search.value) return adminHardware.value
  const q = search.value.toLowerCase()
  return adminHardware.value.filter(h =>
    h.serialNumber.toLowerCase().includes(q) ||
    h.model.toLowerCase().includes(q) ||
    h.manufacturerId?.name?.toLowerCase().includes(q) ||
    getAssignedName(h.assignedTo).toLowerCase().includes(q)
  )
})

const employeeOptions = computed(() => [
  { label: '—', value: null },
  ...employees.value.map(e => ({ label: e.fullName, value: e._id }))
])

function togglePassword(id: string) {
  showPasswordMap.value[id] = !showPasswordMap.value[id]
}

function startEditing(item: HardwareItem) {
  editingId.value = item._id
  editingItem.serialNumber = item.serialNumber
  editingItem.model = item.model
  editingItem.manufacturerId = item.manufacturerId?._id || null
  editingItem.assignedTo = getAssignedId(item.assignedTo)
  editingItem.adminPassword = item.adminPassword || ''
}

async function saveChanges(item: HardwareItem) {
  saving.value = true
  error.value = null

  try {
    const payload: Record<string, unknown> = {
      serialNumber: editingItem.serialNumber,
      model: editingItem.model,
      manufacturerId: editingItem.manufacturerId || undefined,
      assignedTo: editingItem.assignedTo || null,
    }
    if (editingItem.adminPassword) payload.adminPassword = editingItem.adminPassword
    await api.put(`/hardware/${item._id}`, payload)

    await fetchHardware()
    editingId.value = null
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to save changes'
  } finally {
    saving.value = false
  }
}

function cancelEditing() {
  editingId.value = null
  Object.keys(editingItem).forEach(key => delete (editingItem as any)[key])
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <div class="view-header">
        <div>
          <h1 class="text-xl font-bold">{{ $t('admin.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('admin.subtitle') }}</p>
        </div>
        <Button
          severity="secondary"
          outlined
          icon="pi pi-refresh"
          :label="$t('common.refresh')"
          :loading="loading"
          @click="fetchHardware"
        />
      </div>

      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">
        {{ error }}
      </Message>

      <div class="filter-bar">
        <div class="an-search-wrapper">
          <i class="pi pi-search an-search-icon" />
          <InputText
            v-model="search"
            :placeholder="$t('admin.searchHardware')"
            class="an-search-input"
          />
        </div>
      </div>

      <div class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ t('hardware.serialNumber') }}</th>
              <th>{{ t('common.model') }}</th>
              <th>{{ t('admin.assignedTo') }}</th>
              <th>{{ t('admin.adminPassword') }}</th>
              <th style="text-align: center;">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredHardware" :key="item._id">
              <td>
                <template v-if="editingId === item._id">
                  <InputText v-model="editingItem.serialNumber" size="small" :placeholder="$t('hardware.serialNumber')" />
                </template>
                <template v-else>{{ item.serialNumber }}</template>
              </td>

              <td>
                <template v-if="editingId === item._id">
                  <div class="flex gap-2">
                    <QuickCreateSelect
                      v-model="editingItem.manufacturerId"
                      :options="manufacturers"
                      createEndpoint="/manufacturers"
                      :entityLabel="$t('hardware.manufacturer')"
                      class="w-full"
                      @created="fetchHardware"
                    />
                    <InputText v-model="editingItem.model" size="small" :placeholder="$t('common.model')" />
                  </div>
                </template>
                <template v-else>{{ item.manufacturerId?.name || '' }} — {{ item.model }}</template>
              </td>

              <td>
                <template v-if="editingId === item._id">
                  <Select
                    v-model="editingItem.assignedTo"
                    :options="employeeOptions"
                    optionLabel="label"
                    optionValue="value"
                    :placeholder="$t('admin.assignedTo')"
                    style="min-width: 200px;"
                    showClear
                  />
                </template>
                <template v-else>{{ getAssignedName(item.assignedTo) || '—' }}</template>
              </td>

              <td>
                <template v-if="editingId === item._id">
                  <Password
                    v-model="editingItem.adminPassword"
                    :feedback="false"
                    toggleMask
                    size="small"
                    :placeholder="$t('admin.adminPassword')"
                    inputClass="w-full"
                  />
                </template>
                <template v-else>
                  <div class="flex align-items-center" v-if="item.adminPassword">
                    <span class="font-bold">
                      {{ showPasswordMap[item._id] ? item.adminPassword : '••••••••' }}
                    </span>
                    <Button
                      :icon="showPasswordMap[item._id] ? 'pi pi-eye-slash' : 'pi pi-eye'"
                      text
                      rounded
                      size="small"
                      class="ml-1"
                      @click="togglePassword(item._id)"
                    />
                  </div>
                  <span v-else style="color: var(--an-text-muted);">{{ $t('admin.notSet') }}</span>
                </template>
              </td>

              <td style="text-align: center; white-space: nowrap;">
                <template v-if="editingId === item._id">
                  <Button
                    severity="primary"
                    size="small"
                    :label="$t('common.save')"
                    :loading="saving"
                    class="mr-2"
                    @click="saveChanges(item)"
                  />
                  <Button
                    severity="danger"
                    size="small"
                    outlined
                    :label="$t('common.cancel')"
                    @click="cancelEditing"
                  />
                </template>
                <template v-else>
                  <Button
                    severity="primary"
                    size="small"
                    outlined
                    icon="pi pi-pencil"
                    :label="$t('common.edit')"
                    @click="startEditing(item)"
                  />
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

