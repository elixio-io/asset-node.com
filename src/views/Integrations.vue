<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { useAuthStore } from '../stores/auth'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import { onMounted, computed } from 'vue'

const router = useRouter()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

function handleCardClick(integrationName: string) {
  const guideMap: Record<string, string> = {
    'Microsoft Intune': 'intune',
    'Kandji': 'kandji',
    'Windows Autopilot': 'autopilot',
    'Jamf Pro': 'jamf-pro',
    'Jamf School': 'jamf-school',
    'Personio': 'personio',
    'BambooHR': 'bamboohr',
    'Google Workspace': 'google-workspace-directory',
    'HiBob': 'hibob',
    'Mosyle': 'mosyle',
    'SAML / SSO': 'sso-azure-ad',
    'SCIM': 'scim-azure-ad',
  }
  const guideSlug = guideMap[integrationName]
  if (guideSlug) {
    router.push(`/guides/${guideSlug}`)
  } else if (integrationName === 'REST API') {
    router.push('/api-docs')
  } else if (isAuthenticated.value) {
    router.push({
      path: '/settings',
      query: {
        section: 'integrations',
        ...(integrationName === 'Zendesk / Freshdesk' ? { guide: 'helpdesk' } : {})
      }
    })
  } else {
    router.push('/sign-up')
  }
}

onMounted(() => {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://asset-node.com/' },
      { '@type': 'ListItem', position: 2, name: 'Integrations' }
    ]
  }

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AssetNode Integrations',
    description: 'Connect AssetNode to the tools your team already uses.',
    numberOfItems: 14,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Microsoft Intune' },
      { '@type': 'ListItem', position: 2, name: 'Kandji' },
      { '@type': 'ListItem', position: 3, name: 'Windows Autopilot' },
      { '@type': 'ListItem', position: 4, name: 'Jamf Pro' },
      { '@type': 'ListItem', position: 5, name: 'SAML / SSO' },
      { '@type': 'ListItem', position: 6, name: 'SCIM 2.0' },
      { '@type': 'ListItem', position: 7, name: 'Webhooks' },
      { '@type': 'ListItem', position: 8, name: 'REST API' },
      { '@type': 'ListItem', position: 9, name: 'Personio' },
      { '@type': 'ListItem', position: 10, name: 'BambooHR' },
      { '@type': 'ListItem', position: 11, name: 'Google Workspace' },
      { '@type': 'ListItem', position: 12, name: 'HiBob' },
      { '@type': 'ListItem', position: 13, name: 'Mosyle' },
      { '@type': 'ListItem', position: 14, name: 'Zendesk / Freshdesk' }
    ]
  }

  const schemas = [
    { id: 'breadcrumb-jsonld', data: breadcrumb },
    { id: 'itemlist-jsonld', data: itemList }
  ]
  for (const { id, data } of schemas) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    script.id = id
    document.head.appendChild(script)
  }
})

