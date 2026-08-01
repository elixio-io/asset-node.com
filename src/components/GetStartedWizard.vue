<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useOnboardingTour } from '../composables/useOnboardingTour'

const props = defineProps<{
  mode?: 'dialog' | 'button' | 'both'
}>()


interface WizardStatus {
  steps: { key: string; title: string; completed: boolean }[]
  completedCount: number
  totalSteps: number
  wizardCompleted: boolean
  scim: { endpointUrl: string; bearerToken: string; enabled: boolean }
  sso: { ssoId: string; enabled: boolean }
  integrations: { intune: boolean; jamf: boolean; kandji: boolean }
  demo: {
    enabled: boolean
    hasData: boolean
    eligible: boolean
    hasExistingTenantData: boolean
    tourRecommended: boolean
    seededAt?: string
    seedVersion: number
  }
}


const mdmProviders = [
  { key: 'intune', label: 'Intune Guide', shortLabel: 'Intune', icon: 'pi pi-microsoft', guideSlug: 'intune', settingsSection: 'integrations' },
  { key: 'autopilot', label: 'Autopilot Guide', shortLabel: 'Autopilot', icon: 'pi pi-microsoft', guideSlug: 'autopilot', settingsSection: 'integrations' },
  { key: 'kandji', label: 'Kandji Guide', shortLabel: 'Kandji', icon: 'pi pi-apple', guideSlug: 'kandji', settingsSection: 'integrations' },
  { key: 'jamfPro', label: 'Jamf Pro Guide', shortLabel: 'Jamf Pro', icon: 'pi pi-apple', guideSlug: 'jamf-pro', settingsSection: 'integrations' },
  { key: 'jamfSchool', label: 'Jamf School Guide', shortLabel: 'Jamf School', icon: 'pi pi-apple', guideSlug: 'jamf-school', settingsSection: 'integrations' },
  { key: 'mosyle', label: 'Mosyle Guide', shortLabel: 'Mosyle', icon: 'pi pi-apple', guideSlug: 'mosyle', settingsSection: 'integrations' }
]

const ssoProviders = [
  { key: 'azureAd', label: 'Azure AD Guide', icon: 'pi pi-microsoft', guideSlug: 'sso-azure-ad' },
  { key: 'okta', label: 'Okta Guide', icon: 'pi pi-shield', guideSlug: 'sso-okta' },
  { key: 'onelogin', label: 'OneLogin Guide', icon: 'pi pi-user', guideSlug: 'sso-onelogin' },
  { key: 'jumpcloud', label: 'JumpCloud Guide', icon: 'pi pi-cloud', guideSlug: 'sso-jumpcloud' },
  { key: 'googleWorkspace', label: 'Google Workspace Guide', icon: 'pi pi-google', guideSlug: 'sso-google-workspace' }
]


const router = useRouter()
const authStore = useAuthStore()
const { resetTour } = useOnboardingTour()
const dialog = ref(false)
const step = ref(1)
const status = ref<WizardStatus | null>(null)
const loading = ref(true)
const saving = ref(false)
const copied = ref<string | null>(null)
const revealedToken = ref<string | null>(null)
const generatingToken = ref(false)
const demoLoading = ref(false)
const demoError = ref<string | null>(null)
const isAdmin = authStore.hasRole('admin')

const notifForm = ref({
  emailAddress: '',
  teamsWebhookUrl: '',
  slackWebhookUrl: ''
})


async function load() {
  loading.value = true
  try {
    const res = await api.get('/get-started/status')
    status.value = res.data
    const dismissed = localStorage.getItem('an-wizard-dismissed')
    if (props.mode !== 'button' && !res.data.wizardCompleted && !dismissed) {
      dialog.value = true
      if (res.data.demo?.eligible && !res.data.demo?.enabled) {
        step.value = 0
      } else {
        const firstIncomplete = res.data.steps?.findIndex((s: { completed: boolean }) => !s.completed)
        if (firstIncomplete !== undefined && firstIncomplete >= 0) {
          step.value = firstIncomplete + 1
        }
      }
    }
    loadScimToken()
  } catch {  }
  finally { loading.value = false }
}

function dismissWizard() {
  dialog.value = false
  localStorage.setItem('an-wizard-dismissed', 'true')
}


