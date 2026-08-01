<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const gdprConsent = ref(false)
const dataProcessingConsent = ref(false)
const marketingConsent = ref(false)
const consentDate = ref<string | null>(null)
const consentLoading = ref(true)
const consentSaving = ref(false)
const exporting = ref(false)
const deleteDialog = ref(false)
const deletePassword = ref('')
const deleteConfirm = ref(false)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

onMounted(async () => {
  try {
    const { data } = await api.get('/gdpr/consent')
    gdprConsent.value = data.gdprConsent || false
    dataProcessingConsent.value = data.dataProcessingConsent || false
    marketingConsent.value = data.marketingConsent || false
    consentDate.value = data.gdprConsentDate
      ? new Date(data.gdprConsentDate).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null
  } catch (err) { console.error('Failed to load consent:', err) }
  finally { consentLoading.value = false }
})

async function saveConsent() {
  consentSaving.value = true
  try {
    await api.put('/gdpr/consent', { gdprConsent: gdprConsent.value, dataProcessingConsent: dataProcessingConsent.value, marketingConsent: marketingConsent.value })
    toast.add({ severity: 'success', summary: t('privacy.preferencesSaved'), life: 3000 })
  } catch { toast.add({ severity: 'error', summary: t('privacy.preferencesFailed'), life: 3000 }) }
  finally { consentSaving.value = false }
}

async function exportData() {
  exporting.value = true
  try {
    const { data } = await api.get('/gdpr/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `gdpr-export-${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.add({ severity: 'success', summary: t('privacy.exportSuccess'), life: 3000 })
  } catch { toast.add({ severity: 'error', summary: t('privacy.exportFailed'), life: 3000 }) }
  finally { exporting.value = false }
}

async function deleteAccount() {
  if (!deleteConfirm.value || !deletePassword.value) { deleteError.value = 'Please confirm deletion and enter your password.'; return }
  deleting.value = true; deleteError.value = null
  try {
    await api.delete('/gdpr/delete', { data: { password: deletePassword.value, confirmDeletion: deleteConfirm.value } })
    await authStore.logout(); router.push('/sign-in')
  } catch (err: any) { deleteError.value = err.response?.data?.error || 'Failed to delete account' }
  finally { deleting.value = false }
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner" style="max-width: 800px">
      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('privacy.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ $t('privacy.subtitle') }}</p>
        </div>
      </div>

      <div v-if="consentLoading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <template v-else>
        <div class="an-card mb-4" style="padding:24px;">
          <h2 class="font-bold mb-1 flex align-items-center gap-2"><i class="pi pi-shield"></i>{{ $t('privacy.consentPreferences') }}</h2>
          <p v-if="consentDate" style="color:var(--an-text-muted);font-size:12px;" class="mb-4">{{ $t('privacy.lastUpdated', { date: consentDate }) }}</p>

          <div class="consent-item">
            <div class="flex align-items-center gap-3">
              <ToggleSwitch v-model="gdprConsent" />
              <div><div class="font-bold" style="font-size:14px;">{{ $t('privacy.dataProcessing') }}</div><div style="color:var(--an-text-muted);font-size:13px;">{{ $t('privacy.dataProcessingDesc', { link: $t('auth.privacyPolicy') }) }}</div></div>
            </div>
          </div>
          <div class="consent-item">
            <div class="flex align-items-center gap-3">
              <ToggleSwitch v-model="dataProcessingConsent" />
              <div><div class="font-bold" style="font-size:14px;">{{ $t('privacy.analytics') }}</div><div style="color:var(--an-text-muted);font-size:13px;">{{ $t('privacy.analyticsDesc') }}</div></div>
            </div>
          </div>
          <div class="consent-item">
            <div class="flex align-items-center gap-3">
              <ToggleSwitch v-model="marketingConsent" />
              <div><div class="font-bold" style="font-size:14px;">{{ $t('privacy.marketing') }}</div><div style="color:var(--an-text-muted);font-size:13px;">{{ $t('privacy.marketingDesc') }}</div></div>
            </div>
          </div>
          <div class="flex justify-content-end mt-4">
            <Button severity="primary" :loading="consentSaving" :label="$t('privacy.savePreferences')" @click="saveConsent" />
          </div>
        </div>

        <div class="an-card mb-4" style="padding:24px;">
          <h2 class="font-bold mb-3 flex align-items-center gap-2"><i class="pi pi-download"></i>{{ $t('privacy.exportTitle') }}</h2>
          <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">{{ $t('privacy.exportDesc') }}</p>
          <Button severity="info" icon="pi pi-download" :loading="exporting" :label="$t('privacy.downloadData')" @click="exportData" />
        </div>

        <div class="an-card mb-4" style="padding:24px;border:1px solid rgba(239,68,68,0.3);">
          <h2 class="font-bold mb-3 flex align-items-center gap-2" style="color:var(--p-red-500);"><i class="pi pi-user-minus"></i>{{ $t('privacy.deleteTitle') }}</h2>
          <Message severity="warn" class="mb-4">{{ $t('privacy.deleteWarning') }}</Message>
          <Button severity="danger" outlined icon="pi pi-trash" :label="$t('privacy.deleteButton')" @click="deleteDialog = true" />
        </div>
      </template>

      <Dialog v-model:visible="deleteDialog" :header="$t('privacy.deleteConfirmTitle')" :style="{width:'500px'}" modal>
        <Message severity="error" class="mb-4">{{ $t('privacy.deleteConfirmWarning') }}</Message>
        <Message v-if="deleteError" severity="error" closable @close="deleteError = null" class="mb-4">{{ deleteError }}</Message>
        <div class="mb-3"><label>{{ $t('privacy.deletePasswordPrompt') }}</label><InputText v-model="deletePassword" type="password" class="w-full mt-2" /></div>
        <div class="flex align-items-center gap-2"><Checkbox v-model="deleteConfirm" :binary="true" inputId="confirmDel" /><label for="confirmDel">{{ $t('privacy.deleteCheckbox') }}</label></div>
        <template #footer>
          <Button :label="$t('privacy.deleteCancel')" text @click="deleteDialog = false; deletePassword = ''; deleteConfirm = false; deleteError = null" />
          <Button severity="danger" :loading="deleting" :disabled="!deleteConfirm || !deletePassword" :label="$t('privacy.deleteConfirmButton')" @click="deleteAccount" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>


.consent-item { padding: 16px 0; border-bottom: 1px solid var(--an-border-dark); }
.consent-item:last-of-type { border-bottom: none; }
.consent-item :deep(.p-toggleswitch) { flex-shrink: 0; }
</style>
