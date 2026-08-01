<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import type { Hardware } from '../types/hardware'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ChangeHistory from '../components/ChangeHistory.vue'

const defectiveHardware = ref<Hardware[]>([])
const editingId = ref<string | null>(null)
const editingItem = reactive<Partial<Hardware>>({})
const loading = ref(true)
const error = ref<string | null>(null)
const historyDialogVisible = ref(false)
const historyEntityId = ref<string | null>(null)
const { t } = useI18n()



async function fetchDefectiveHardware() {
  try { const response = await api.get<Hardware[]>('/hardware?statusSlug=defective'); defectiveHardware.value = response.data }
  catch (err) { error.value = t('defective.loadError'); console.error(err) }
  finally { loading.value = false }
}

function startEditing(item: Hardware) {
  editingId.value = item._id; editingItem.serialNumber = item.serialNumber
  editingItem.model = item.model; editingItem.defectDescription = item.defectDescription
}

async function saveChanges(item: Hardware) {
  if (!editingItem.defectDescription) return
  try { await api.put(`/hardware/${item._id}`, { defectDescription: editingItem.defectDescription, statusSlug: 'defective' }); await fetchDefectiveHardware(); editingId.value = null }
  catch (err) { error.value = t('defective.updateError'); console.error(err) }
}

function cancelEditing() { editingId.value = null; Object.keys(editingItem).forEach(key => delete editingItem[key as keyof typeof editingItem]) }

async function sendToRepair(item: Hardware) {
  try { await api.put(`/hardware/${item._id}`, { statusSlug: 'in-repair' }); await fetchDefectiveHardware() }
  catch (err) { error.value = t('defective.repairError'); console.error(err) }
}

async function markAsRepaired(item: Hardware) {
  try { await api.put(`/hardware/${item._id}`, { statusSlug: 'available', defectDescription: null }); await fetchDefectiveHardware() }
  catch (err) { error.value = t('defective.repairedError'); console.error(err) }
}

onMounted(fetchDefectiveHardware)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div><h1 class="text-2xl font-bold">{{ $t('defective.title') }}</h1></div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ $t('hardware.serialNumber') }}</th>
              <th>{{ $t('common.asset') }}</th>
              <th>{{ $t('common.category') }}</th>
              <th>{{ $t('hardware.purchaseDate') }}</th>
              <th>{{ $t('defective.defectDescription') }}</th>
              <th style="text-align: center;">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in defectiveHardware" :key="item._id" class="data-row">
              <template v-if="editingId === item._id">
                <td>{{ item.serialNumber }}</td>
                <td>{{ (item.manufacturerId as any)?.name || '' }} {{ item.model || '—' }}</td>
                <td>{{ (item.categoryId as any)?.name || '—' }}</td>
                <td>{{ new Date(item.purchaseDate).toLocaleDateString() }}</td>
                <td><Textarea v-model="editingItem.defectDescription" placeholder="Describe the defect" rows="2" autoResize class="w-full" /></td>
                <td style="text-align: center;">
                  <Button severity="primary" size="small" class="mr-2" :disabled="!editingItem.defectDescription" :label="$t('common.save')" @click="saveChanges(item)" />
                  <Button severity="danger" size="small" outlined :label="$t('common.cancel')" @click="cancelEditing" />
                </td>
              </template>
              <template v-else>
                <td>{{ item.serialNumber }}</td>
                <td>{{ (item.manufacturerId as any)?.name || '' }} {{ item.model || '—' }}</td>
                <td>{{ (item.categoryId as any)?.name || '—' }}</td>
                <td>{{ new Date(item.purchaseDate).toLocaleDateString() }}</td>
                <td>{{ item.defectDescription || '-' }}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <Button icon="pi pi-pencil" size="small" text rounded severity="primary" @click="startEditing(item)" />
                  <Button icon="pi pi-history" size="small" text rounded severity="secondary" @click="historyEntityId = item._id; historyDialogVisible = true" />
                  <Button icon="pi pi-wrench" size="small" text rounded severity="warn" @click="sendToRepair(item)" />
                  <Button icon="pi pi-check" size="small" text rounded severity="success" @click="markAsRepaired(item)" />
                </td>
              </template>
            </tr>
            <tr v-if="defectiveHardware.length === 0">
              <td colspan="6" class="text-center p-4" style="color: var(--an-text-muted);">{{ $t('defective.noDefectiveFound') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="historyDialogVisible" :header="$t('common.history')" :style="{ width: '700px' }" modal>
        <ChangeHistory v-if="historyEntityId" entityType="Hardware" :entityId="historyEntityId" />
      </Dialog>
    </div>
  </div>
</template>