function nextStep() { if (step.value < 4) step.value++ }
function prevStep() { if (step.value > 1) step.value-- }

async function completeWizard() {
  saving.value = true
  try {
    const channels: Record<string, unknown> = {}
    if (notifForm.value.emailAddress) { channels.email = { enabled: true, address: notifForm.value.emailAddress } }
    if (notifForm.value.slackWebhookUrl) { channels.slack = { enabled: true, webhookUrl: notifForm.value.slackWebhookUrl } }
    if (notifForm.value.teamsWebhookUrl) { channels.teams = { enabled: true, webhookUrl: notifForm.value.teamsWebhookUrl } }
    if (Object.keys(channels).length > 0) { await api.patch('/notifications/preferences', { channels }) }
    await api.post('/get-started/complete')
    dialog.value = false
  } catch { dialog.value = false }
  finally { saving.value = false }
}

function goToSettings(section: string) {
  dialog.value = false
  router.push({ path: '/settings', query: { section } }).then(() => {
    setTimeout(() => {
      const el = document.getElementById(section)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
  })
}
function goToGuide(slug: string) { dialog.value = false; router.push(`/settings?section=integrations&guide=${slug}`) }
function goToImport() { dialog.value = false; router.push('/import') }
function goToAdmin() { dialog.value = false; router.push('/admin') }

async function activateDemo() {
  demoLoading.value = true
  demoError.value = null
  try {
    await api.post('/get-started/demo',{})
    localStorage.removeItem('an-wizard-dismissed')
    localStorage.removeItem('an-onboarding-completed')


    await api.delete('/auth/onboarding').catch(() => undefined)
    dialog.value = false
    await router.replace('/dashboard')
    window.location.reload()
  } catch (err: any) {
    demoError.value = err?.response?.data?.error || 'Demo data could not be created. Please try again.'
  } finally {
    demoLoading.value = false
  }
}

async function startGuidedDemoTour() {
  demoError.value = null
  await resetTour()
}

async function resetDemo() {
  if (!window.confirm('Reset the AssetNode sample records to their original state? Real organization data will not be changed.')) return
  demoLoading.value = true
  demoError.value = null
  try {
    await api.post('/get-started/demo/reset')
    localStorage.removeItem('an-onboarding-completed')
    await api.delete('/auth/onboarding').catch(() => undefined)
    window.location.reload()
  } catch (err: any) {
    demoError.value = err?.response?.data?.error || 'Demo data could not be reset.'
  } finally {
    demoLoading.value = false
  }
}

async function exitDemo() {
  demoLoading.value = true
  demoError.value = null
  try {
    await api.post('/get-started/demo/exit')
    await load()
  } catch (err: any) {
    demoError.value = err?.response?.data?.error || 'Demo mode could not be exited.'
  } finally {
    demoLoading.value = false
  }
}

async function deleteDemo() {
  if (!window.confirm('Delete only the tracked AssetNode sample records? Real organization data will be kept.')) return
  demoLoading.value = true
  demoError.value = null
  try {
    const res = await api.delete('/get-started/demo')
    if (res.data.preservedModified > 0) {
      demoError.value = `${res.data.preservedModified} edited sample record(s) were preserved as organization data.`
    }
    await load()
  } catch (err: any) {
    const dependencies = err?.response?.data?.dependencies
    const suffix = Array.isArray(dependencies) && dependencies.length ? ` (${dependencies.join(', ')})` : ''
    demoError.value = (err?.response?.data?.error || 'Demo data could not be deleted.') + suffix
  } finally {
    demoLoading.value = false
  }
}

async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text)
  copied.value = label
  setTimeout(() => { copied.value = null }, 2000)
}

async function loadScimToken() {
  try {
    const res = await api.get('/organization/integrations/scim/reveal-token')
    revealedToken.value = res.data.token
  } catch { revealedToken.value = null }
}

async function generateToken() {
  generatingToken.value = true
  try {
    const res = await api.post('/organization/integrations/scim/generate-token')
    revealedToken.value = res.data.token
  } catch {  }
  finally { generatingToken.value = false }
}

const openGuideHandler = () => {
  if (props.mode !== 'button') {
    dialog.value = true
    load()
  }
}

const handleTriggerClick = () => {
  if (props.mode === 'button') {
    window.dispatchEvent(new CustomEvent('open-setup-guide'))
  } else {
    dialog.value = true
  }
}

