<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useOnboardingTour } from '../../composables/useOnboardingTour'
import { setLocale, getLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Divider from 'primevue/divider'
import AssetNodeLogo from '../illustrations/AssetNodeLogo.vue'
import AnimatedBrand from '../illustrations/AnimatedBrand.vue'

const props = defineProps<{ mobileOpen?: boolean }>()
const emit = defineEmits<{
  'update:mini': [value: boolean]
  'close-mobile': []
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const { t } = useI18n()
const miniDrawer = ref(false)
const currentLocale = ref(getLocale())
const profileMenuRef = ref()
const localeMenuRef = ref()

function toggleSidebar() {
  miniDrawer.value = !miniDrawer.value
  emit('update:mini', miniDrawer.value)
}

const localeMenuItems = computed(() => [{
  label: 'Language',
  items: SUPPORTED_LOCALES.map(l => ({
    label: l.label,
    icon: l.code === currentLocale.value ? 'pi pi-check' : undefined,
    command: () => {
      setLocale(l.code)
      currentLocale.value = l.code
    }
  }))
}])

function toggleLocaleMenu(event: Event) {
  localeMenuRef.value?.toggle(event)
}

interface NavItem {
  title: string
  icon: string
  to?: string
  action?: () => void
  roles?: string[]
  highlight?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
  roles?: string[]
}

const sections = computed<NavSection[]>(() => [
  {
    title: '',
    items: [
      { title: t('nav.dashboard'), icon: 'pi pi-home', to: '/dashboard' }
    ]
  },
  {
    title: t('nav.assets'),
    items: [
      { title: t('nav.setupGuides'), icon: 'pi pi-book', action: () => window.dispatchEvent(new CustomEvent('open-setup-guide')), roles: ['admin'], highlight: true },
      { title: t('nav.marketplace'), icon: 'pi pi-shopping-bag', to: '/marketplace' },
      { title: t('nav.hardware'), icon: 'pi pi-desktop', to: '/hardware' },
      { title: t('nav.peripherals'), icon: 'pi pi-link', to: '/peripherals' },
      { title: t('nav.licenses'), icon: 'pi pi-id-card', to: '/licenses' },
      { title: t('nav.consumables'), icon: 'pi pi-box', to: '/consumables' },
      { title: t('procurement.title'), icon: 'pi pi-shopping-cart', to: '/procurement', roles: ['admin', 'manager'] },
      { title: t('nav.manufacturers'), icon: 'pi pi-building', to: '/manufacturers', roles: ['admin', 'manager'] },
      { title: t('nav.suppliers'), icon: 'pi pi-truck', to: '/suppliers', roles: ['admin', 'manager'] },
      { title: t('nav.components'), icon: 'pi pi-microchip', to: '/components', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: t('nav.people'),
    roles: ['admin', 'manager'],
    items: [
      { title: t('nav.employees'), icon: 'pi pi-users', to: '/employees', roles: ['admin', 'manager'] },
      { title: t('nav.assignments'), icon: 'pi pi-arrows-h', to: '/assignments', roles: ['admin', 'manager'] },
      { title: t('nav.myTeam'), icon: 'pi pi-user-plus', to: '/my-team', roles: ['admin', 'manager'] },
      { title: t('nav.locations'), icon: 'pi pi-map-marker', to: '/locations', roles: ['admin', 'manager'] },
      { title: t('nav.kits'), icon: 'pi pi-briefcase', to: '/kits', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: t('nav.operations'),
    roles: ['admin', 'manager'],
    items: [
      { title: t('nav.automations'), icon: 'pi pi-bolt', to: '/workflows', roles: ['admin', 'manager'] },
      { title: t('nav.maintenance'), icon: 'pi pi-wrench', to: '/maintenance', roles: ['admin', 'manager'] },
      { title: t('nav.audits'), icon: 'pi pi-clipboard', to: '/audits', roles: ['admin', 'manager'] },
      { title: t('nav.depreciations'), icon: 'pi pi-chart-line', to: '/depreciations', roles: ['admin', 'manager'] },
      { title: t('nav.labels'), icon: 'pi pi-qrcode', to: '/labels', roles: ['admin', 'manager'] },
      { title: t('nav.recycleBin'), icon: 'pi pi-trash', to: '/recycle-bin', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: t('nav.analytics'),
    roles: ['admin', 'manager'],
    items: [
      { title: t('nav.reports'), icon: 'pi pi-chart-bar', to: '/reports', roles: ['admin', 'manager'] },
      { title: t('nav.import'), icon: 'pi pi-upload', to: '/import', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: t('nav.organization'),
    roles: ['admin', 'manager'],
    items: [
      { title: t('nav.departments'), icon: 'pi pi-sitemap', to: '/departments', roles: ['admin', 'manager'] },
      { title: t('nav.categories'), icon: 'pi pi-th-large', to: '/categories', roles: ['admin', 'manager'] },
      { title: t('nav.statuses'), icon: 'pi pi-list', to: '/statuses', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: t('nav.statusViews'),
    items: [
      { title: t('nav.available'), icon: 'pi pi-check-circle', to: '/available' },
      { title: t('nav.defective'), icon: 'pi pi-exclamation-circle', to: '/defective' },
      { title: t('nav.forSale'), icon: 'pi pi-tag', to: '/sales' }
    ]
  },
  {
    title: '',
    items: [
      { title: t('nav.myItems'), icon: 'pi pi-briefcase', to: '/my-items' }
    ]
  },
  {
    title: t('nav.administration'),
    roles: ['admin'],
    items: [
      { title: t('nav.settings'), icon: 'pi pi-cog', to: '/settings', roles: ['admin'] },
      { title: t('common.billing'), icon: 'pi pi-credit-card', to: '/billing', roles: ['admin'] },
      { title: t('nav.customFields'), icon: 'pi pi-pencil', to: '/custom-fields', roles: ['admin'] },
      { title: t('nav.aiLogs'), icon: 'pi pi-sparkles', to: '/ai-logs', roles: ['admin', 'manager'] }
    ]
  },
  {
    title: 'Platform',
    roles: ['superAdmin'],
    items: [
      { title: 'Super Admin', icon: 'pi pi-shield', to: '/super-admin', roles: ['superAdmin'] }
    ]
  }
])

const filteredSections = computed(() => {
  const role = authStore.userRole
  if (!role) return []

  return sections.value
    .filter(section => {
      if (section.roles && !authStore.hasRole(...section.roles as any[])) return false
      return true
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.roles && !authStore.hasRole(...item.roles as any[])) return false
        return true
      })
    }))
    .filter(section => section.items.length > 0)
})

const userInitials = computed(() => {
  const u = authStore.user
  if (!u) return '?'
  return (u.firstName?.[0] || '') + (u.lastName?.[0] || '')
})

const userDisplayName = computed(() => {
  return authStore.user?.fullName || authStore.user?.email || ''
})

const userRole = computed(() => {
  return authStore.userRole || ''
})

const profileMenuItems = computed(() => [
  {
    label: userDisplayName.value,
    items: [
      {
        label: t('nav.myProfile'),
        icon: 'pi pi-user',
        command: () => router.push('/profile')
      },
      {
        label: t('nav.company'),
        icon: 'pi pi-building',
        command: () => router.push('/company-profile')
      },
      {
        label: t('nav.privacyData'),
        icon: 'pi pi-lock',
        command: () => router.push('/privacy')
      },
      { separator: true },
      {
        label: t('nav.signOut'),
        icon: 'pi pi-sign-out',
        class: 'text-red-400',
        command: () => handleLogout()
      }
    ]
  }
])

function toggleProfileMenu(event: Event) {
  profileMenuRef.value?.toggle(event)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/sign-in')
}

function openReportIssue() {
  window.dispatchEvent(new CustomEvent('open-report-issue'))
}

const { resetTour } = useOnboardingTour()

async function restartProductTour() {
  emit('close-mobile')
  await resetTour()
}

function handleNavClick() {
  emit('close-mobile')
}

watch(() => route.path, () => {
  emit('close-mobile')
})
</script>

<template>
  <aside
    class="sidebar"
    :class="{
      'sidebar--mini': miniDrawer,
      'sidebar--mobile-open': mobileOpen
    }"
  >
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <AssetNodeLogo :size="32" style="color: var(--an-primary);" />
      </div>
      <button
        class="sidebar-toggle"
        :class="{ 'sidebar-toggle--mini': miniDrawer }"
        @click="toggleSidebar"
        :title="miniDrawer ? 'Expand menu' : 'Collapse'"
      >
        <svg v-if="miniDrawer" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-nav">
      <template v-for="(section, sIdx) in filteredSections" :key="sIdx">
        <div
          v-if="section.title && !miniDrawer"
          class="sidebar-section-label"
        >
          {{ section.title }}
        </div>
        <Divider v-else-if="sIdx > 0 && miniDrawer" class="my-2 mx-3" />

        <component
          :is="item.to ? 'router-link' : 'a'"
          v-for="(item, idx) in section.items"
          :key="item.to || idx"
          :to="item.to"
          :href="item.to ? undefined : '#'"
          @click="item.action ? item.action() : handleNavClick()"
          class="sidebar-nav-item"
          :class="{
            'sidebar-nav-item--active': item.to && route.path === item.to,
            'sidebar-nav-item--highlight': item.highlight
          }"
          v-tooltip.right="miniDrawer ? item.title : undefined"
        >
          <i
            :class="[item.icon, { 'text-blue-400': item.to && route.path === item.to }]"
            style="font-size: 1.1rem; width: 20px; text-align: center;"
          />
          <span v-if="!miniDrawer" class="sidebar-nav-label">{{ item.title }}</span>
        </component>
      </template>
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-footer-actions" :class="{ 'sidebar-footer-actions--mini': miniDrawer }">
        <Button
          :label="!miniDrawer ? currentLocale.toUpperCase() : undefined"
          :icon="miniDrawer ? 'pi pi-globe' : undefined"
          text
          rounded
          severity="secondary"
          size="small"
          v-tooltip.top="SUPPORTED_LOCALES.find(l => l.code === currentLocale)?.label"
          @click="toggleLocaleMenu"
          class="sidebar-action-btn"
        />
        <Menu ref="localeMenuRef" :model="localeMenuItems" :popup="true" />

        <Button
          :icon="themeStore.icon"
          text
          rounded
          severity="secondary"
          size="small"
          v-tooltip.top="themeStore.label"
          @click="themeStore.toggle()"
          class="sidebar-action-btn"
        />
      </div>

      <button
        class="sidebar-report-btn" style="background: transparent; border: 1px solid var(--an-border-dark);"
        @click="restartProductTour"
        v-tooltip.top="miniDrawer ? 'Product Tour' : undefined"
      >
        <i class="pi pi-question-circle" />
        <span v-if="!miniDrawer">Product Tour</span>
      </button>

      <button
        class="sidebar-report-btn"
        @click="openReportIssue"
        v-tooltip.top="miniDrawer ? t('nav.reportIssue') : undefined"
      >
        <i class="pi pi-flag" />
        <span v-if="!miniDrawer">{{ t('nav.reportIssue') }}</span>
      </button>

      <div class="sidebar-user-profile" @click="toggleProfileMenu">
        <Avatar
          :label="userInitials"
          shape="circle"
          class="sidebar-user-avatar"
          style="background: var(--an-emerald); color: #000; font-weight: 700; font-size: 12px;"
        />
        <div v-if="!miniDrawer" class="sidebar-user-info">
          <span class="sidebar-user-name">{{ userDisplayName }}</span>
          <span class="sidebar-user-role">{{ userRole }}</span>
        </div>
      </div>
      <Menu ref="profileMenuRef" :model="profileMenuItems" :popup="true" />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 256px;
  background: var(--an-surface-dark);
  border-right: 1px solid var(--an-border-dark);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: width var(--transition-normal), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.sidebar--mini {
  width: 72px;
}

.sidebar-header {
  padding: 20px 16px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.sidebar-brand-text {
  overflow: hidden;
}

.sidebar-brand-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--an-text-primary);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sidebar-brand-tier {
  font-size: 11px;
  color: var(--an-text-subtle);
  white-space: nowrap;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--an-border-dark);
  background: var(--an-surface-dark);
  color: var(--an-text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.3s;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  color: var(--an-text-primary);
  border-color: var(--an-border-subtle);
  background: var(--an-surface-elevated);
}

.sidebar-toggle--flipped {
  transform: rotate(180deg);
}

.sidebar--mini .sidebar-header {
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 8px 12px;
}

.sidebar-toggle--mini {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--an-border-dark);
  background: var(--an-surface-elevated);
}

.sidebar--mini .sidebar-nav {
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-nav {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  flex: 1;
}

.sidebar-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--an-text-muted);
  padding: 16px 12px 6px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  color: var(--an-text-subtle);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.sidebar-nav-item:hover {
  color: var(--an-text-primary);
  background: var(--an-surface-elevated);
}

.sidebar-nav-item--active {
  color: var(--an-text-primary) !important;
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-nav-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 16px;
  width: 3px;
  background: var(--an-cobalt);
  border-radius: 0 9999px 9999px 0;
}

.sidebar-nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar--mini .sidebar-nav-item {
  justify-content: center;
  padding: 8px;
}

.sidebar--mini .sidebar-nav-item--active::before {
  left: 4px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--an-border-dark);
}

.sidebar-footer-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 12px;
}

.sidebar-footer-actions--mini {
  flex-direction: column;
  align-items: center;
}

.sidebar-action-btn {
  color: var(--an-text-subtle) !important;
}

.sidebar-user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.sidebar-user-profile:hover {
  background: var(--an-surface-elevated);
}

.sidebar-user-avatar {
  flex-shrink: 0;
}

.sidebar-user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--an-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 10px;
  color: var(--an-text-subtle);
  text-transform: capitalize;
}

.sidebar--mini .sidebar-user-profile {
  justify-content: center;
}

.sidebar-nav-item--highlight {
  position: relative;
  color: var(--an-text-primary) !important;
}

.sidebar-nav-item--highlight::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: var(--radius-md);
  border: 2px solid rgba(255, 255, 255, 0.6);
  animation: nav-ring-pulse 2.5s ease-in-out infinite;
  pointer-events: none;
}

.sidebar-nav-item--highlight:hover::after {
  animation: none;
  border-color: var(--an-cobalt);
  opacity: 1;
}

@keyframes nav-ring-pulse {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}

.sidebar-report-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-report-btn i { font-size: 13px; }

.sidebar-report-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15);
}

.sidebar--mini .sidebar-report-btn {
  padding: 9px;
}

.sidebar--mini .sidebar-report-btn span { display: none; }

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    width: 280px;
    box-shadow: none;
  }

  .sidebar--mobile-open {
    transform: translateX(0);
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.4);
  }

  .sidebar--mini {
    width: 280px;
  }

  .sidebar-toggle {
    display: none;
  }

  .sidebar--mini .sidebar-nav-item {
    justify-content: flex-start;
    padding: 8px 12px;
  }

  .sidebar--mini .sidebar-user-profile {
    justify-content: flex-start;
  }
}
</style>
