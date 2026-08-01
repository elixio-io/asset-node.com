<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const { t } = useI18n()
const isAdmin = useAuthStore().isAdmin
const isManager = useAuthStore().isManager

interface Audit {
  _id: string
  name: string
  description?: string
  scope?: { locationType?: string; locationId?: string; department?: string }
  status: string
  createdBy: string
  stats?: { total: number; responded: number; confirmed: number; missing: number; flagged: number }
  createdAt: string
}

const audits = ref<Audit[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)

const showAddDialog = ref(false)
const newAudit = ref({ name: '', description: '' })
const deleteDialog = ref(false)
const deletingAudit = ref<Audit | null>(null)

const statusSeverityMap: Record<string, string> = {
  draft: 'secondary', active: 'info', completed: 'success', cancelled: 'warn'
}

async function fetchAudits() {
  loading.value = true
  error.value = null
  try {
    const response = await api.get('/audits')
    audits.value = response.data
  } catch (err) {
    error.value = t('audits.loadError')
  } finally {
    loading.value = false
  }
}

async function createAudit() {
  saving.value = true
  try {
    await api.post('/audits', newAudit.value)
    showAddDialog.value = false
    newAudit.value = { name: '', description: '' }
    await fetchAudits()
  } catch (err: any) {
    error.value = err.response?.data?.error || t('audits.createError')
  } finally {
    saving.value = false
  }
}

async function activateAudit(id: string) {
  try {
    await api.put(`/audits/${id}`, { status: 'active' })
    await fetchAudits()
  } catch (err: any) {
    error.value = err.response?.data?.error || t('audits.activateError')
  }
}

async function completeAudit(id: string) {
  try {
    await api.put(`/audits/${id}`, { status: 'completed' })
    await fetchAudits()
  } catch (err: any) {
    error.value = err.response?.data?.error || t('audits.completeError')
  }
}

function confirmDelete(item: Audit) { deletingAudit.value = item; deleteDialog.value = true }
async function deleteAudit() {
  if (!deletingAudit.value) return
  try {
    await api.delete(`/audits/${deletingAudit.value._id}`)
    deleteDialog.value = false; deletingAudit.value = null
    await fetchAudits()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    error.value = e.response?.data?.error || t('audits.deleteError')
  }
}

onMounted(fetchAudits)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">
        {{ error }}
      </Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold" style="letter-spacing: -0.02em;">{{ $t('audits.title') }}</h1>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">{{ $t('audits.subtitle') }}</p>
        </div>
        <Button v-if="isManager" severity="primary" icon="pi pi-plus" :label="$t('audits.createAudit')" class="btn-glow-primary" @click="showAddDialog = true" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
      </div>

      <div v-else class="table-wrapper surface-card">
        <table class="an-table">
          <thead>
            <tr>
              <th>{{ t('audits.auditName') }}</th>
              <th>{{ t('common.status') }}</th>
              <th>{{ t('audits.responseRate') }}</th>
              <th>{{ t('audits.createdAt') }}</th>
              <th style="text-align: right;">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in audits" :key="item._id" class="data-row">
              <td class="font-bold">{{ item.name }}</td>
              <td>
                <Tag :value="t(`audits.statusLabel.${item.status}`, item.status)" :severity="statusSeverityMap[item.status] || 'secondary'" />
              </td>
              <td>
                <template v-if="item.stats">
                  <span class="font-bold">{{ item.stats.responded }}/{{ item.stats.total }}</span>
                  <span style="color: var(--an-text-muted); font-size: 12px;" class="ml-1">
                    ({{ item.stats.total > 0 ? Math.round(item.stats.responded / item.stats.total * 100) : 0 }}%)
                  </span>
                </template>
                <span v-else style="color: var(--an-text-muted);">—</span>
              </td>
              <td>{{ new Date(item.createdAt).toLocaleDateString('de-DE') }}</td>
              <td style="text-align: right; white-space: nowrap;" :data-label="$t('common.actions')">
                <Button v-if="item.status === 'draft'" icon="pi pi-play" size="small" text rounded severity="success" @click="activateAudit(item._id)" />
                <Button v-if="item.status === 'active'" icon="pi pi-check" size="small" text rounded severity="primary" @click="completeAudit(item._id)" />
                <Button v-if="isAdmin" icon="pi pi-trash" size="small" text rounded severity="danger" @click="confirmDelete(item)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog v-model:visible="showAddDialog" :header="$t('audits.createAudit')" :style="{ width: '500px' }" modal>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label for="audit-name">{{ $t('audits.auditName') }}</label>
            <InputText id="audit-name" v-model="newAudit.name" class="w-full" required />
          </div>
          <div class="flex flex-column gap-2">
            <label for="audit-desc">{{ $t('maintenance.description') }}</label>
            <Textarea id="audit-desc" v-model="newAudit.description" rows="3" class="w-full" />
          </div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showAddDialog = false" />
          <Button :label="$t('common.save')" severity="primary" :loading="saving" @click="createAudit" />
        </template>
      </Dialog>

      <Dialog v-model:visible="deleteDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('common.deleteConfirmMessage', { name: deletingAudit?.name }) }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="deleteDialog = false" />
          <Button :label="$t('common.delete')" severity="danger" @click="deleteAudit" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