const integrations = [
  { name: 'Microsoft Intune', category: 'MDM', icon: 'pi pi-microsoft', desc: 'Sync managed devices and compliance policies directly from Intune.' },
  { name: 'Kandji', category: 'MDM', icon: 'pi pi-apple', desc: 'Pull Apple device inventory and blueprint status from Kandji.' },
  { name: 'Windows Autopilot', category: 'Provisioning', icon: 'pi pi-desktop', desc: 'Import Autopilot-registered devices and deployment profiles.' },
  { name: 'Jamf Pro', category: 'MDM', icon: 'pi pi-apple', desc: 'Sync macOS and iOS device inventory from Jamf Pro instances.' },
  { name: 'Personio', category: 'HR', icon: 'pi pi-users', desc: 'Sync your employee directory from Personio — departments, positions, and onboarding dates.' },
  { name: 'SAML / SSO', category: 'Identity', icon: 'pi pi-shield', desc: 'Connect Okta, Azure AD, Google Workspace, or any SAML 2.0 IdP.' },
  { name: 'SCIM', category: 'Provisioning', icon: 'pi pi-users', desc: 'Automated user provisioning and deprovisioning via SCIM 2.0.' },
  { name: 'Webhooks', category: 'Automation', icon: 'pi pi-bolt', desc: 'Trigger external workflows on asset events — assignments, returns, alerts.' },
  { name: 'REST API', category: 'Developer', icon: 'pi pi-code', desc: 'Full programmatic access to all resources. Build custom workflows.' },
  { name: 'BambooHR', category: 'HR', icon: 'pi pi-users', desc: 'Sync your employee directory from BambooHR — departments, positions, and start dates.' },
  { name: 'Google Workspace', category: 'Directory', icon: 'pi pi-google', desc: 'Sync users and organizational units from Google Workspace Admin Directory.' },
  { name: 'HiBob', category: 'HR', icon: 'pi pi-users', desc: 'Pull employees, departments, and job titles from HiBob HR platform.' },
  { name: 'Mosyle', category: 'MDM', icon: 'pi pi-apple', desc: 'Sync Apple device inventory and status from Mosyle MDM.' },
  { name: 'Zendesk / Freshdesk', category: 'Helpdesk', icon: 'pi pi-ticket', desc: 'Forward technical support requests into your central service queue.' },
]
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="integrations-content">
      <div class="integrations-header">
        <h1>Integrations</h1>
        <p>Connect AssetNode to the tools your team already uses. Sync devices, automate provisioning, and extend with our API.</p>
      </div>

      <div class="integrations-grid">
        <div
          v-for="int in integrations" :key="int.name"
          class="integration-card integration-card--clickable"
          @click="handleCardClick(int.name)"
        >
          <div class="integration-icon"><i :class="int.icon" /></div>
          <span class="integration-category">{{ int.category }}</span>
          <h3>{{ int.name }}</h3>
          <p>{{ int.desc }}</p>
          <span class="integration-setup-hint">
            <i class="pi pi-arrow-right" style="font-size:11px;" /> View Guide
          </span>
        </div>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>




.integrations-content { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; width: 100%; }
.integrations-header { text-align: center; margin-bottom: 56px; }
.integrations-header h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
.integrations-header p { color: var(--an-text-subtle); font-size: 1.1rem; max-width: 600px; margin: 0 auto; }

.integrations-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
@media (max-width: 900px) { .integrations-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 500px) { .integrations-grid { grid-template-columns: 1fr; } }

.integration-card {
  padding: 28px;
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  background: var(--an-surface-dark);
  transition: border-color 0.2s;
}
.integration-card:hover { border-color: var(--an-border-subtle); }
.integration-card--clickable { cursor: pointer; position: relative; }
.integration-card--clickable:hover { border-color: var(--an-primary); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(255,255,255,0.12); }
.integration-setup-hint { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 12px; font-weight: 600; color: var(--an-cobalt, #3b82f6); padding: 6px 16px; border-radius: 20px; border: 1px solid var(--an-cobalt, #3b82f6); position: relative; transition: all 0.2s; }
.integration-setup-hint::after { content: ''; position: absolute; inset: -4px; border-radius: 24px; border: 2px solid rgba(255, 255, 255, 0.6); animation: guide-ring 2.5s ease-in-out infinite; pointer-events: none; }
.integration-card--clickable:hover .integration-setup-hint { background: var(--an-cobalt, #3b82f6); color: #fff; }
.integration-card--clickable:hover .integration-setup-hint::after { animation: none; border-color: #fff; opacity: 1; }
@keyframes guide-ring { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
.integration-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; color: var(--an-cobalt); margin-bottom: 14px; font-size: 18px; }
.integration-category { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--an-primary); }
.integration-card h3 { font-size: 1rem; font-weight: 700; margin: 8px 0; }
.integration-card p { font-size: 13px; color: var(--an-text-subtle); line-height: 1.6; margin: 0; }

.legal-footer { max-width: 800px; margin: 0 auto; padding: 24px; border-top: 1px solid var(--an-border-dark); display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--an-text-muted); }
.legal-footer a { color: var(--an-primary); text-decoration: none; }


.legal-page--light .integration-card { background: white; border-color: #e5e7eb; }
.legal-page--light .integration-card--clickable:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.legal-page--light .legal-footer { border-top-color: #e5e7eb; }
</style>