onMounted(() => {
  load()
  window.addEventListener('open-setup-guide', openGuideHandler)
})

onUnmounted(() => {
  window.removeEventListener('open-setup-guide', openGuideHandler)
})
</script>

<template>
  <div
    v-if="props.mode !== 'dialog' && !loading && isAdmin && status?.demo?.enabled"
    class="demo-status-bar demo-status-bar--active mb-4"
  >
    <div>
      <strong><i class="pi pi-sparkles mr-2" />Demo mode is active</strong>
      <p>Sample records are tracked separately. Your real organization data is never part of demo cleanup.</p>
    </div>
    <div class="demo-status-actions">
      <Button label="Guided tour" icon="pi pi-compass" size="small" @click="startGuidedDemoTour" />
      <Button label="Reset samples" icon="pi pi-refresh" severity="secondary" size="small" :loading="demoLoading" @click="resetDemo" />
      <Button label="Exit" icon="pi pi-sign-out" severity="secondary" size="small" text :loading="demoLoading" @click="exitDemo" />
      <Button label="Delete samples" icon="pi pi-trash" severity="danger" size="small" text :loading="demoLoading" @click="deleteDemo" />
    </div>
  </div>

  <div
    v-else-if="props.mode !== 'dialog' && !loading && isAdmin && status?.demo?.hasData"
    class="demo-status-bar mb-4"
  >
    <div>
      <strong>Demo samples are currently inactive</strong>
      <p>Re-enter the guided demo or delete the tracked sample records.</p>
    </div>
    <div class="demo-status-actions">
      <Button label="Re-enter demo" icon="pi pi-play" size="small" :loading="demoLoading" @click="activateDemo" />
      <Button label="Delete samples" icon="pi pi-trash" severity="danger" size="small" text :loading="demoLoading" @click="deleteDemo" />
    </div>
  </div>

  <Message
    v-if="props.mode !== 'dialog' && demoError"
    severity="error"
    :closable="false"
    class="mb-4"
  >{{ demoError }}</Message>

  <Button
    v-if="props.mode !== 'dialog' && !loading && status && !status.wizardCompleted"
    severity="primary"
    size="large"
    icon="pi pi-bolt"
    label="Get Started in Under 30 Minutes 🚀"
    class="mb-4 w-full"
    @click="handleTriggerClick"
  />
  <Button
    v-if="props.mode !== 'dialog' && !loading && isAdmin && status?.demo?.eligible && !status?.demo?.hasData"
    severity="success"
    size="large"
    icon="pi pi-play-circle"
    label="Explore a ready-made demo"
    class="mb-4 w-full"
    :loading="demoLoading"
    @click="activateDemo"
  />
  <Button
    v-if="props.mode !== 'dialog' && !loading && isAdmin && status?.demo?.hasExistingTenantData && !status?.demo?.hasData"
    severity="secondary"
    size="small"
    icon="pi pi-sparkles"
    label="Add removable sample data for a guided demo"
    class="mb-4"
    :loading="demoLoading"
    @click="activateDemo"
  />

  <Dialog v-if="props.mode !== 'button'" v-model:visible="dialog" :style="{width:'900px'}" modal @update:visible="(v: boolean) => { if (!v) dismissWizard() }">
    <template #header>
      <div class="w-full text-center">
        <h2 class="text-xl font-bold mb-3">{{ step === 0 ? 'See AssetNode in action' : 'Get Started in Under 30 Minutes 🚀' }}</h2>
        <div class="stepper-header">
          <template v-for="(s, i) in status?.steps" :key="s.key">
            <div class="step-circle" :class="{ active: step === i + 1, completed: s.completed }">
              <i v-if="s.completed" class="pi pi-check" style="font-size:12px;"></i>
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="step-label" :class="{ active: step === i + 1, completed: s.completed }">{{ s.title }}</span>
            <div v-if="i < (status?.steps.length ?? 0) - 1" class="step-line" :class="{ completed: s.completed }" />
          </template>
        </div>
      </div>
    </template>

    <template v-if="step === 0">
      <div class="demo-choice">
        <div class="demo-choice-icon"><i class="pi pi-play-circle" /></div>
        <h3>Explore a working IT inventory in 30 seconds</h3>
        <p>
          We add clearly labelled sample employees, devices, assignments, a license and an automation
          to your organization. You can click through the real product immediately.
        </p>
        <div class="demo-benefits">
          <span><i class="pi pi-check" /> No integration setup</span>
          <span><i class="pi pi-check" /> Safe sample identities</span>
          <span><i class="pi pi-check" /> No duplicate data on retry</span>
        </div>
        <Message v-if="demoError" severity="error" :closable="false">{{ demoError }}</Message>
        <Button
          label="Enter demo mode"
          icon="pi pi-play"
          severity="success"
          size="large"
          :loading="demoLoading"
          @click="activateDemo"
        />
        <Button
          label="Set up my own data instead"
          severity="secondary"
          text
          @click="step = 1"
        />
      </div>
    </template>

    <template v-if="step === 1">
      <h3 class="font-bold mb-1">Add your Employees</h3>
      <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">
        Add your employees to AssetNode so you can assign assets and other items to them.
        This will not give them access to sign into AssetNode, that is done later in Step 3 (Users).
      </p>

      <h4 class="font-bold mb-3">Automatic SCIM Provisioning (Recommended)</h4>
      <div class="integration-grid mb-4">
        <div class="integration-card" @click="goToGuide('scim-azure-ad')"><i class="pi pi-microsoft" style="font-size:24px;"></i><div>Azure AD Guide</div></div>
        <div class="integration-card" @click="goToGuide('scim-okta')"><i class="pi pi-shield" style="font-size:24px;"></i><div>Okta Guide</div></div>
        <div class="integration-card" @click="goToGuide('scim-onelogin')"><i class="pi pi-user" style="font-size:24px;"></i><div>OneLogin Guide</div></div>
      </div>

      <h4 class="font-bold mb-3">HR Directory Sync</h4>
      <div class="integration-grid mb-4">
        <div class="integration-card" @click="goToGuide('personio')"><i class="pi pi-users" style="font-size:24px;"></i><div>Personio Guide</div></div>
        <div class="integration-card" @click="goToGuide('bamboohr')"><i class="pi pi-users" style="font-size:24px;"></i><div>BambooHR Guide</div></div>
        <div class="integration-card" @click="goToGuide('google-workspace-directory')"><i class="pi pi-google" style="font-size:24px;"></i><div>Google Workspace Guide</div></div>
        <div class="integration-card" @click="goToGuide('hibob')"><i class="pi pi-users" style="font-size:24px;"></i><div>HiBob Guide</div></div>
      </div>

      <div class="mb-2"><div class="font-bold" style="font-size:13px;">Endpoint URL:</div>
        <div class="flex align-items-center gap-2">
          <code style="word-break:break-all;font-size:13px;">{{ status?.scim.endpointUrl }}</code>
          <Button v-if="status?.scim.endpointUrl" size="small" text :icon="copied === 'endpoint' ? 'pi pi-check' : 'pi pi-copy'" @click="copyToClipboard(status?.scim.endpointUrl || '', 'endpoint')" />
        </div>
      </div>
      <div class="mb-4">
        <div class="font-bold" style="font-size:13px;">Secret Token:</div>
        <div class="flex align-items-center gap-2 mt-1">
          <code v-if="revealedToken" style="word-break:break-all;font-size:13px;flex:1;">{{ revealedToken }}</code>
          <span v-else style="font-size:13px;color:var(--an-text-muted);">No token generated yet</span>
          <Button v-if="revealedToken" size="small" text :icon="copied === 'token' ? 'pi pi-check' : 'pi pi-copy'" @click="copyToClipboard(revealedToken, 'token')" />
          <Button
            size="small"
            :severity="revealedToken ? 'warn' : 'primary'"
            :icon="revealedToken ? 'pi pi-refresh' : 'pi pi-key'"
            :label="revealedToken ? 'Regenerate' : 'Generate Token'"
            :loading="generatingToken"
            @click="generateToken"
          />
        </div>
      </div>

      <div class="text-center mb-4" style="color:var(--an-text-muted);">OR</div>

      <h4 class="font-bold mb-3">Other Methods</h4>
      <div class="flex gap-3">
        <Button severity="primary" icon="pi pi-file-excel" label="Excel Import Guide" @click="goToImport" />
        <Button severity="primary" icon="pi pi-code" label="API Guide" @click="goToSettings('apiKeys')" />
      </div>
    </template>

    <template v-if="step === 2">
      <h3 class="font-bold mb-1">Add your Assets</h3>
      <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">Get in full control of your assets by adding all your devices to AssetNode.</p>

      <h4 class="font-bold mb-3">Automatic MDM Synchronization (Recommended)</h4>
      <div class="integration-grid mb-4">
        <div v-for="mdm in mdmProviders" :key="mdm.key" class="integration-card integration-card--with-action">
          <div class="integration-card-top" @click="goToGuide(mdm.guideSlug)">
            <i :class="mdm.icon" style="font-size:24px;"></i>
            <div>{{ mdm.label }}</div>
          </div>
          <button class="integration-card-action" @click.stop="goToSettings(mdm.settingsSection)">
            <i class="pi pi-bolt" style="font-size:11px;"></i> Setup {{ mdm.shortLabel }}
          </button>
        </div>
      </div>

      <div class="text-center mb-4" style="color:var(--an-text-muted);">OR</div>

      <h4 class="font-bold mb-3">Other Methods</h4>
      <div class="flex gap-3">
        <Button severity="primary" icon="pi pi-file-excel" label="Excel Import Guide" @click="goToImport" />
        <Button severity="primary" icon="pi pi-code" label="API Guide" @click="goToSettings('apiKeys')" />
      </div>
    </template>

    <template v-if="step === 3">
      <h3 class="font-bold mb-1">Add your Users</h3>
      <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">Give your team members access to your AssetNode account, to make things smoother and more efficient.</p>

      <h4 class="font-bold mb-3">Single Sign-On (Recommended)</h4>
      <div class="integration-grid mb-4">
        <div v-for="sso in ssoProviders" :key="sso.key" class="integration-card" @click="goToGuide(sso.guideSlug)">
          <i :class="sso.icon" style="font-size:24px;"></i>
          <div style="font-size:12px;line-height:1.2;">{{ sso.label }}</div>
        </div>
      </div>

      <div class="mb-2"><div class="font-bold" style="font-size:13px;">Your SSO ID:</div>
        <div class="flex align-items-center gap-2">
          <code style="font-size:13px;">{{ status?.sso.ssoId || 'Not configured' }}</code>
          <Button v-if="status?.sso.ssoId" size="small" text :icon="copied === 'ssoId' ? 'pi pi-check' : 'pi pi-copy'" @click="copyToClipboard(status?.sso.ssoId || '', 'ssoId')" />
        </div>
      </div>
      <Button severity="primary" icon="pi pi-bolt" label="Setup SSO" class="mt-2 mb-4" @click="goToSettings('integrations')" />

      <div class="text-center mb-4" style="color:var(--an-text-muted);">OR</div>

      <h4 class="font-bold mb-3">Other Methods</h4>
      <Button severity="primary" icon="pi pi-user-plus" label="Manual Account Invitation" @click="goToSettings('users')" />
    </template>

    <template v-if="step === 4">
      <h3 class="font-bold mb-1">Setup Notifications</h3>
      <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">
        Never miss another important event with alerts for assets due back or in low stock,
        warranty expirations, EOLs and more.
        You can configure notification types and intervals later in your
        <a style="color:var(--p-primary-color);cursor:pointer;" @click="goToSettings('notifications')">account settings</a>.
      </p>

      <h4 class="font-bold mb-3">Email Notifications</h4>
      <div class="flex align-items-center gap-3 mb-2" style="max-width:600px;">
        <span style="white-space:nowrap;font-size:14px;color:var(--an-text-muted);">Email Address(es)</span>
        <InputText v-model="notifForm.emailAddress" placeholder="Email Address(es)" class="flex-grow-1" />
      </div>
      <Button severity="primary" icon="pi pi-save" label="Save" class="mb-4" style="max-width:600px;width:100%;" :loading="saving" />

      <h4 class="font-bold mb-3">Teams and Slack Notifications</h4>
      <div class="integration-grid mb-4">
        <div class="integration-card"><i class="pi pi-microsoft" style="font-size:24px;"></i><div>Teams Guide</div></div>
        <div class="integration-card"><i class="pi pi-slack" style="font-size:24px;"></i><div>Slack Guide</div></div>
      </div>

      <div class="flex align-items-center gap-3 mb-3" style="max-width:600px;">
        <span style="white-space:nowrap;min-width:140px;font-size:14px;color:var(--an-text-muted);">Teams Webhook URL</span>
        <InputText v-model="notifForm.teamsWebhookUrl" placeholder="Teams Webhook URL" class="flex-grow-1" />
      </div>
      <div class="flex align-items-center gap-3 mb-4" style="max-width:600px;">
        <span style="white-space:nowrap;min-width:140px;font-size:14px;color:var(--an-text-muted);">Slack Webhook URL</span>
        <InputText v-model="notifForm.slackWebhookUrl" placeholder="Slack Webhook URL" class="flex-grow-1" />
      </div>
      <Button severity="primary" icon="pi pi-save" label="Save" style="max-width:600px;width:100%;" :loading="saving" />
    </template>

    <template #footer>
      <div class="flex gap-2 justify-content-between w-full">
        <Button severity="secondary" text label="Skip for now" @click="dismissWizard" />
        <div class="flex gap-2">
          <Button v-if="step > 1" severity="secondary" label="Previous Step" @click="prevStep" />
          <Button v-else-if="step === 1 && status?.demo?.eligible" severity="secondary" label="Back" @click="step = 0" />
          <Button v-if="step < 4" severity="primary" label="Next Step" @click="nextStep" />
          <Button v-if="step === 4" severity="primary" :loading="saving" label="Complete" @click="completeWizard" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.stepper-header { display: flex; align-items: center; justify-content: center; flex-wrap: nowrap; }

