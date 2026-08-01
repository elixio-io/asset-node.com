<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useOnboardingTour } from '../composables/useOnboardingTour'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'

const { t } = useI18n()

const activeSection = ref('general')

const sections = computed(() => [
  { key: 'general', title: t('settings.general'), icon: 'pi pi-cog' },
  { key: 'users', title: t('settings.users'), icon: 'pi pi-users' },
  { key: 'customFields', title: t('settings.customFields'), icon: 'pi pi-pencil' },
  { key: 'customStatuses', title: t('settings.customStatuses'), icon: 'pi pi-tags' },
  { key: 'lowStock', title: t('settings.lowStockAlerts'), icon: 'pi pi-exclamation-triangle' },
  { key: 'notifications', title: t('settings.notifications'), icon: 'pi pi-bell' },
  { key: 'apiKeys', title: t('settings.apiKeys'), icon: 'pi pi-key' },
  { key: 'webhooks', title: t('settings.webhookTitle'), icon: 'pi pi-link' },
  { key: 'integrations', title: t('settings.integrations'), icon: 'pi pi-th-large' },
  { key: 'smartAutomations', title: 'Smart Automations', icon: 'pi pi-bolt' }
])

interface OrgSettings {
  name: string
  settings?: {
    defaultCurrency?: string
    depreciationYears?: number
    lowStockThreshold?: number
    customStatuses?: string[]
    customFields?: { name: string; fieldType: string; required?: boolean; options?: string[] }[]
    smartAutomations?: {
      returnReminders?: { enabled?: boolean; daysBefore?: number }
      onboardingEmails?: { enabled?: boolean }
      offboardingCleanup?: { enabled?: boolean }
      assetAudits?: { enabled?: boolean; frequencyMonths?: number }
      autoProvisioning?: { enabled?: boolean; rules?: { jobTitlePattern: string; categories: string[] }[] }
    }
  }
}

const org = ref<OrgSettings | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)

const generalForm = ref({
  name: '',
  defaultCurrency: 'EUR',
  depreciationYears: 5,
  lowStockThreshold: 3
})

const smartAutomationsForm = ref({
  returnReminders: { enabled: false, daysBefore: 14 },
  onboardingEmails: { enabled: false },
  offboardingCleanup: { enabled: false },
  assetAudits: { enabled: false, frequencyMonths: 6 },
  autoProvisioning: { enabled: false, rules: [] as Array<{ jobTitlePattern: string; categories: string[] }> }
})

const hardwareCategories = ref<any[]>([])
async function fetchCategories() {
  try {
    const res = await api.get('/categories?entityType=hardware')
    hardwareCategories.value = res.data
  } catch (err) { console.error('Failed to fetch categories:', err) }
}

function addProvisioningRule() {
  smartAutomationsForm.value.autoProvisioning.rules.push({ jobTitlePattern: '', categories: [] })
}

function removeProvisioningRule(index: number) {
  smartAutomationsForm.value.autoProvisioning.rules.splice(index, 1)
}

const newFieldDialog = ref(false)
const newField = ref({
  name: '',
  fieldType: 'text' as string,
  required: false,
  options: ''
})

const newStatusInput = ref('')

const lowStockData = ref<{ threshold: number; hardware: any[]; peripherals: any[]; totalAlerts: number } | null>(null)

const invites = ref<any[]>([])
const invitesLoading = ref(false)
const inviteDialog = ref(false)
const inviteSending = ref(false)
const inviteForm = ref({ email: '', role: 'employee' })
const inviteError = ref<string | null>(null)

async function loadInvites() {
  invitesLoading.value = true
  try {
    const res = await api.get('/invites')
    invites.value = res.data
  } catch { invites.value = [] }
  finally { invitesLoading.value = false }
}

async function sendInvite() {
  inviteError.value = null
  if (!inviteForm.value.email) { inviteError.value = t('common.required'); return }
  inviteSending.value = true
  try {
    await api.post('/invites', inviteForm.value)
    successMsg.value = t('settings.inviteSent')
    inviteDialog.value = false
    inviteForm.value = { email: '', role: 'employee' }
    await loadInvites()
  } catch (err: any) {
    inviteError.value = err.response?.data?.error || t('settings.inviteError')
  } finally { inviteSending.value = false }
}

async function revokeInvite(id: string) {
  try {
    await api.delete(`/invites/${id}`)
    successMsg.value = t('settings.inviteRevoked')
    await loadInvites()
  } catch { error.value = t('settings.inviteError') }
}

interface NotifPrefs {
  channels: {
    email: { enabled: boolean; address: string; webhookUrl?: string }
    slack: { enabled: boolean; webhookUrl: string; address?: string }
    teams: { enabled: boolean; webhookUrl: string; address?: string }
  }
  events: Record<string, { email: boolean; slack: boolean; teams: boolean }>
  intervals: { first: number; second: number; third: number; fourth: number }
}

const notifPrefs = ref<NotifPrefs | null>(null)
const notifLoading = ref(false)
const testingChannel = ref<string | null>(null)

const EVENT_TYPES = [
  { key: 'checkInOut', label: 'Check-in / Check-out' },
  { key: 'lowStock', label: 'Low Stock Alert' },
  { key: 'licenseExpiry', label: 'License Expiry' },
  { key: 'warrantyExpiry', label: 'Warranty Expiry' },
  { key: 'assetAudit', label: 'Asset Audit' },
  { key: 'assetDueBack', label: 'Asset Due Back' },
  { key: 'endOfLife', label: 'End of Life' },
  { key: 'maintenanceDone', label: 'Maintenance Complete' }
]

async function fetchNotifPrefs() {
  notifLoading.value = true
  try { const res = await api.get('/notifications/preferences'); notifPrefs.value = res.data }
  catch { notifPrefs.value = null }
  finally { notifLoading.value = false }
}

