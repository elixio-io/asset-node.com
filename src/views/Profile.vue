<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import SecuritySettings from '../components/profile/SecuritySettings.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const profile = ref({ firstName: '', lastName: '', email: '', companyName: '', department: '', role: '', createdAt: '' })
const showPasswordDialog = ref(false)
const passwordLoading = ref(false)
const passwordError = ref<string | null>(null)
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/auth/me')
    profile.value = { firstName: data.firstName || '', lastName: data.lastName || '', email: data.email || '', companyName: data.companyName || '', department: data.department || '', role: data.role || '', createdAt: data.createdAt || '' }
  } catch {
    profile.value = { firstName: authStore.user?.firstName || '', lastName: authStore.user?.lastName || '', email: authStore.user?.email || '', companyName: authStore.user?.companyName || '', department: authStore.user?.department || '', role: authStore.user?.role || '', createdAt: '' }
  } finally { loading.value = false }
})

async function handleSubmit() {
  saving.value = true; error.value = null; success.value = null
  try {
    const { data } = await api.put('/auth/profile', { firstName: profile.value.firstName, lastName: profile.value.lastName, department: profile.value.department || null })
    if (authStore.user) { authStore.user.firstName = data.firstName; authStore.user.lastName = data.lastName; authStore.user.fullName = data.fullName; authStore.user.department = data.department }
    success.value = t('profile.profileSaved')
  } catch (err: any) { error.value = err.response?.data?.error || t('profile.updateError') }
  finally { saving.value = false }
}

async function changePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) { passwordError.value = t('profile.passwordsNoMatch'); return }
  passwordLoading.value = true; passwordError.value = null
  try {
    const { data } = await api.put('/auth/password', { currentPassword: passwordForm.value.currentPassword, newPassword: passwordForm.value.newPassword })
    authStore.acceptSession(data)
    showPasswordDialog.value = false; passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }; success.value = t('profile.passwordChanged')
  } catch (err: any) { passwordError.value = err.response?.data?.error || t('profile.passwordError') }
  finally { passwordLoading.value = false }
}

function formatDate(dateStr: string) { if (!dateStr) return '—'; return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
</script>

<template>
  <div class="view-page">
    <div class="view-inner" style="max-width: 900px">
      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('profile.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ $t('profile.subtitle') }}</p>
        </div>
      </div>

      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <Message v-if="success" severity="success" closable @close="success = null" class="mb-4">{{ success }}</Message>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <form v-else @submit.prevent="handleSubmit">
        <div class="an-card mb-4" style="padding:24px;">
          <h2 class="font-bold mb-4 flex align-items-center gap-2"><i class="pi pi-user"></i>{{ $t('profile.basicInfo') }}</h2>
          <div class="profile-grid">
            <div class="profile-field"><label>{{ $t('profile.firstName') }}</label><InputText v-model="profile.firstName" class="w-full mt-2" /></div>
            <div class="profile-field"><label>{{ $t('profile.lastName') }}</label><InputText v-model="profile.lastName" class="w-full mt-2" /></div>
            <div class="profile-field"><label>{{ $t('common.email') }}</label><InputText :modelValue="profile.email" class="w-full mt-2" disabled /><small style="color:var(--an-text-muted);">{{ $t('profile.emailCannotChange') }}</small></div>
            <div class="profile-field"><label>{{ $t('common.department') }}</label><InputText v-model="profile.department" class="w-full mt-2" /></div>
          </div>
          <div class="profile-grid-3 mt-3">
            <div class="profile-field"><label>{{ $t('profile.company') }}</label><InputText :modelValue="profile.companyName" class="w-full mt-2" disabled /></div>
            <div class="profile-field"><label>{{ $t('profile.role') }}</label><InputText :modelValue="profile.role" class="w-full mt-2" disabled /></div>
            <div class="profile-field"><label>{{ $t('profile.memberSince') }}</label><InputText :modelValue="formatDate(profile.createdAt)" class="w-full mt-2" disabled /></div>
          </div>
        </div>

        <div class="an-card mb-4" style="padding:24px;">
          <h2 class="font-bold mb-4 flex align-items-center gap-2"><i class="pi pi-clipboard"></i>{{ $t('profile.companySurvey') }}</h2>
          <div class="text-center" style="padding:16px 0;">
            <i class="pi pi-clipboard mb-4" style="font-size:48px;color:var(--an-text-muted);"></i>
            <div class="mb-4" style="color:var(--an-text-muted);">{{ $t('profile.companySurveyDesc') }}</div>
            <Button severity="primary" :label="$t('profile.completeSurvey')" @click="router.push('/company-profile')" />
          </div>
        </div>

        <SecuritySettings />

        <div class="an-card mb-4" style="padding:24px;">
          <h2 class="font-bold mb-4 flex align-items-center gap-2"><i class="pi pi-lock"></i>{{ $t('profile.changePassword') }}</h2>
          <Button severity="danger" outlined icon="pi pi-lock" :label="$t('profile.changePassword')" @click="showPasswordDialog = true" />
        </div>

        <div class="flex justify-content-end">
          <Button type="submit" severity="primary" size="large" :loading="saving" :label="$t('profile.saveChanges')" />
        </div>
      </form>

      <Dialog v-model:visible="showPasswordDialog" :header="$t('profile.changePassword')" :style="{width:'500px'}" modal>
        <Message v-if="passwordError" severity="error" class="mb-4">{{ passwordError }}</Message>
        <div class="flex flex-column gap-3">
          <div><label>{{ $t('profile.currentPassword') }}</label><InputText v-model="passwordForm.currentPassword" :type="showCurrentPassword ? 'text' : 'password'" class="w-full mt-2" /></div>
          <div><label>{{ $t('profile.newPassword') }}</label><InputText v-model="passwordForm.newPassword" :type="showNewPassword ? 'text' : 'password'" class="w-full mt-2" /><small style="color:var(--an-text-muted);">{{ $t('profile.minChars') }}</small></div>
          <div><label>{{ $t('profile.confirmNewPassword') }}</label><InputText v-model="passwordForm.confirmPassword" type="password" class="w-full mt-2" /></div>
        </div>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="showPasswordDialog = false" />
          <Button severity="primary" :loading="passwordLoading" :disabled="!passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword" :label="$t('profile.changePassword')" @click="changePassword" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>


.profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.profile-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.profile-field label { font-size: 14px; font-weight: 600; color: var(--an-text-subtle); }
@media (max-width: 768px) {
  .profile-grid, .profile-grid-3 { grid-template-columns: 1fr; }
}
</style>