.step-circle {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; flex-shrink: 0;
  background: rgba(255,255,255,0.1); color: var(--an-text-muted);
  transition: all 0.2s ease;
}
.step-circle.active { background: var(--p-primary-color); color: #fff; }
.step-circle.completed { background: var(--p-green-500); color: #fff; }

.step-label {
  font-size: 13px; font-weight: 500; margin: 0 4px;
  color: var(--an-text-muted); white-space: nowrap;
  transition: color 0.2s ease;
}
.step-label.active { color: var(--p-primary-color); font-weight: 600; }
.step-label.completed { color: var(--p-green-500); }

.step-line {
  flex: 1; height: 2px; margin: 0 4px; min-width: 20px;
  background: rgba(255,255,255,0.1);
  transition: background 0.2s ease;
}
.step-line.completed { background: var(--p-green-500); }

.integration-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.integration-card {
  cursor: pointer; padding: 16px; border-radius: 8px;
  text-align: center; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  transition: all 0.15s ease; font-size: 13px; font-weight: 500;
  min-height: 80px;
}
.integration-card:hover { border-color: var(--p-primary-color); box-shadow: 0 2px 12px rgba(25,118,210,0.15); }

.integration-card--with-action {
  padding: 0;
  gap: 0;
}

.integration-card-top {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px;
  padding: 16px 12px 12px; flex: 1;
  cursor: pointer;
}

.integration-card-action {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  width: 100%; padding: 8px 4px;
  background: var(--p-primary-color); color: #fff;
  border: none; border-radius: 0 0 7px 7px;
  font-size: 11px; font-weight: 600;
  cursor: pointer; transition: background 0.15s ease;
}

.integration-card-action:hover {
  background: var(--p-primary-700, #4338ca);
}

.demo-choice {
  max-width: 620px;
  margin: 24px auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.demo-choice h3 { margin: 0; font-size: 24px; }
.demo-choice p { margin: 0; color: var(--an-text-muted); line-height: 1.6; }
.demo-choice-icon {
  width: 72px; height: 72px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(16, 185, 129, 0.12); color: #34d399; font-size: 34px;
}
.demo-benefits { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; font-size: 13px; }
.demo-benefits i { color: #34d399; margin-right: 4px; }

.demo-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border: 1px solid var(--an-border-dark);
  border-radius: 12px;
  background: var(--an-surface-dark);
}
.demo-status-bar--active {
  border-color: rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.08);
}
.demo-status-bar p {
  margin: 5px 0 0;
  color: var(--an-text-muted);
  font-size: 13px;
}
.demo-status-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

@media (max-width: 760px) {
  .demo-status-bar { align-items: stretch; flex-direction: column; }
  .demo-status-actions { justify-content: flex-start; }
}
</style>