async function saveNotifPrefs() {
  if (!notifPrefs.value) return
  saving.value = true
  try {
    await api.patch('/notifications/preferences', notifPrefs.value)
    successMsg.value = t('settings.saved')
    setTimeout(() => successMsg.value = null, 3000)
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to save' }
  finally { saving.value = false }
}

async function testChannel(channel: 'email' | 'slack' | 'teams') {
  if (!notifPrefs.value) return
  const ch = notifPrefs.value.channels[channel]
  const target = channel === 'email' ? ch.address : ch.webhookUrl
  if (!target) return
  testingChannel.value = channel
  try {
    const res = await api.post('/notifications/test', { channel, target })
    if (res.data.success) { successMsg.value = `Test ${channel} notification sent!` }
    else { error.value = `Test failed: ${res.data.error}` }
    setTimeout(() => { successMsg.value = null; error.value = null }, 4000)
  } catch (err: any) { error.value = err.response?.data?.error || 'Test failed' }
  finally { testingChannel.value = null }
}

interface ApiKeyItem { _id: string; name: string; keyPrefix: string; lastUsedAt?: string; createdAt: string; createdBy?: { firstName: string; lastName: string } }
const apiKeys = ref<ApiKeyItem[]>([])
const apiKeysLoading = ref(false)
const newKeyDialog = ref(false)
const newKeyName = ref('')
const generatedKey = ref<string | null>(null)

async function fetchApiKeys() {
  apiKeysLoading.value = true
  try { const res = await api.get('/api-keys'); apiKeys.value = res.data }
  catch { apiKeys.value = [] }
  finally { apiKeysLoading.value = false }
}

async function generateApiKey() {
  if (!newKeyName.value.trim()) return
  try {
    const res = await api.post('/api-keys', { name: newKeyName.value.trim() })
    generatedKey.value = res.data.key
    newKeyName.value = ''
    await fetchApiKeys()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to generate key' }
}

async function revokeApiKey(id: string) {
  try { await api.delete(`/api-keys/${id}`); await fetchApiKeys() }
  catch (err: any) { error.value = err.response?.data?.error || 'Failed to revoke key' }
}

function closeKeyDialog() { newKeyDialog.value = false; generatedKey.value = null; newKeyName.value = '' }

interface WebhookItem { _id: string; url: string; events: string[]; description?: string; isActive: boolean; lastTriggeredAt?: string; failureCount: number; createdAt: string }
const webhooks = ref<WebhookItem[]>([])
const webhooksLoading = ref(false)
const newWebhookDialog = ref(false)
const newWebhook = ref({ url: '', events: [] as string[], description: '' })
const testingWebhook = ref<string | null>(null)

function copyToClipboard(text: string) { navigator.clipboard.writeText(text) }

const WEBHOOK_EVENTS = [
  'asset.assigned', 'asset.returned', 'asset.created', 'asset.deleted',
  'maintenance.completed', 'audit.completed',
  'employee.onboarded', 'employee.offboarded',
  'lowStock.alert'
]

async function fetchWebhooks() {
  webhooksLoading.value = true
  try { const res = await api.get('/webhooks'); webhooks.value = res.data }
  catch { webhooks.value = [] }
  finally { webhooksLoading.value = false }
}

async function createWebhook() {
  if (!newWebhook.value.url || !newWebhook.value.events.length) return
  try {
    await api.post('/webhooks', newWebhook.value)
    newWebhookDialog.value = false
    newWebhook.value = { url: '', events: [], description: '' }
    await fetchWebhooks()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to create webhook' }
}

async function testWebhook(id: string) {
  testingWebhook.value = id
  try {
    const res = await api.post(`/webhooks/${id}/test`)
    if (res.data.success) { successMsg.value = 'Webhook test delivered!' }
    else { error.value = `Webhook test failed (HTTP ${res.data.status})` }
    setTimeout(() => { successMsg.value = null; error.value = null }, 4000)
  } catch (err: any) { error.value = err.response?.data?.error || 'Test failed' }
  finally { testingWebhook.value = null }
}

async function deleteWebhook(id: string) {
  try { await api.delete(`/webhooks/${id}`); await fetchWebhooks() }
  catch (err: any) { error.value = err.response?.data?.error || 'Failed to delete webhook' }
}

interface IntegrationConfigs {
  intune: { enabled: boolean; tenantId: string; clientId: string; clientSecret: string; syncInterval: number; lastSyncAt?: string }
  autopilot: { enabled: boolean; tenantId: string; clientId: string; clientSecret: string; syncInterval: number; lastSyncAt?: string }
  jamf: { enabled: boolean; serverUrl: string; username: string; password: string; syncInterval: number; lastSyncAt?: string }
  kandji: { enabled: boolean; subdomain: string; apiToken: string; syncInterval: number; lastSyncAt?: string }
  personio: { enabled: boolean; clientId: string; clientSecret: string; syncInterval: number; lastSyncAt?: string }
  scim: { enabled: boolean; bearerToken: string; provisionUsers: boolean; deprovisionUsers: boolean; autoCreateDepartments: boolean }
  sso: { enabled: boolean; provider: string; entityId: string; ssoUrl: string; certificate: string; forceSso: boolean; allowedDomains: string[] }
  bamboohr: { enabled: boolean; subdomain: string; apiKey: string; syncInterval: number; lastSyncAt?: string }
  googleWorkspace: { enabled: boolean; domain: string; serviceAccountKey: string; adminEmail: string; syncInterval: number; lastSyncAt?: string }
  hibob: { enabled: boolean; serviceUserId: string; apiToken: string; syncInterval: number; lastSyncAt?: string }
  mosyle: { enabled: boolean; apiToken: string; syncInterval: number; lastSyncAt?: string }
  helpdesk: { enabled: boolean; provider: 'zendesk' | 'freshdesk' | ''; subdomain: string; email: string; apiToken: string; lastDeliveryAt?: string; lastFailureAt?: string }
}

interface GuideStep { title: string; description: string; note?: string; images?: string[] }
interface GuideDefinition {
  title: string; category: 'scim' | 'mdm' | 'sso' | 'hr' | 'helpdesk'; icon: string; iconColor: string
  providerName: string; intro: string; steps: GuideStep[]; afterSteps: string[]
  syncInfo?: string; imageDir?: string
}

const GUIDES: Record<string, GuideDefinition> = {
  'intune': {
    title: 'Microsoft Intune Integration', category: 'mdm', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'Microsoft Intune',
    intro: 'Automatically add devices from Intune into AssetNode as assets.',
    steps: [
      { title: 'Log in to your Azure Portal', description: 'Navigate to portal.azure.com and sign in.', images: ['649b1584e2104216889f3298_app-registration.webp'] },
      { title: 'Register a new application', description: 'Go to App registrations → New registration. Name it "AssetNode Intune".', images: ['649b1584e2104216889f3299_new registration.webp'] },
      { title: 'Note your credentials', description: 'Copy the Application (client) ID and Directory (tenant) ID.', images: ['64a2814bfa8e6bfde368252e_intune-3.webp'] },
      { title: 'Create a client secret', description: 'Go to Certificates & secrets → New client secret. Copy the Value immediately.', images: ['6903b227b731fd3519f6daec_intune-4-new.webp'] },
      { title: 'Configure API permissions', description: 'Add DeviceManagementManagedDevices.Read.All. Grant admin consent.', images: ['64a283e6d886f6640a8916f4_intune-6.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to Settings → Intune section. Enter the Tenant ID, Client ID, and Client Secret.', note: 'The first device sync will take approximately 10 minutes.', images: ['64a6be020038431349306354_intune-8.webp'] },
      { title: 'Verify sync', description: 'Check the sync status and verify devices appear in your asset list.', images: ['64a6c4c16daf003434b89282_intune-14.webp'] }
    ],
    afterSteps: ['To automatically checkout assets to employees, add employees first (via SCIM or import).', 'New devices added to Intune are automatically created as assets in AssetNode.'],
    syncInfo: 'Syncs every ~10 minutes'
  },
  'autopilot': {
    title: 'Windows Autopilot Integration', category: 'mdm', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'Windows Autopilot',
    intro: 'Automatically add devices from Windows Autopilot into AssetNode as assets.',
    steps: [
      { title: 'Log in to your Azure account', description: 'Navigate to portal.azure.com and sign in.', images: ['677e672b56a1b8c0bd2da1b0_autopilot_1.webp'] },
      { title: 'Register a new application', description: 'Go to App registrations → New registration.', images: ['649b1584e2104216889f3298_app-registration.webp'] },
      { title: 'Set up API permissions', description: 'Add DeviceManagementServiceConfig.Read.All.', images: ['6903b4f4f09c3bf6c7b54dc8_autopilot-4-new.webp'] },
      { title: 'Create a client secret', description: 'Go to Certificates & secrets → New client secret.', images: ['677e67df7c03c03d09f6c598_autopilot_6.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → Autopilot section.', images: ['677e683cc45e4db0e24c44b5_autopilot_9.webp'] },
      { title: 'Verify the integration', description: 'Verify that Autopilot devices appear in your asset list.', images: ['677e69214d15448bfdb2341e_autopilot_13.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'All new Autopilot devices will be automatically added as assets.'],
    syncInfo: 'Syncs periodically'
  },
  'jamf': {
    title: 'Jamf Pro Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'grey', providerName: 'Jamf Pro',
    intro: 'Automatically add devices from Jamf Pro into AssetNode as assets.',
    steps: [
      { title: 'Log in to your Jamf Pro account', description: 'Navigate to your Jamf Pro instance URL.', images: ['64a6c8ad523e75aed30cd60b_jamf-pro-1.webp'] },
      { title: 'Access API Settings', description: 'Under System Settings, find API Roles and Clients.', images: ['64a6c8ace1f3eed3ffedb476_jamf-pro-3.webp'] },
      { title: 'Create an API role', description: 'Create a new API role with Read permissions.', images: ['64a6c8ac3d9207c4a1bfc71f_jamf-pro-4.webp'] },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → Jamf Pro section.', images: ['64a6c8afe310b4beae8154ba_jamf-pro-7.webp'] },
      { title: 'Save and enable', description: 'Click Save and Enable.', images: ['64a6c8b0c7c50d4bdb7b9fa6_jamf-pro-9.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'New devices added to Jamf Pro will automatically be added as assets.'],
    syncInfo: 'Syncs every ~10 minutes'
  },
  'kandji': {
    title: 'Kandji Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'amber', providerName: 'Kandji',
    intro: 'Automatically add devices from Kandji into AssetNode as assets.',
    steps: [
      { title: 'Log in to your Kandji account', description: 'Navigate to your Kandji tenant.', images: ['64a7095730e87feb388981ca_kandji-1.webp'] },
      { title: 'Access API tokens', description: 'Navigate to Settings → Access → API Token.', images: ['64a70979d519617f8ae62c5a_kandji-3.webp'] },
      { title: 'Create an API token', description: 'Name the token "AssetNode Integration".', images: ['64a7098ea6a0c18c05409480_kandji-4.webp'] },
      { title: 'Enter details in AssetNode', description: 'Go to AssetNode Settings → MDM section.', images: ['64a709b185de4853cb52c6f8_kandji-6.webp'] },
      { title: 'Save and verify', description: 'Click Save. The first sync will take approximately 10 minutes.', images: ['64a709d4bc003bb90dcb45c1_kandji-9.webp'] }
    ],
    afterSteps: ['The first transfer takes approximately 10 minutes.', 'New devices added to Kandji will automatically be added as assets.'],
    syncInfo: 'Syncs every ~10 minutes'
  },
  'mosyle': {
    title: 'Mosyle MDM Integration', category: 'mdm', icon: 'pi pi-apple', iconColor: 'purple', providerName: 'Mosyle',
    intro: 'Automatically import Apple devices from Mosyle Manager into AssetNode as assets.',
    steps: [
      { title: 'Log in to Mosyle Manager', description: 'Navigate to your Mosyle Manager portal and sign in with administrator credentials.' },
      { title: 'Generate an API token', description: 'Go to Organization → Integrations → API Integration. Enable API access and generate a new API token.' },
      { title: 'Copy the API token', description: 'Copy the generated API token.', note: 'Store this token securely — it is only shown once.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → MDM section → Mosyle. Paste the API token and click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin syncing Apple devices from Mosyle.' }
    ],
    afterSteps: ['The first device transfer takes approximately 10 minutes.', 'New devices enrolled in Mosyle will automatically appear as assets in AssetNode.'],
    syncInfo: 'Syncs every ~10 minutes'
  },
  'scim': {
    title: 'SCIM with Microsoft Entra ID (Azure AD)', category: 'scim', icon: 'pi pi-microsoft', iconColor: 'blue', providerName: 'SCIM 2.0',
    intro: 'Automatically sync employee entries with users from Microsoft Entra ID (formerly Azure AD). Any changes you make to users in Entra ID will be synchronized to AssetNode.',
    imageDir: 'sso-azure-ad',
    steps: [
      { title: 'Log in to Azure and open Entra ID', description: 'Navigate to portal.azure.com, sign in with your administrator account, and click on Microsoft Entra ID.', images: ['64a70c585f2502e358f8c613_scim-ad-1.webp'] },
      { title: 'Create a new Enterprise Application', description: 'Go to Enterprise Applications → New Application → Create your own application.', images: ['64a70c6ea6a0c18c05446146_scim-ad-2.webp'] },
      { title: 'Open Provisioning settings', description: 'In your newly created application, click on Provisioning in the left sidebar.', images: ['64a70c8df630fe0aca1a1482_scim-ad-4.webp'] },
      { title: 'Set Provisioning Mode and enter credentials', description: 'Change the Provisioning Mode to "Automatic". Enter the Tenant URL and Secret Token from your AssetNode SCIM settings.', note: 'If Test Connection fails, double-check that you copied the full SCIM Endpoint URL and Bearer Token from AssetNode.' },
      { title: 'Assign Users and Groups', description: 'Go to "Users and groups" in the left sidebar, then click "Add user/group". Select the users or groups you want to synchronize.' },
      { title: 'Start Provisioning', description: 'Go back to Provisioning and click "Start provisioning".', note: 'You can monitor the provisioning status on this page.' }
    ],
    afterSteps: ['Syncs approximately every 40 minutes.', 'Changes in Entra ID will automatically reflect in AssetNode.', 'Removed users are marked as "Archived" (not deleted).'],
    syncInfo: 'Syncs every ~40 minutes'
  },
  'sso': {
    title: 'Single Sign-On with Azure Active Directory', category: 'sso', icon: 'pi pi-shield', iconColor: 'blue', providerName: 'SSO / SAML',
    intro: 'Let your team members log in to AssetNode using their Microsoft credentials.',
    steps: [
      { title: 'Log in to your Azure Portal', description: 'Navigate to portal.azure.com.', images: ['64a70c585f2502e358f8c613_scim-ad-1.webp'] },
      { title: 'Create an Enterprise Application', description: 'Go to Enterprise Applications → New Application → Create your own.', images: ['64a70c6ea6a0c18c05446146_scim-ad-2.webp'] },
      { title: 'Configure Single Sign-On', description: 'Go to Single sign-on → Select "SAML".', images: ['64a70c8df630fe0aca1a1482_scim-ad-4.webp'] },
      { title: 'Set up Basic SAML Configuration', description: 'Set the Entity ID and Reply URL from your AssetNode SSO settings.', images: ['64a70daaf2e26e962dbc241d_sso-ad-5.webp'] },
      { title: 'Download the certificate', description: 'Download the "Certificate (Base64)".', images: ['64a70ddea72fe7514bbfe926_sso-ad-7.webp'] },
      { title: 'Enter details in AssetNode', description: 'Go to Settings → SSO section. Enter Entity ID, SSO URL, and certificate.', images: ['64a70e4673220940048cddb5_sso-ad-10.webp'] },
      { title: 'Assign users', description: 'Assign users or groups to the application.', images: ['64a70e9973220940048d3eff_sso-ad-12.webp'] }
    ],
    afterSteps: ['Once SSO is active, new users get access by being assigned in Azure AD.', 'You can enable "Force SSO" to disable password-based login entirely.']
  },
  'personio': {
    title: 'Personio HR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'teal', providerName: 'Personio',
    intro: 'Automatically sync employees from Personio HR into AssetNode. Active employees will be created and kept up to date.',
    steps: [
      { title: 'Log in to Personio', description: 'Navigate to your Personio account and sign in as an administrator.' },
      { title: 'Create API credentials', description: 'Go to Settings → Integrations → API Credentials. Click "Generate new credentials".' },
      { title: 'Set API permissions', description: 'Grant read access to "Employees" and "Employment details".' },
      { title: 'Copy Client ID and Client Secret', description: 'Copy both credentials.', note: 'The Client Secret is only shown once — store it securely.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → Personio. Enter the Client ID, Client Secret, and click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing your employee directory.' }
    ],
    afterSteps: ['Active employees from Personio will be automatically created in AssetNode.', 'Department, job title, and start date are synced.'],
    syncInfo: 'Syncs on configured interval'
  },
  'bamboohr': {
    title: 'BambooHR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'green', providerName: 'BambooHR',
    intro: 'Automatically sync your employee directory from BambooHR into AssetNode.',
    steps: [
      { title: 'Log in to BambooHR', description: 'Navigate to your BambooHR account.' },
      { title: 'Generate an API key', description: 'Click your profile icon → API Keys → Add New Key. Name it "AssetNode Integration".' },
      { title: 'Copy the API key', description: 'Copy the generated API key immediately.', note: 'The API key is only displayed once — store it securely.' },
      { title: 'Note your subdomain', description: 'Your BambooHR subdomain is the part before .bamboohr.com in your URL.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → BambooHR. Enter the subdomain and API key, then click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will import your employee directory.' }
    ],
    afterSteps: ['Active employees from BambooHR will be automatically created and updated in AssetNode.', 'Name, email, department, job title, and location are synced.'],
    syncInfo: 'Syncs on configured interval'
  },
  'googleWorkspace': {
    title: 'Google Workspace Directory Sync', category: 'hr', icon: 'pi pi-google', iconColor: 'red', providerName: 'Google Workspace',
    intro: 'Automatically sync users from your Google Workspace directory into AssetNode as employees.',
    steps: [
      { title: 'Open Google Cloud Console', description: 'Navigate to console.cloud.google.com and select your project.' },
      { title: 'Enable the Admin SDK API', description: 'Go to APIs & Services → Library. Search for "Admin SDK API" and click Enable.' },
      { title: 'Create a service account', description: 'Go to IAM & Admin → Service Accounts → Create Service Account. Name it "AssetNode Directory Sync".' },
      { title: 'Create a JSON key', description: 'Click on the service account → Keys → Add Key → Create new key → JSON.', note: 'This file contains your private key — store it securely and never commit to version control.' },
      { title: 'Configure domain-wide delegation', description: 'In Google Admin → Security → API controls → Domain-wide delegation → Add new. Enter the service account Client ID and grant scope: https://www.googleapis.com/auth/admin.directory.user.readonly' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → Google Workspace. Paste the service account email, private key, and your admin email. Click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing users from your Google Workspace domain.' }
    ],
    afterSteps: ['Users from your Google Workspace domain will be automatically synced to AssetNode.', 'Suspended users will be marked as inactive.'],
    syncInfo: 'Syncs on configured interval'
  },
  'hibob': {
    title: 'HiBob HR Integration', category: 'hr', icon: 'pi pi-users', iconColor: 'orange', providerName: 'HiBob',
    intro: 'Automatically sync employees from HiBob into AssetNode. Active employees will be created and kept up to date.',
    steps: [
      { title: 'Log in to HiBob', description: 'Navigate to app.hibob.com and sign in with your administrator account.' },
      { title: 'Create a Service User', description: 'Go to Settings → Integrations → Service Users → Add a new service user. Name it "AssetNode Integration".' },
      { title: 'Set permissions', description: 'Grant read-only access to "People" data.' },
      { title: 'Generate an API token', description: 'Under the service user, generate a new API token. Copy both the Service User ID and the token.', note: 'The API token is only shown once — store it securely.' },
      { title: 'Enter credentials in AssetNode', description: 'Go to AssetNode Settings → HR Sync section → HiBob. Enter the Service User ID and API token, then click Save.' },
      { title: 'Verify sync', description: 'After saving, AssetNode will begin importing your employee list.' }
    ],
    afterSteps: ['Active employees from HiBob will be automatically created in AssetNode.', 'Name, email, department, job title, site, and start date are synced.'],
    syncInfo: 'Syncs on configured interval'
  },
  'helpdesk': {
    title: 'Helpdesk Ticket Bridge', category: 'helpdesk', icon: 'pi pi-ticket', iconColor: 'purple', providerName: 'Zendesk / Freshdesk',
    intro: 'Forward AssetNode support requests into your central helpdesk while retaining the tenant-scoped audit record in AssetNode.',
    steps: [
      { title: 'Choose your provider', description: 'Select Zendesk or Freshdesk. AssetNode only connects to the provider-owned tenant domain.' },
      { title: 'Create a least-privilege API credential', description: 'Generate an API token for an agent that may create tickets. Do not use a personal password.' },
      { title: 'Enter the tenant slug', description: 'Enter only the part before .zendesk.com or .freshdesk.com — never a complete URL.' },
      { title: 'Enter the agent email for Zendesk', description: 'Zendesk token authentication uses the agent email plus /token. Freshdesk only needs its API token.' },
      { title: 'Enable and save', description: 'New tickets from the in-app support form will be forwarded. If the provider is unavailable, AssetNode retains the local ticket and uses the configured fallback.' }
    ],
    afterSteps: ['Credentials are encrypted at rest and masked after saving.', 'External ticket identifiers are internal and never returned to end users.'],
    syncInfo: 'Forwards new tickets immediately'
  }
}

const currentGuide = computed<GuideDefinition | null>(() => GUIDES[selectedIntegrationKey.value] || null)

const guideCategory = computed(() => {
  switch (currentGuide.value?.category) {
    case 'scim': return { label: 'SCIM Provisioning', severity: 'success' }
    case 'mdm': return { label: 'MDM Integration', severity: 'info' }
    case 'sso': return { label: 'Single Sign-On', severity: 'warn' }
    case 'hr': return { label: 'HR Sync', severity: 'contrast' }
    case 'helpdesk': return { label: 'Helpdesk', severity: 'warn' }
    default: return { label: 'Setup Guide', severity: 'secondary' }
  }
})

function guideImageUrl(filename: string): string {
  const dir = currentGuide.value?.imageDir || selectedIntegrationKey.value
  return `/guide-images/${dir}/${filename}`
}

const expandedGuideImage = ref('')
const guideLightboxOpen = ref(false)
function openGuideLightbox(img: string) { expandedGuideImage.value = img; guideLightboxOpen.value = true }
function closeGuideLightbox() { guideLightboxOpen.value = false }

const integrations = ref<IntegrationConfigs | null>(null)
const integrationsLoading = ref(false)
const savingIntegration = ref<string | null>(null)
const ssoDomainsInput = ref('')
const generatingScimToken = ref(false)
const revealedScimToken = ref<string | null>(null)

const configPaneWidth = ref(360)
const isDraggingPane = ref(false)

function startPaneResize(e: MouseEvent) {
  isDraggingPane.value = true
  const startX = e.clientX
  const startWidth = configPaneWidth.value

  function onMove(ev: MouseEvent) {
    configPaneWidth.value = Math.max(240, Math.min(680, startWidth + (ev.clientX - startX)))
  }
  function onUp() {
    isDraggingPane.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const selectedIntegrationKey = ref('intune')
const integrationOptions = [
  { label: 'Microsoft Intune', value: 'intune' },
  { label: 'Windows Autopilot', value: 'autopilot' },
  { label: 'Jamf Pro', value: 'jamf' },
  { label: 'Kandji', value: 'kandji' },
  { label: 'Personio', value: 'personio' },
  { label: 'SCIM 2.0', value: 'scim' },
  { label: 'SSO / SAML', value: 'sso' },
  { label: 'BambooHR', value: 'bamboohr' },
  { label: 'Google Workspace', value: 'googleWorkspace' },
  { label: 'HiBob', value: 'hibob' },
  { label: 'Mosyle', value: 'mosyle' },
  { label: 'Zendesk / Freshdesk', value: 'helpdesk' }
]

const integrationDialog = ref(false)

function openIntegrationConfig(key: string) {
  selectedIntegrationKey.value = key
  integrationDialog.value = true
}

function getIntegrationIcon(key: string) {
  const icons: Record<string, string> = {
    intune: 'pi pi-microsoft',
    autopilot: 'pi pi-desktop',
    jamf: 'pi pi-apple',
    kandji: 'pi pi-mobile',
    personio: 'pi pi-users',
    scim: 'pi pi-sync',
    sso: 'pi pi-shield',
    bamboohr: 'pi pi-id-card',
    googleWorkspace: 'pi pi-google',
    hibob: 'pi pi-user',
    mosyle: 'pi pi-apple',
    helpdesk: 'pi pi-ticket'
  }
  return icons[key] || 'pi pi-cog'
}

function getIntegrationDescription(key: string) {
  const descs: Record<string, string> = {
    intune: 'Sync devices and attributes from Microsoft Intune.',
    autopilot: 'Import Autopilot-registered Windows devices.',
    jamf: 'Sync Apple devices and inventory from Jamf Pro.',
    kandji: 'Manage Apple devices and compliance with Kandji.',
    personio: 'Sync employee directory and departments from Personio.',
    scim: 'Automate user identity provisioning with SCIM 2.0.',
    sso: 'Configure enterprise Single Sign-On (SAML).',
    bamboohr: 'Sync employee directory and data from BambooHR.',
    googleWorkspace: 'Sync users and managed devices from Google.',
    hibob: 'Sync employee directory and HR data from HiBob.',
    mosyle: 'Sync Apple devices and MDM data from Mosyle.',
    helpdesk: 'Forward technical support requests to Zendesk or Freshdesk.'
  }
  return descs[key] || 'Configure integration settings.'
}

const scimEndpointUrl = computed(() => {
  const origin = window.location.origin
  const apiBase = origin.replace('app.asset-node.com', 'api.asset-node.com')
  return `${apiBase}/api/scim/v2`
})

const ssoMetadataUrl = computed(() => {
  const ssoSlug = (org.value as any)?.ssoSlug || ''
  const base = window.location.origin
  return ssoSlug ? `${base}/api/auth/sso/metadata/${ssoSlug}` : ''
})
const ssoAcsUrl = computed(() => {
  const base = window.location.origin
  return `${base}/api/auth/sso/callback`
})

async function loadScimToken() {
  try {
    const res = await api.get('/organization/integrations/scim/reveal-token')
    revealedScimToken.value = res.data.token
  } catch {
    revealedScimToken.value = null
  }
}

async function generateScimToken() {
  generatingScimToken.value = true
  try {
    const res = await api.post('/organization/integrations/scim/generate-token')
    revealedScimToken.value = res.data.token
    successMsg.value = t('settings.tokenGenerated') || 'Token generated!'
    setTimeout(() => { successMsg.value = null }, 5000)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to generate token'
  } finally {
    generatingScimToken.value = false
  }
}

async function fetchIntegrations() {
  integrationsLoading.value = true
  try {
    const res = await api.get('/organization/integrations')
    integrations.value = {
      intune: { enabled: false, tenantId: '', clientId: '', clientSecret: '', syncInterval: 60, ...res.data?.intune },
      autopilot: { enabled: false, tenantId: '', clientId: '', clientSecret: '', syncInterval: 60, ...res.data?.autopilot },
      jamf: { enabled: false, serverUrl: '', username: '', password: '', syncInterval: 60, ...res.data?.jamf },
      kandji: { enabled: false, subdomain: '', apiToken: '', syncInterval: 60, ...res.data?.kandji },
      personio: { enabled: false, clientId: '', clientSecret: '', syncInterval: 60, ...res.data?.personio },
      scim: { enabled: false, bearerToken: '', provisionUsers: true, deprovisionUsers: false, autoCreateDepartments: true, ...res.data?.scim },
      sso: { enabled: false, provider: 'saml', entityId: '', ssoUrl: '', certificate: '', forceSso: false, allowedDomains: [], ...res.data?.sso },
      bamboohr: { enabled: false, subdomain: '', apiKey: '', syncInterval: 60, ...res.data?.bamboohr },
      googleWorkspace: { enabled: false, domain: '', serviceAccountKey: '', adminEmail: '', syncInterval: 60, ...res.data?.googleWorkspace },
      hibob: { enabled: false, serviceUserId: '', apiToken: '', syncInterval: 60, ...res.data?.hibob },
      mosyle: { enabled: false, apiToken: '', syncInterval: 60, ...res.data?.mosyle },
      helpdesk: { enabled: false, provider: '', subdomain: '', email: '', apiToken: '', ...res.data?.helpdesk }
    }
    loadScimToken()
  } catch { integrations.value = null }
  finally { integrationsLoading.value = false }
}

async function saveIntegration(provider: keyof IntegrationConfigs) {
  if (!integrations.value) return
  savingIntegration.value = provider
  try {
    await api.patch('/organization/integrations', { provider, config: integrations.value[provider] })
    successMsg.value = t('settings.saved')
    setTimeout(() => successMsg.value = null, 3000)
    integrationDialog.value = false
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to save integration' }
  finally { savingIntegration.value = null }
}

function addSsoDomain() {
  if (!ssoDomainsInput.value.trim() || !integrations.value) return
  integrations.value.sso.allowedDomains.push(ssoDomainsInput.value.trim())
  ssoDomainsInput.value = ''
}

function removeSsoDomain(domain: string) {
  if (!integrations.value) return
  integrations.value.sso.allowedDomains = integrations.value.sso.allowedDomains.filter(d => d !== domain)
}

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select']
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

async function fetchOrg() {
  loading.value = true
  try {
    const response = await api.get('/org-settings')
    org.value = response.data
    generalForm.value = {
      name: response.data.name || '',
      defaultCurrency: response.data.settings?.defaultCurrency || 'EUR',
      depreciationYears: response.data.settings?.depreciationYears || 5,
      lowStockThreshold: response.data.settings?.lowStockThreshold || 3
    }

    const sa = response.data.settings?.smartAutomations || {}
    smartAutomationsForm.value = {
      returnReminders: { enabled: sa.returnReminders?.enabled ?? false, daysBefore: sa.returnReminders?.daysBefore ?? 14 },
      onboardingEmails: { enabled: sa.onboardingEmails?.enabled ?? false },
      offboardingCleanup: { enabled: sa.offboardingCleanup?.enabled ?? false },
      assetAudits: { enabled: sa.assetAudits?.enabled ?? false, frequencyMonths: sa.assetAudits?.frequencyMonths ?? 6 },
      autoProvisioning: { enabled: sa.autoProvisioning?.enabled ?? false, rules: sa.autoProvisioning?.rules ?? [] }
    }
  } catch (err) { error.value = 'Failed to load organization settings'; console.error(err) }
  finally { loading.value = false }
}

async function saveGeneralSettings() {
  saving.value = true; error.value = null
  try {
    await api.patch('/org-settings', { name: generalForm.value.name, settings: { defaultCurrency: generalForm.value.defaultCurrency, depreciationYears: generalForm.value.depreciationYears, lowStockThreshold: generalForm.value.lowStockThreshold } })
    successMsg.value = t('settings.saved'); setTimeout(() => successMsg.value = null, 3000); await fetchOrg()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to save settings' }
  finally { saving.value = false }
}

async function saveSmartAutomations() {
  saving.value = true; error.value = null
  try {
    await api.patch('/org-settings', {
      settings: {
        smartAutomations: smartAutomationsForm.value
      }
    })
    successMsg.value = t('settings.saved')
    setTimeout(() => successMsg.value = null, 3000)
    await fetchOrg()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to save smart automations'
  } finally {
    saving.value = false
  }
}

async function addCustomField() {
  try {
    const payload: Record<string, unknown> = { name: newField.value.name, fieldType: newField.value.fieldType, required: newField.value.required }
    if (newField.value.fieldType === 'select' && newField.value.options) { payload.options = newField.value.options.split(',').map(o => o.trim()).filter(Boolean) }
    await api.post('/org-settings/custom-fields', payload)
    newFieldDialog.value = false; newField.value = { name: '', fieldType: 'text', required: false, options: '' }; await fetchOrg()
  } catch (err: any) { error.value = err.response?.data?.error || 'Failed to add custom field' }
}

async function removeCustomField(name: string) {
  try { await api.delete(`/org-settings/custom-fields/${encodeURIComponent(name)}`); await fetchOrg() }
  catch (err: any) { error.value = err.response?.data?.error || 'Failed to remove field' }
}

async function addCustomStatus() {
  if (!newStatusInput.value.trim()) return
  try { await api.post('/org-settings/custom-statuses', { status: newStatusInput.value.trim() }); newStatusInput.value = ''; await fetchOrg() }
  catch (err: any) { error.value = err.response?.data?.error || 'Failed to add status' }
}

async function removeCustomStatus(status: string) {
  try { await api.delete(`/org-settings/custom-statuses/${status}`); await fetchOrg() }
  catch (err: any) { error.value = err.response?.data?.error || 'Failed to remove status' }
}

async function fetchLowStock() {
  try { const response = await api.get('/org-settings/low-stock'); lowStockData.value = response.data }
  catch (err) { console.error('Failed to fetch low stock data:', err) }
}

function fmtDate(val: string | undefined) { if (!val) return '—'; return new Date(val).toLocaleString() }

const { resetTour } = useOnboardingTour()

async function resetTourHandler() {
  await resetTour()
}

const extensionInstalled = ref(false)

function detectExtension() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'assetnode-extension') return

    if (event.data.type === 'EXTENSION_READY') {
      extensionInstalled.value = true
      shareAuthWithExtension()
    }
  })

  window.postMessage({
    source: 'assetnode-app',
    type: 'PING',
  }, '*')

  setTimeout(() => {
    const marker = document.getElementById('assetnode-extension-marker')
    const meta = document.querySelector('meta[name="assetnode-extension"]')
    if (marker || meta) {
      extensionInstalled.value = true
      shareAuthWithExtension()
    }
  }, 800)
}

function shareAuthWithExtension() {
  const token = localStorage.getItem('hw_access_token')
  if (token) {
    window.postMessage({
      source: 'assetnode-app',
      type: 'SHARE_AUTH',
      token,
    }, '*')
  }
}

function getPortalSlug(integrationKey: string): string {
  const slugMap: Record<string, string> = {
    intune: 'intune',
    autopilot: 'intune',
    jamf: 'jamf-pro',
    kandji: 'kandji',
    personio: 'personio',
    bamboohr: 'bamboohr',
    googleWorkspace: 'google-workspace',
    hibob: 'hibob',
    mosyle: 'mosyle',
    sso: 'sso-azure-ad',
    scim: 'scim-azure-ad',
  }
  return slugMap[integrationKey] || integrationKey
}

function launchGuidedSetup(integrationKey: string) {
  const slug = getPortalSlug(integrationKey)
  window.postMessage({
    source: 'assetnode-app',
    type: 'START_GUIDE',
    slug,
  }, '*')
  const portalUrls: Record<string, string> = {
    intune: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    'jamf-pro': '',
    kandji: 'https://admin.kandji.io',
    personio: '',
    bamboohr: '',
    'google-workspace': 'https://console.cloud.google.com',
    hibob: 'https://app.hibob.com',
    mosyle: 'https://manager.mosyle.com',
  }
  const url = portalUrls[slug]
  if (url) {
    setTimeout(() => window.open(url, '_blank'), 300)
  }
}

function launchAutopilot(integrationKey: string) {
  const slug = getPortalSlug(integrationKey)
  window.postMessage({
    source: 'assetnode-app',
    type: 'START_GUIDE',
    slug,
    autopilot: true,
  }, '*')
  const portalUrls: Record<string, string> = {
    intune: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    'jamf-pro': '',
    kandji: 'https://admin.kandji.io',
    personio: '',
    bamboohr: '',
    'google-workspace': 'https://console.cloud.google.com',
    hibob: 'https://app.hibob.com',
    mosyle: 'https://manager.mosyle.com',
  }
  const url = portalUrls[slug]
  if (url) {
    setTimeout(() => window.open(url, '_blank'), 300)
  }
}

const route = useRoute()
onMounted(() => {
  fetchOrg(); fetchLowStock(); fetchNotifPrefs(); fetchApiKeys(); fetchWebhooks(); fetchIntegrations(); loadInvites(); fetchCategories()
  detectExtension()
  const section = route.query.section as string | undefined
  if (section) {
    const validKeys = sections.value.map(s => s.key)
    if (validKeys.includes(section)) {
      activeSection.value = section
    }
  }
  const guide = route.query.guide as string | undefined
  if (guide) {
    const mappedKey = Object.keys(GUIDES).find(k => GUIDES[k].imageDir === guide) || guide
    if (GUIDES[mappedKey]) {
      openIntegrationConfig(mappedKey)
    }
  }
})
</script>

<template>
  <div class="view-page">
    <div class="view-inner" style="padding:0;">
      <div class="settings-layout">
        <div class="settings-sidebar">
          <div class="sidebar-sticky">
            <div class="sidebar-title">{{ $t('settings.title') }}</div>
            <div class="sidebar-nav">
              <div
                v-for="section in sections"
                :key="section.key"
                class="sidebar-item"
                :class="{ active: activeSection === section.key }"
                :data-tour="`settings-${section.key}`"
                @click="activeSection = section.key"
              >
                <i :class="section.icon"></i>
                <span>{{ section.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-content" data-tour="settings-content">
          <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
          <Message v-if="successMsg" severity="success" closable @close="successMsg = null" class="mb-4">{{ successMsg }}</Message>

          <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

          <template v-if="activeSection === 'general' && !loading">
            <h2 class="text-xl font-bold mb-4">{{ $t('settings.general') }}</h2>
            <div class="an-card" style="padding:24px;">
              <div class="form-grid">
                <div><label>{{ $t('settings.orgName') }}</label><InputText v-model="generalForm.name" class="w-full mt-2" /></div>
                <div><label>{{ $t('settings.currency') }}</label><Select v-model="generalForm.defaultCurrency" :options="CURRENCIES.map(c => ({label:c,value:c}))" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
                <div><label>{{ $t('settings.depreciationYears') }}</label><InputNumber v-model="generalForm.depreciationYears" :min="1" class="w-full mt-2" /></div>
                <div><label>{{ $t('settings.lowStockThreshold') }}</label><InputNumber v-model="generalForm.lowStockThreshold" :min="0" class="w-full mt-2" /></div>
              </div>
              <Button severity="primary" :loading="saving" :label="$t('common.save')" @click="saveGeneralSettings" class="mt-4" />
            </div>

            <div class="an-card mt-4" style="padding:24px;">
              <div class="flex justify-content-between align-items-center">
                <div>
                  <div class="font-bold mb-1">Product Tour</div>
                  <div style="font-size:13px;color:var(--an-text-muted);">Restart the guided product walkthrough to learn about all features.</div>
                </div>
                <Button
                  icon="pi pi-play"
                  label="Restart Tour"
                  severity="secondary"
                  outlined
                  @click="resetTourHandler()"
                />
              </div>
            </div>
          </template>

          <template v-if="activeSection === 'smartAutomations' && !loading">
            <h2 class="text-xl font-bold mb-4">Smart Automations</h2>

            <div class="an-card mb-4">
              <div class="p-4 border-bottom-1 surface-border">
                <div class="flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 class="font-bold text-lg mb-1">Return Reminders</h3>
                    <p class="text-color-secondary m-0" style="font-size: 0.9rem;">Automatically send email reminders to employees before their hardware assignment is due for return.</p>
                  </div>
                  <ToggleSwitch v-model="smartAutomationsForm.returnReminders.enabled" />
                </div>
                <div v-if="smartAutomationsForm.returnReminders.enabled" class="mt-3 pt-3 border-top-1 surface-border">
                  <label class="block mb-2 font-medium">Days Before Return Date</label>
                  <div class="flex align-items-center gap-2">
                    <InputNumber v-model="smartAutomationsForm.returnReminders.daysBefore" :min="1" :max="90" inputId="daysBefore" class="w-5rem" />
                    <span class="text-color-secondary">days</span>
                  </div>
                </div>
              </div>

              <div class="p-4 border-bottom-1 surface-border">
                <div class="flex justify-content-between align-items-start">
                  <div>
                    <h3 class="font-bold text-lg mb-1">Onboarding Emails</h3>
                    <p class="text-color-secondary m-0" style="font-size: 0.9rem;">Automatically send a welcome email and hardware assignment overview to newly onboarded employees.</p>
                  </div>
                  <ToggleSwitch v-model="smartAutomationsForm.onboardingEmails.enabled" />
                </div>
              </div>

              <div class="p-4 border-bottom-1 surface-border">
                <div class="flex justify-content-between align-items-start">
                  <div>
                    <h3 class="font-bold text-lg mb-1">Offboarding Cleanup</h3>
                    <p class="text-color-secondary m-0" style="font-size: 0.9rem;">Automatically initiate return workflows and reassign software licenses when an employee is offboarded.</p>
                  </div>
                  <ToggleSwitch v-model="smartAutomationsForm.offboardingCleanup.enabled" />
                </div>
              </div>

              <div class="p-4 border-bottom-1 surface-border">
                <div class="flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 class="font-bold text-lg mb-1">Periodic Asset Audits</h3>
                    <p class="text-color-secondary m-0" style="font-size: 0.9rem;">Periodically email employees a Magic Link to confirm they still possess their assigned hardware.</p>
                  </div>
                  <ToggleSwitch v-model="smartAutomationsForm.assetAudits.enabled" />
                </div>
                <div v-if="smartAutomationsForm.assetAudits.enabled" class="mt-3 pt-3 border-top-1 surface-border">
                  <label class="block mb-2 font-medium">Audit Frequency</label>
                  <div class="flex align-items-center gap-2">
                    <span class="text-color-secondary">Every</span>
                    <InputNumber v-model="smartAutomationsForm.assetAudits.frequencyMonths" :min="1" :max="60" inputId="frequencyMonths" class="w-5rem" />
                    <span class="text-color-secondary">months</span>
                  </div>
                </div>
              </div>

              <div class="p-4">
                <div class="flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 class="font-bold text-lg mb-1">Role-Based Auto-Provisioning</h3>
                    <p class="text-color-secondary m-0" style="font-size: 0.9rem;">Automatically reserve and assign available hardware to new employees based on their job title.</p>
                  </div>
                  <ToggleSwitch v-model="smartAutomationsForm.autoProvisioning.enabled" />
                </div>
                <div v-if="smartAutomationsForm.autoProvisioning.enabled" class="mt-3 pt-3 border-top-1 surface-border">
                  <div class="flex justify-content-between align-items-center mb-3">
                    <label class="font-medium m-0">Provisioning Rules</label>
                    <Button severity="secondary" size="small" icon="pi pi-plus" label="Add Rule" @click="addProvisioningRule" />
                  </div>

                  <div v-if="smartAutomationsForm.autoProvisioning.rules.length === 0" class="text-center p-3 surface-100 border-round text-color-secondary mb-3">
                    No rules defined. Click 'Add Rule' to create one.
                  </div>

                  <div v-for="(rule, index) in smartAutomationsForm.autoProvisioning.rules" :key="index" class="flex gap-3 align-items-end mb-3 p-3 surface-50 border-round border-1 surface-border">
                    <div class="flex-grow-1">
                      <label class="block mb-1 text-sm">Job Title (Regex Pattern)</label>
                      <InputText v-model="rule.jobTitlePattern" placeholder="e.g. Engineer|Developer" class="w-full" />
                    </div>
                    <div class="flex-grow-1">
                      <label class="block mb-1 text-sm">Hardware Categories</label>
                      <MultiSelect v-model="rule.categories" :options="hardwareCategories" optionLabel="name" optionValue="_id" placeholder="Select categories" class="w-full" :maxSelectedLabels="3" />
                    </div>
                    <Button icon="pi pi-trash" severity="danger" text @click="removeProvisioningRule(index)" />
                  </div>
                </div>
              </div>
            </div>

            <Button severity="primary" :loading="saving" :label="$t('common.save')" @click="saveSmartAutomations" />
          </template>

          <template v-if="activeSection === 'customFields' && !loading">
            <div class="flex justify-content-between align-items-center mb-4">
              <h2 class="text-xl font-bold">{{ $t('settings.customFields') }}</h2>
              <Button severity="primary" size="small" icon="pi pi-plus" :label="$t('settings.addField')" @click="newFieldDialog = true" />
            </div>
            <div class="an-card">
              <table class="an-table">
                <thead><tr><th>{{ $t('settings.fieldName') }}</th><th>{{ $t('settings.fieldType') }}</th><th>{{ $t('settings.required') }}</th><th class="text-right">{{ $t('common.actions') }}</th></tr></thead>
                <tbody>
                  <tr v-for="field in org?.settings?.customFields || []" :key="field.name">
                    <td class="font-bold">{{ field.name }}</td>
                    <td><Tag :value="field.fieldType" /></td>
                    <td><i :class="field.required ? 'pi pi-check' : 'pi pi-times'" :style="{color: field.required ? 'var(--p-green-500)' : 'var(--an-text-muted)'}"></i></td>
                    <td class="text-right"><Button icon="pi pi-trash" size="small" text severity="danger" @click="removeCustomField(field.name)" /></td>
                  </tr>
                  <tr v-if="!org?.settings?.customFields?.length"><td colspan="4" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('settings.noCustomFields') }}</td></tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeSection === 'customStatuses' && !loading">
            <h2 class="text-xl font-bold mb-4">{{ $t('settings.customStatuses') }}</h2>
            <div class="an-card" style="padding:24px;">
              <div class="flex flex-wrap gap-2 mb-4">
                <Tag v-for="status in org?.settings?.customStatuses || []" :key="status" :value="status" severity="primary" removable @remove="removeCustomStatus(status)" />
                <span v-if="!org?.settings?.customStatuses?.length" style="color:var(--an-text-muted);">{{ $t('settings.noCustomStatuses') }}</span>
              </div>
              <div class="flex gap-2 align-items-end">
                <div class="flex-grow-1"><label>{{ $t('settings.newStatus') }}</label><InputText v-model="newStatusInput" class="w-full mt-2" @keyup.enter="addCustomStatus" /></div>
                <Button severity="primary" :label="$t('common.add')" @click="addCustomStatus" />
              </div>
            </div>
          </template>

          <template v-if="activeSection === 'lowStock' && !loading">
            <h2 class="text-xl font-bold mb-4">{{ $t('settings.lowStockAlerts') }}</h2>
            <div v-if="lowStockData" class="an-card" style="padding:24px;">
              <div class="flex gap-4 mb-4">
                <div class="kpi-card"><div class="kpi-value">{{ lowStockData.threshold }}</div><div class="kpi-label">{{ $t('settings.threshold') }}</div></div>
                <div class="kpi-card"><div class="kpi-value" style="color:var(--p-red-500);">{{ lowStockData.totalAlerts }}</div><div class="kpi-label">{{ $t('settings.alerts') }}</div></div>
              </div>
              <h3 class="font-bold mb-2">{{ $t('settings.lowStockHardware') }}</h3>
              <div v-if="lowStockData.hardware.length" class="mb-4">
                <div v-for="item in lowStockData.hardware" :key="item._id" class="list-item"><span>{{ item.name }}</span><Tag :value="`${item.quantity} left`" severity="danger" /></div>
              </div>
              <div v-else style="color:var(--an-text-muted);" class="mb-4">{{ $t('settings.noLowStock') }}</div>
              <h3 class="font-bold mb-2">{{ $t('settings.lowStockPeripherals') }}</h3>
              <div v-if="lowStockData.peripherals.length">
                <div v-for="item in lowStockData.peripherals" :key="item._id" class="list-item"><span>{{ item.name }}</span><Tag :value="`${item.quantity} left`" severity="danger" /></div>
              </div>
              <div v-else style="color:var(--an-text-muted);">{{ $t('settings.noLowStock') }}</div>
            </div>
          </template>

          <template v-if="activeSection === 'users'">
            <div class="flex justify-content-between align-items-center mb-4">
              <h2 class="text-xl font-bold">{{ $t('settings.users') }}</h2>
              <Button severity="primary" size="small" icon="pi pi-user-plus" :label="$t('settings.inviteUser')" @click="inviteDialog = true" />
            </div>

            <h3 class="font-bold mb-3">{{ $t('settings.pendingInvites') }}</h3>
            <div v-if="invitesLoading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
            <div v-else class="an-card">
              <table class="an-table">
                <thead><tr>
                  <th>{{ $t('settings.inviteEmail') }}</th>
                  <th>{{ $t('settings.inviteRole') }}</th>
                  <th>{{ $t('settings.invitedByCol') }}</th>
                  <th>{{ $t('settings.expiresAt') }}</th>
                  <th class="text-right">{{ $t('common.actions') }}</th>
                </tr></thead>
                <tbody>
                  <tr v-for="inv in invites" :key="inv.id">
                    <td class="font-bold">{{ inv.email }}</td>
                    <td><Tag :value="inv.role" size="small" /></td>
                    <td>{{ inv.invitedBy ? `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}` : '—' }}</td>
                    <td>{{ fmtDate(inv.expiresAt) }}</td>
                    <td class="text-right"><Button icon="pi pi-times" size="small" text severity="danger" :label="$t('settings.revokeInvite')" @click="revokeInvite(inv.id)" /></td>
                  </tr>
                  <tr v-if="invites.length === 0"><td colspan="5" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('settings.noPendingInvites') }}</td></tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeSection === 'notifications'">
            <h2 class="text-xl font-bold mb-4">{{ $t('settings.notifications') }}</h2>
            <div v-if="notifLoading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
            <template v-else-if="notifPrefs">
              <div class="an-card mb-4" style="padding:24px;">
                <h3 class="font-bold mb-3">{{ $t('settings.channels') }}</h3>
                <div v-for="ch in (['email','slack','teams'] as const)" :key="ch" class="channel-item">
                  <div class="flex align-items-center gap-3 mb-2">
                    <ToggleSwitch v-model="notifPrefs.channels[ch].enabled" />
                    <span class="font-bold" style="text-transform:capitalize;">{{ ch }}</span>
                  </div>
                  <div v-if="notifPrefs.channels[ch].enabled" class="flex gap-2 align-items-end ml-5">
                    <InputText v-if="ch === 'email'" v-model="notifPrefs.channels[ch].address" placeholder="email@company.com" class="flex-grow-1" />
                    <InputText v-else v-model="notifPrefs.channels[ch].webhookUrl" placeholder="Webhook URL" class="flex-grow-1" />
                    <Button size="small" severity="info" outlined :loading="testingChannel === ch" :label="$t('settings.test')" @click="testChannel(ch)" />
                  </div>
                </div>
              </div>
              <div class="an-card mb-4" style="padding:24px;">
                <h3 class="font-bold mb-3">{{ $t('settings.eventNotifications') }}</h3>
                <table class="an-table">
                  <thead><tr><th>{{ $t('settings.event') }}</th><th class="text-center">Email</th><th class="text-center">Slack</th><th class="text-center">Teams</th></tr></thead>
                  <tbody>
                    <tr v-for="evt in EVENT_TYPES" :key="evt.key">
                      <td>{{ evt.label }}</td>
                      <td class="text-center"><Checkbox v-model="notifPrefs.events[evt.key].email" :binary="true" /></td>
                      <td class="text-center"><Checkbox v-model="notifPrefs.events[evt.key].slack" :binary="true" /></td>
                      <td class="text-center"><Checkbox v-model="notifPrefs.events[evt.key].teams" :binary="true" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="an-card mb-4" style="padding:24px;">
                <h3 class="font-bold mb-3">{{ $t('settings.reminderIntervals') }}</h3>
                <div class="form-grid">
                  <div><label>{{ $t('settings.firstReminder') }}</label><InputNumber v-model="notifPrefs.intervals.first" :min="1" class="w-full mt-2" /></div>
                  <div><label>{{ $t('settings.secondReminder') }}</label><InputNumber v-model="notifPrefs.intervals.second" :min="1" class="w-full mt-2" /></div>
                  <div><label>{{ $t('settings.thirdReminder') }}</label><InputNumber v-model="notifPrefs.intervals.third" :min="1" class="w-full mt-2" /></div>
                  <div><label>{{ $t('settings.fourthReminder') }}</label><InputNumber v-model="notifPrefs.intervals.fourth" :min="1" class="w-full mt-2" /></div>
                </div>
              </div>
              <Button severity="primary" :loading="saving" :label="$t('common.save')" @click="saveNotifPrefs" />
            </template>
          </template>

          <template v-if="activeSection === 'apiKeys'">
            <div class="flex justify-content-between align-items-center mb-4">
              <h2 class="text-xl font-bold">{{ $t('settings.apiKeys') }}</h2>
              <Button severity="primary" size="small" icon="pi pi-plus" :label="$t('settings.generateKey')" @click="newKeyDialog = true" />
            </div>
            <div class="an-card">
              <table class="an-table">
                <thead><tr><th>{{ $t('settings.keyName') }}</th><th>{{ $t('settings.keyPrefix') }}</th><th>{{ $t('settings.createdBy') }}</th><th>{{ $t('settings.lastUsed') }}</th><th class="text-right">{{ $t('common.actions') }}</th></tr></thead>
                <tbody>
                  <tr v-for="key in apiKeys" :key="key._id">
                    <td class="font-bold">{{ key.name }}</td>
                    <td><code>{{ key.keyPrefix }}***</code></td>
                    <td>{{ key.createdBy ? `${key.createdBy.firstName} ${key.createdBy.lastName}` : '—' }}</td>
                    <td>{{ fmtDate(key.lastUsedAt) }}</td>
                    <td class="text-right"><Button icon="pi pi-trash" size="small" text severity="danger" @click="revokeApiKey(key._id)" /></td>
                  </tr>
                  <tr v-if="apiKeys.length === 0"><td colspan="5" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('settings.noApiKeys') }}</td></tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeSection === 'webhooks'">
            <div class="flex justify-content-between align-items-center mb-4">
              <h2 class="text-xl font-bold">{{ $t('settings.webhookTitle') }}</h2>
              <Button severity="primary" size="small" icon="pi pi-plus" :label="$t('settings.addWebhook')" @click="newWebhookDialog = true" />
            </div>
            <div class="an-card">
              <table class="an-table">
                <thead><tr><th>URL</th><th>{{ $t('settings.events') }}</th><th>{{ $t('common.status') }}</th><th>{{ $t('settings.lastTriggered') }}</th><th class="text-right">{{ $t('common.actions') }}</th></tr></thead>
                <tbody>
                  <tr v-for="wh in webhooks" :key="wh._id">
                    <td class="font-bold" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wh.url }}</td>
                    <td><div class="flex flex-wrap gap-1"><Tag v-for="e in wh.events" :key="e" :value="e" size="small" /></div></td>
                    <td><Tag :value="wh.isActive ? 'Active' : 'Inactive'" :severity="wh.isActive ? 'success' : 'danger'" /></td>
                    <td>{{ fmtDate(wh.lastTriggeredAt) }}</td>
                    <td class="text-right">
                      <Button icon="pi pi-play" size="small" text severity="info" :loading="testingWebhook === wh._id" @click="testWebhook(wh._id)" />
                      <Button icon="pi pi-trash" size="small" text severity="danger" @click="deleteWebhook(wh._id)" />
                    </td>
                  </tr>
                  <tr v-if="webhooks.length === 0"><td colspan="5" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('settings.noWebhooks') }}</td></tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeSection === 'integrations'">
            <div class="flex justify-content-between align-items-center mb-4">
              <h2 class="text-xl font-bold">{{ $t('settings.integrations') }}</h2>
            </div>


            <div v-if="integrationsLoading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>
            <template v-else-if="integrations">
              <div class="integrations-grid" data-tour="integrations-grid">
                <div v-for="opt in integrationOptions" :key="opt.value" class="integration-card an-card p-4 flex flex-column cursor-pointer" @click="openIntegrationConfig(opt.value)">
                  <div class="flex justify-content-between align-items-start mb-3">
                    <div class="font-bold text-lg flex align-items-center gap-2">
                      <i :class="getIntegrationIcon(opt.value)" style="font-size: 1.4rem; color: var(--p-primary-color)"></i>
                      {{ opt.label }}
                    </div>
                    <Tag :severity="integrations[opt.value as keyof IntegrationConfigs]?.enabled ? 'success' : 'secondary'" :value="integrations[opt.value as keyof IntegrationConfigs]?.enabled ? 'Active' : 'Inactive'" />
                  </div>
                  <div class="text-color-secondary text-sm mb-4" style="line-height: 1.5; flex-grow: 1;">
                    {{ getIntegrationDescription(opt.value) }}
                  </div>
                  <div class="mt-auto flex justify-content-between align-items-center gap-2">





















                    <Button :label="integrations[opt.value as keyof IntegrationConfigs]?.enabled ? 'Configure' : 'Set Up'" :icon="integrations[opt.value as keyof IntegrationConfigs]?.enabled ? 'pi pi-cog' : 'pi pi-plus'" outlined size="small" />
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="newFieldDialog" :header="$t('settings.addField')" :style="{width:'500px'}" modal>
      <div class="flex flex-column gap-3">
        <div><label>{{ $t('settings.fieldName') }}</label><InputText v-model="newField.name" class="w-full mt-2" /></div>
        <div><label>{{ $t('settings.fieldType') }}</label><Select v-model="newField.fieldType" :options="FIELD_TYPES.map(f => ({label:f,value:f}))" optionLabel="label" optionValue="value" class="w-full mt-2" /></div>
        <div class="flex align-items-center gap-2"><Checkbox v-model="newField.required" :binary="true" inputId="fieldReq" /><label for="fieldReq">{{ $t('settings.required') }}</label></div>
        <div><label>{{ $t('settings.optionsCSV') }}</label><InputText v-model="newField.options" class="w-full mt-2" /><small style="color:var(--an-text-muted);">{{ $t('settings.optionsHint') }}</small></div>
      </div>
      <template #footer>
        <Button :label="$t('common.cancel')" text @click="newFieldDialog = false" />
        <Button severity="primary" :label="$t('common.save')" @click="addCustomField" />
      </template>
    </Dialog>

    <Dialog v-model:visible="newKeyDialog" :header="$t('settings.generateKey')" :style="{width:'500px'}" modal>
      <template v-if="!generatedKey">
        <div><label>{{ $t('settings.keyName') }}</label><InputText v-model="newKeyName" class="w-full mt-2" placeholder="e.g. CI/CD Pipeline" @keyup.enter="generateApiKey" /></div>
      </template>
      <template v-else>
        <Message severity="warn" class="mb-4">{{ $t('settings.copyKeyWarning') }}</Message>
        <div class="flex gap-2 align-items-center">
          <InputText :modelValue="generatedKey" readonly class="flex-grow-1" />
          <Button icon="pi pi-copy" text @click="copyToClipboard(generatedKey!)" />
        </div>
      </template>
      <template #footer>
        <Button v-if="!generatedKey" :label="$t('common.cancel')" text @click="closeKeyDialog" />
        <Button v-if="!generatedKey" severity="primary" :disabled="!newKeyName.trim()" :label="$t('settings.generateKey')" @click="generateApiKey" />
        <Button v-else severity="primary" :label="$t('common.done')" @click="closeKeyDialog" />
      </template>
    </Dialog>

    <Dialog v-model:visible="newWebhookDialog" :header="$t('settings.addWebhook')" :style="{width:'550px'}" modal>
      <div class="flex flex-column gap-3">
        <div><label>URL</label><InputText v-model="newWebhook.url" class="w-full mt-2" placeholder="https://example.com/webhook" /></div>
        <div><label>{{ $t('settings.events') }}</label><Select v-model="newWebhook.events" :options="WEBHOOK_EVENTS.map(e => ({label:e,value:e}))" optionLabel="label" optionValue="value" class="w-full mt-2" multiple /></div>
        <div><label>{{ $t('maintenance.description') }}</label><InputText v-model="newWebhook.description" class="w-full mt-2" /></div>
      </div>
      <template #footer>
        <Button :label="$t('common.cancel')" text @click="newWebhookDialog = false" />
        <Button severity="primary" :disabled="!newWebhook.url || !newWebhook.events.length" :label="$t('common.save')" @click="createWebhook" />
      </template>
    </Dialog>
    <Dialog v-model:visible="inviteDialog" :header="$t('settings.inviteUser')" :style="{width:'500px'}" modal>
      <Message v-if="inviteError" severity="error" :closable="true" class="mb-3">{{ inviteError }}</Message>

      <div class="mb-3">
        <label class="block mb-1 font-bold text-sm">{{ $t('common.email') }}</label>
        <InputText v-model="inviteForm.email" type="email" class="w-full" :placeholder="$t('settings.emailPlaceholder')" @keyup.enter="sendInvite" />
      </div>

      <div class="mb-4">
        <label class="block mb-1 font-bold text-sm">{{ $t('common.role') }}</label>
        <Select v-model="inviteForm.role" :options="[
          { label: $t('settings.roleAdmin'), value: 'admin' },
          { label: $t('settings.roleManager'), value: 'manager' },
          { label: $t('settings.roleEmployee'), value: 'employee' },
          { label: $t('settings.roleViewer'), value: 'viewer' }
        ]" optionLabel="label" optionValue="value" class="w-full" />
      </div>

      <template #footer>
        <Button severity="secondary" text :label="$t('common.cancel')" @click="inviteDialog = false" />
        <Button severity="primary" :loading="inviteSending" :label="$t('settings.sendInvite')" @click="sendInvite" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="integrationDialog"
      :header="integrationOptions.find(o => o.value === selectedIntegrationKey)?.label || 'Configure Integration'"
      :style="{width:'1100px', maxWidth: '95vw', height: '82vh'}"
      :contentStyle="{flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'}"
      modal
      maximizable
    >
      <div
        v-if="integrations"
        class="integration-dialog-layout"
        :class="{ 'is-dragging': isDraggingPane }"
      >
        <div class="integration-config-pane" :style="{ width: configPaneWidth + 'px' }">
          <div v-if="selectedIntegrationKey === 'intune'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.intuneDesc') || 'Sync devices from Microsoft Intune MDM.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.intune.enabled" /></div>
            </div>
            <div v-if="integrations.intune.enabled" class="form-grid">
              <div><label>{{ $t('settings.tenantId') }}</label><InputText v-model="integrations.intune.tenantId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.clientId') }}</label><InputText v-model="integrations.intune.clientId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.clientSecret') }}</label><InputText v-model="integrations.intune.clientSecret" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.intune.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.intune.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.intune.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'autopilot'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">Import Autopilot-registered devices and deployment profiles.</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.autopilot.enabled" /></div>
            </div>
            <div v-if="integrations.autopilot.enabled" class="form-grid">
              <div><label>{{ $t('settings.tenantId') }}</label><InputText v-model="integrations.autopilot.tenantId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.clientId') }}</label><InputText v-model="integrations.autopilot.clientId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.clientSecret') }}</label><InputText v-model="integrations.autopilot.clientSecret" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.autopilot.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.autopilot.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.autopilot.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'jamf'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.jamfDesc') || 'Sync Apple devices from Jamf Pro.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.jamf.enabled" /></div>
            </div>
            <div v-if="integrations.jamf.enabled" class="form-grid">
              <div class="col-span-full"><label>{{ $t('settings.serverUrl') }}</label><InputText v-model="integrations.jamf.serverUrl" class="w-full mt-2" placeholder="https://yourorg.jamfcloud.com" /></div>
              <div><label>{{ $t('settings.apiUsername') }}</label><InputText v-model="integrations.jamf.username" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.apiPassword') }}</label><InputText v-model="integrations.jamf.password" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.jamf.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.jamf.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.jamf.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'kandji'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.kandjiDesc') || 'Manage Apple devices with Kandji.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.kandji.enabled" /></div>
            </div>
            <div v-if="integrations.kandji.enabled" class="form-grid">
              <div><label>{{ $t('settings.subdomain') }}</label><InputText v-model="integrations.kandji.subdomain" class="w-full mt-2" placeholder="yourorg.clients.us-1.kandji.io" /></div>
              <div><label>{{ $t('settings.apiToken') }}</label><InputText v-model="integrations.kandji.apiToken" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.kandji.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.kandji.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.kandji.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'personio'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.personioDesc') || 'Sync employee directory from Personio.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.personio.enabled" /></div>
            </div>
            <div v-if="integrations.personio.enabled" class="form-grid">
              <div><label>{{ $t('settings.clientId') }}</label><InputText v-model="integrations.personio.clientId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.clientSecret') }}</label><InputText v-model="integrations.personio.clientSecret" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.personio.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.personio.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.personio.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'scim'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.scimDesc') || 'Automate user provisioning with SCIM 2.0.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.scim.enabled" /></div>
            </div>
            <div v-if="integrations.scim.enabled">
              <div class="surface-100 p-3 border-round mb-3">
                <div class="font-bold mb-2" style="font-size:13px;">{{ $t('settings.scimIdpSetup') || 'Configure your Identity Provider' }}</div>
                <div class="flex align-items-center gap-2 mb-2">
                  <label style="font-size:12px;color:var(--an-text-muted);min-width:120px;">SCIM Endpoint:</label>
                  <InputText :modelValue="scimEndpointUrl" readonly class="flex-grow-1" style="font-size:12px;font-family:monospace;" />
                  <Button icon="pi pi-copy" text size="small" @click="copyToClipboard(scimEndpointUrl)" />
                </div>
                <div class="flex align-items-center gap-2 mb-2">
                  <label style="font-size:12px;color:var(--an-text-muted);min-width:120px;">Bearer Token:</label>
                  <InputText :modelValue="revealedScimToken || 'No token generated'" readonly class="flex-grow-1" style="font-size:12px;font-family:monospace;" />
                  <Button v-if="revealedScimToken" icon="pi pi-copy" text size="small" @click="copyToClipboard(revealedScimToken)" />
                </div>
                <small style="color:var(--an-text-muted);line-height:1.6;">Paste these into your IdP's SCIM provisioning settings (Okta, Azure AD, OneLogin).</small>
              </div>

              <div class="mb-3">
                <Button
                  :label="revealedScimToken ? $t('settings.regenerateToken') : $t('settings.generateToken')"
                  :icon="revealedScimToken ? 'pi pi-refresh' : 'pi pi-key'"
                  size="small"
                  :severity="revealedScimToken ? 'warn' : 'primary'"
                  :loading="generatingScimToken"
                  @click="generateScimToken"
                />
              </div>
              <div class="flex flex-column gap-3 mb-3">
                <div class="flex align-items-center gap-2"><Checkbox v-model="integrations.scim.provisionUsers" :binary="true" inputId="provUsers" /><label for="provUsers">{{ $t('settings.provisionUsers') }}</label></div>
                <div class="flex align-items-center gap-2"><Checkbox v-model="integrations.scim.deprovisionUsers" :binary="true" inputId="deprovUsers" /><label for="deprovUsers">{{ $t('settings.deprovisionUsers') }}</label></div>
                <div class="flex align-items-center gap-2"><Checkbox v-model="integrations.scim.autoCreateDepartments" :binary="true" inputId="autoCreateDepts" /><label for="autoCreateDepts">Auto-create departments from provisioned users</label></div>
              </div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'sso'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.ssoDesc') || 'Configure Single Sign-On (SAML).' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.sso.enabled" /></div>
            </div>
            <div v-if="integrations.sso.enabled">
              <div class="surface-100 p-3 border-round mb-3">
                <div class="font-bold mb-2" style="font-size:13px;">{{ $t('settings.ssoIdpSetup') || 'SP Metadata URLs' }}</div>
                <div class="flex flex-column gap-2">
                  <div class="flex align-items-center gap-2">
                    <label style="font-size:12px;color:var(--an-text-muted);min-width:100px;">SP Metadata:</label>
                    <InputText :modelValue="ssoMetadataUrl" readonly class="flex-grow-1" style="font-size:12px;font-family:monospace;" />
                    <Button icon="pi pi-copy" text size="small" @click="copyToClipboard(ssoMetadataUrl)" />
                  </div>
                  <div class="flex align-items-center gap-2">
                    <label style="font-size:12px;color:var(--an-text-muted);min-width:100px;">ACS URL:</label>
                    <InputText :modelValue="ssoAcsUrl" readonly class="flex-grow-1" style="font-size:12px;font-family:monospace;" />
                    <Button icon="pi pi-copy" text size="small" @click="copyToClipboard(ssoAcsUrl)" />
                  </div>
                </div>
              </div>
              <div class="form-grid mb-3">
                <div><label>{{ $t('settings.ssoProvider') }}</label><InputText modelValue="SAML" readonly class="w-full mt-2" /></div>
                <div><label>{{ $t('settings.entityId') }}</label><InputText v-model="integrations.sso.entityId" class="w-full mt-2" /></div>
                <div class="col-span-full"><label>{{ $t('settings.ssoUrl') }}</label><InputText v-model="integrations.sso.ssoUrl" class="w-full mt-2" placeholder="https://idp.example.com/sso" /></div>
                <div class="col-span-full"><label>{{ $t('settings.certificate') }}</label><Textarea v-model="integrations.sso.certificate" class="w-full mt-2" rows="3" placeholder="-----BEGIN CERTIFICATE-----" /></div>
              </div>
              <div class="flex align-items-center gap-2 mb-3"><Checkbox v-model="integrations.sso.forceSso" :binary="true" inputId="forceSso" /><label for="forceSso">{{ $t('settings.forceSso') }}</label></div>
              <div class="font-bold mb-2">{{ $t('settings.allowedDomains') }}</div>
              <div class="flex flex-wrap gap-2 mb-3">
                <Tag v-for="domain in integrations.sso.allowedDomains" :key="domain" :value="domain" severity="primary" removable @remove="removeSsoDomain(domain)" />
              </div>
              <div class="flex gap-2 align-items-end mb-3">
                <InputText v-model="ssoDomainsInput" placeholder="acme.com" class="flex-grow-1" @keyup.enter="addSsoDomain" />
                <Button size="small" :label="$t('common.add')" @click="addSsoDomain" />
              </div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'bamboohr'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.bamboohrDesc') || 'Sync employee directory from BambooHR.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.bamboohr.enabled" /></div>
            </div>
            <div v-if="integrations.bamboohr.enabled" class="form-grid">
              <div><label>{{ $t('settings.subdomain') }}</label><InputText v-model="integrations.bamboohr.subdomain" class="w-full mt-2" placeholder="yourcompany" /></div>
              <div><label>{{ $t('settings.apiKey') }}</label><InputText v-model="integrations.bamboohr.apiKey" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.bamboohr.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.bamboohr.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.bamboohr.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'googleWorkspace'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.googleWorkspaceDesc') || 'Sync users & devices from Google.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.googleWorkspace.enabled" /></div>
            </div>
            <div v-if="integrations.googleWorkspace.enabled" class="form-grid">
              <div><label>{{ $t('settings.domain') }}</label><InputText v-model="integrations.googleWorkspace.domain" class="w-full mt-2" placeholder="yourcompany.com" /></div>
              <div><label>{{ $t('settings.adminEmail') }}</label><InputText v-model="integrations.googleWorkspace.adminEmail" class="w-full mt-2" placeholder="admin@yourcompany.com" /></div>
              <div class="col-span-full"><label>{{ $t('settings.serviceAccountKey') }}</label><Textarea v-model="integrations.googleWorkspace.serviceAccountKey" class="w-full mt-2" rows="4" placeholder="Paste service account JSON key" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.googleWorkspace.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.googleWorkspace.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.googleWorkspace.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'hibob'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.hibobDesc') || 'Sync employee directory from HiBob.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.hibob.enabled" /></div>
            </div>
            <div v-if="integrations.hibob.enabled" class="form-grid">
              <div><label>{{ $t('settings.serviceUserId') }}</label><InputText v-model="integrations.hibob.serviceUserId" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.apiToken') }}</label><InputText v-model="integrations.hibob.apiToken" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.hibob.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.hibob.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.hibob.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'mosyle'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">{{ $t('settings.mosyleDesc') || 'Sync Apple devices from Mosyle.' }}</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.mosyle.enabled" /></div>
            </div>
            <div v-if="integrations.mosyle.enabled" class="form-grid">
              <div><label>{{ $t('settings.apiToken') }}</label><InputText v-model="integrations.mosyle.apiToken" type="password" class="w-full mt-2" /></div>
              <div><label>{{ $t('settings.syncInterval') }}</label><InputNumber v-model="integrations.mosyle.syncInterval" :min="1" class="w-full mt-2" /></div>
              <div v-if="integrations.mosyle.lastSyncAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">{{ $t('settings.lastSync') }}: {{ fmtDate(integrations.mosyle.lastSyncAt) }}</div>
            </div>
          </div>

          <div v-if="selectedIntegrationKey === 'helpdesk'">
            <div class="flex justify-content-between align-items-center mb-4 pb-3 border-bottom-1 surface-border">
              <div><div style="font-size:13px;color:var(--an-text-muted);">Forward in-app technical support requests to your central ticket queue.</div></div>
              <div class="flex align-items-center gap-2 font-medium">Enable <ToggleSwitch v-model="integrations.helpdesk.enabled" /></div>
            </div>
            <div v-if="integrations.helpdesk.enabled" class="form-grid">
              <div class="col-span-full">
                <label>Provider</label>
                <Select
                  v-model="integrations.helpdesk.provider"
                  :options="[{label:'Zendesk',value:'zendesk'},{label:'Freshdesk',value:'freshdesk'}]"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full mt-2"
                  placeholder="Select provider"
                />
              </div>
              <div>
                <label>Tenant subdomain</label>
                <InputText v-model="integrations.helpdesk.subdomain" class="w-full mt-2" placeholder="your-company" />
                <small style="color:var(--an-text-muted);">Only the slug before .zendesk.com or .freshdesk.com</small>
              </div>
              <div v-if="integrations.helpdesk.provider === 'zendesk'">
                <label>Agent email</label>
                <InputText v-model="integrations.helpdesk.email" type="email" class="w-full mt-2" placeholder="support@example.com" />
              </div>
              <div class="col-span-full">
                <label>API token</label>
                <InputText v-model="integrations.helpdesk.apiToken" type="password" class="w-full mt-2" autocomplete="new-password" />
              </div>
              <Message v-if="integrations.helpdesk.lastFailureAt" severity="warn" :closable="false" class="col-span-full">
                Last delivery failed at {{ fmtDate(integrations.helpdesk.lastFailureAt) }}. The ticket was retained and sent to the fallback channel.
              </Message>
              <div v-else-if="integrations.helpdesk.lastDeliveryAt" class="col-span-full" style="font-size:12px;color:var(--an-text-muted);">
                Last successful delivery: {{ fmtDate(integrations.helpdesk.lastDeliveryAt) }}
              </div>
            </div>
          </div>
        </div>

        <div class="pane-resize-handle" @mousedown.prevent="startPaneResize"></div>

        <div class="integration-guide-pane">
          <template v-if="currentGuide">
            <div class="guide-pane-header">
              <div class="guide-avatar" :style="{background: `var(--p-${currentGuide.iconColor}-500, var(--p-primary-color))`}">
                <i :class="currentGuide.icon" style="font-size:20px;color:#fff;"></i>
              </div>
              <div class="flex-1 min-w-0">
                <Tag :value="guideCategory.label" :severity="guideCategory.severity" class="mb-1" />
                <div class="font-bold text-base">{{ currentGuide.title }}</div>
              </div>
            </div>
            <p style="color:var(--an-text-muted);font-size:13px;line-height:1.5;" class="mb-4">{{ currentGuide.intro }}</p>
            <Tag v-if="currentGuide.syncInfo" :value="currentGuide.syncInfo" severity="info" class="mb-4" />

            <div class="font-bold mb-3" style="font-size:13px;">Setup Guide ({{ currentGuide.steps.length }} steps)</div>
            <div v-for="(step, i) in currentGuide.steps" :key="i" class="guide-step">
              <div class="flex gap-3 align-items-start">
                <div class="guide-step-number">{{ i + 1 }}</div>
                <div class="flex-1">
                  <div class="font-bold mb-1" style="font-size:13px;">{{ step.title }}</div>
                  <div style="color:var(--an-text-muted);font-size:12px;line-height:1.5;">{{ step.description }}</div>
                  <Message v-if="step.note" severity="info" class="mt-2" style="font-size:12px;">{{ step.note }}</Message>
                  <div v-if="step.images && step.images.length" class="flex gap-2 flex-wrap mt-2">
                    <img
                      v-for="(img, j) in step.images" :key="j"
                      :src="guideImageUrl(img)" :alt="`Step ${i+1}`"
                      class="guide-step-img"
                      loading="lazy"
                      @click="openGuideLightbox(guideImageUrl(img))"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="guide-after-steps">
              <div class="font-bold mb-2" style="font-size:13px;"><i class="pi pi-check-circle mr-2"></i>After Setup</div>
              <ul style="padding-left:16px;margin:0;">
                <li v-for="(note, i) in currentGuide.afterSteps" :key="i" style="color:var(--an-text-muted);font-size:12px;margin-bottom:4px;">{{ note }}</li>
              </ul>
            </div>
          </template>
          <div v-else style="color:var(--an-text-muted);font-size:13px;padding:24px;text-align:center;">No guide available for this integration.</div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-between w-full gap-2">



















          <div class="flex gap-2">
            <Button :label="$t('common.cancel')" text @click="integrationDialog = false" />
            <Button severity="primary" :loading="savingIntegration === selectedIntegrationKey" :label="$t('common.save')" @click="saveIntegration(selectedIntegrationKey as keyof IntegrationConfigs)" />
          </div>
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="guideLightboxOpen" :style="{width:'1100px'}" modal :showHeader="false">
      <div style="position:relative;">
        <Button icon="pi pi-times" text size="small" style="position:absolute;top:8px;right:8px;z-index:1;" @click="closeGuideLightbox" />
        <img :src="expandedGuideImage" style="width:100%;display:block;border-radius:8px;" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.view-page { padding: 0; display: flex; flex-direction: column; min-height: 100dvh; }
.view-inner { flex: 1; display: flex; flex-direction: column; width: 100%; padding: 0; }
.settings-layout { display: grid; grid-template-columns: 260px 1fr; flex: 1; }
.settings-sidebar {
  background: var(--an-surface-dark);
  border-right: 1px solid var(--an-border-dark);
}
.sidebar-sticky {
  position: sticky;
  top: 0;
  padding: 24px 0;
}
.sidebar-title { padding: 0 20px 20px; font-size: 18px; font-weight: 700; }
.sidebar-nav { padding: 0 12px; }
.sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--an-text-primary); transition: background 0.15s, color 0.15s; }
.sidebar-item:hover { background: rgba(255,255,255,0.05); }
.sidebar-item.active { background: var(--p-primary-color); color: #fff; font-weight: 500; }
.settings-content { padding: 32px; }


.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.col-span-full { grid-column: 1 / -1; }
.kpi-card { background: var(--an-surface-dark); border-radius: 8px; padding: 16px 24px; text-align: center; }
.kpi-value { font-size: 28px; }
.kpi-label { font-size: 12px; color: var(--an-text-muted); margin-top: 4px; }
.list-item { padding: 8px 0; }
.list-item:last-child { border-bottom: none; }
.channel-item { padding: 12px 0; border-bottom: 1px solid var(--an-border-dark); }
.channel-item:last-child { border-bottom: none; }

@media (max-width: 768px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-sidebar { border-right: none; border-bottom: 1px solid var(--an-border-dark); }
  .sidebar-sticky { position: static; }
}

.integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.integration-card {
  transition: all 0.2s ease;
}
.integration-card:hover {
  transform: translateY(-2px);
  border-color: var(--p-primary-color);
}

.extension-banner {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px;
  padding: 16px 20px;
}
.extension-banner-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.extension-hint {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: 10px;
  padding: 12px 16px;
}

.integration-dialog-layout {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
}
.integration-dialog-layout.is-dragging {
  user-select: none;
  cursor: col-resize;
}

.integration-config-pane {
  flex-shrink: 0;
  padding: 16px 16px 16px 16px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

.pane-resize-handle {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--an-border-dark, rgba(255,255,255,0.12));
  transition: background 0.15s;
  position: relative;
}
.pane-resize-handle::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  left: -5px; right: -5px;
}
.pane-resize-handle:hover,
.is-dragging .pane-resize-handle {
  background: var(--p-primary-color);
}

.integration-guide-pane {
  flex: 1;
  min-width: 0;
  padding: 16px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--an-surface-dark);
}

.guide-pane-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--an-border-dark);
}

.guide-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guide-step {
  background: var(--an-surface-card, rgba(255,255,255,0.04));
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid var(--an-border-dark);
}

.guide-step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.guide-step-img {
  width: 100%;
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid var(--an-border-dark);
  cursor: zoom-in;
  transition: all 0.15s ease;
  display: block;
}
.guide-step-img:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(25,118,210,0.2);
}

.guide-after-steps {
  margin-top: 16px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--an-border-dark);
  background: var(--an-surface-card, rgba(255,255,255,0.04));
}

@media (max-width: 900px) {
  .integration-dialog-layout { flex-direction: column; height: auto; }
  .integration-config-pane { flex-shrink: 1; height: auto; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--an-border-dark); width: 100% !important; }
  .pane-resize-handle { display: none; }
  .integration-guide-pane { height: auto; max-height: 50vh; }
}
</style>
