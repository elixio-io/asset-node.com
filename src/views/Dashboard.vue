<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import api from '../lib/api'
import { useStatusTranslation } from '../composables/useEntityTranslation'
import { useOnboardingTour } from '../composables/useOnboardingTour'
import GetStartedWizard from '../components/GetStartedWizard.vue'
import Message from 'primevue/message'

const { t } = useI18n()
const router = useRouter()
const { startTour, shouldAutoStart } = useOnboardingTour()

interface DashboardData {
  cards: {
    dueForReturn: number
    overdueReturn: number
    upcomingAudits: number
    overdueAudits: number
    expiringWarranties: number
    expiredWarranties: number
    expiringLicenses: number
    expiredLicenses: number
    lowStockCount: number
    openMaintenance: number
    pendingOffboarding: number
    totalDevices: number
  }
  statusCounts: Record<string, number>
  categoryBreakdown: { category: string; count: number; totalValue: number }[]
  summary: {
    totalAssetValue: number
    utilization: number
    totalEmployees: number
    activeAssignments: number
    totalDevices: number
  }
  recentActivity: {
    action: string
    entityType: string
    entityId: string
    userEmail: string
    timestamp: string
    details?: string
  }[]
}

const kpiConfig = [
  { key: 'totalDevices', icon: 'pi pi-desktop', label: 'Total Devices', route: '/hardware', color: '--an-primary' },
  { key: 'assetValue', icon: 'pi pi-dollar', label: 'Asset Value', route: '/reports', color: '--an-emerald' },
  { key: 'utilization', icon: 'pi pi-chart-pie', label: 'Utilization', route: '/assignments', color: '--an-cobalt' },
  { key: 'employees', icon: 'pi pi-users', label: 'Employees', route: '/employees', color: '--an-primary' },
  { key: 'assignments', icon: 'pi pi-link', label: 'Active Assignments', route: '/assignments', color: '--an-orange' }
]

const statusPalette = [
  '#10b981', '#3b82f6', '#ef4444', '#f97316', '#eab308',
  '#71717a', '#6366f1', '#8b5cf6', '#52525b'
]

const { translateStatusSlug } = useStatusTranslation()

const statusConfig = computed(() => {
  if (!data.value?.statusCounts) return []
  return Object.entries(data.value.statusCounts).map(([slug, count], idx) => ({
    key: slug,
    label: translateStatusSlug(slug),
    count,
    color: statusPalette[idx % statusPalette.length],
    icon: 'pi pi-circle-fill',
    route: '/hardware'
  }))
})

const alertConfig = [
  { key: 'overdueReturn', label: 'Overdue Returns', icon: 'pi pi-exclamation-circle', severity: 'error', route: '/assignments' },
  { key: 'overdueAudits', label: 'Overdue Audits', icon: 'pi pi-exclamation-triangle', severity: 'error', route: '/audits' },
  { key: 'expiredWarranties', label: 'Expired Warranties', icon: 'pi pi-times-circle', severity: 'error', route: '/hardware' },
  { key: 'expiredLicenses', label: 'Expired Licenses', icon: 'pi pi-times-circle', severity: 'error', route: '/licenses' },
  { key: 'expiringWarranties', label: 'Expiring Warranties', icon: 'pi pi-shield', severity: 'warning', route: '/hardware' },
  { key: 'expiringLicenses', label: 'Expiring Licenses', icon: 'pi pi-id-card', severity: 'warning', route: '/licenses' },
  { key: 'lowStockCount', label: 'Low Stock Items', icon: 'pi pi-box', severity: 'warning', route: '/consumables' },
  { key: 'openMaintenance', label: 'Open Maintenance', icon: 'pi pi-wrench', severity: 'warning', route: '/maintenance' },
  { key: 'dueForReturn', label: 'Due for Return', icon: 'pi pi-arrow-circle-left', severity: 'info', route: '/assignments' },
  { key: 'upcomingAudits', label: 'Upcoming Audits', icon: 'pi pi-clipboard', severity: 'info', route: '/audits' },
  { key: 'pendingOffboarding', label: 'Pending Offboarding', icon: 'pi pi-user-minus', severity: 'info', route: '/employees' }
]

const categoryPalette = [
  '#3b82f6', '#6366f1', '#10b981', '#f97316', '#eab308',
  '#ef4444', '#8b5cf6', '#71717a', '#ec4899', '#14b8a6'
]

function getCategoryColor(index: number): string {
  return categoryPalette[index % categoryPalette.length]
}

// Keys are lowercased entityType values. AuditLog stores them in PascalCase
// ("Workflow", "SoftwareLicense", …), so the lookup lowercases before matching.
const entityRoutes: Record<string, string> = {
  workflow: '/workflows', hardware: '/hardware', employee: '/employees',
  license: '/licenses', softwarelicense: '/licenses', consumable: '/consumables',
  peripheral: '/peripherals', maintenance: '/maintenance', maintenancerecord: '/maintenance',
  assignment: '/assignments', audit: '/audits', kit: '/kits', component: '/components',
  category: '/categories', status: '/statuses', manufacturer: '/manufacturers',
  supplier: '/suppliers', department: '/departments', depreciation: '/depreciations',
  customfield: '/custom-fields', location: '/locations', organization: '/company-profile'
}

function routeForEntity(entityType: string | undefined): string {
  return entityRoutes[String(entityType || '').toLowerCase()] || '/dashboard'
}

const actionIcons: Record<string, string> = {
  create: 'pi pi-plus-circle', update: 'pi pi-pencil', delete: 'pi pi-trash',
  assign: 'pi pi-link', unassign: 'pi pi-link', checkout: 'pi pi-arrow-right',
  checkin: 'pi pi-arrow-left', restore: 'pi pi-undo', import: 'pi pi-download'
}

const actionLabels: Record<string, string> = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  assign: 'Assigned', unassign: 'Unassigned', checkout: 'Checked Out',
  checkin: 'Checked In', restore: 'Restored', import: 'Imported'
}

const data = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const animatedValues = ref<Record<string, number>>({})

const formattedAssetValue = computed(() => {
  if (!data.value) return '$0'
  const val = data.value.summary.totalAssetValue
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`
  return `$${val.toFixed(0)}`
})

const totalStatusDevices = computed(() => {
  if (!data.value?.statusCounts) return 0
  return Object.values(data.value.statusCounts).reduce((a, b) => a + b, 0)
})

const statusDenominator = computed(() => totalStatusDevices.value || 1)

const totalCategoryMax = computed(() => {
  if (!data.value?.categoryBreakdown?.length) return 1
  return data.value.categoryBreakdown[0].count || 1
})


const activeAlerts = computed(() => {
  if (!data.value) return []
  return alertConfig.filter(a => (data.value!.cards as any)[a.key] > 0)
})

const sortedCategories = computed(() => {
  if (!data.value?.categoryBreakdown) return []
  return [...data.value.categoryBreakdown].sort((a, b) => b.count - a.count)
})

function getKpiValue(key: string): string {
  if (!data.value) return '—'
  switch (key) {
    case 'totalDevices': return String(data.value.summary.totalDevices)
    case 'assetValue': return formattedAssetValue.value
    case 'utilization': return `${data.value.summary.utilization}%`
    case 'employees': return String(data.value.summary.totalEmployees)
    case 'assignments': return String(data.value.summary.activeAssignments)
    default: return '0'
  }
}

function statusBarWidth(count: number): string {
  const pct = (count / statusDenominator.value) * 100
  return `${Math.max(pct, 2)}%`
}

function categoryBarWidth(count: number): string {
  const pct = (count / totalCategoryMax.value) * 100
  return `${Math.max(pct, 4)}%`
}

function timeAgo(timestamp: string | Date): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function navigateTo(route: string) {
  router.push(route)
}

function animateValue(key: string, target: number, durationMs = 800) {
  const start = animatedValues.value[key] || 0
  const range = target - start
  const startTime = performance.now()
  function step(now: number) {
    const progress = Math.min((now - startTime) / durationMs, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedValues.value[key] = Math.round(start + range * eased)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

onMounted(async () => {
  try {
    const response = await api.get('/dashboard/stats')
    data.value = response.data
  } catch (err) {
    error.value = 'Failed to load dashboard'
  } finally {
    loading.value = false
  }

  if (shouldAutoStart()) {
    setTimeout(() => startTour(), 800)
  }
})

watch(data, (d) => {
  if (!d) return
  animateValue('totalDevices', d.summary.totalDevices)
  animateValue('utilization', d.summary.utilization)
  animateValue('employees', d.summary.totalEmployees)
  animateValue('assignments', d.summary.activeAssignments)
})
</script>

<template>
  <div class="pbi-dashboard">
    <div class="pbi-inner">
      <div class="pbi-header">
        <div>
          <h1 class="pbi-title">{{ t('dashboard.title') }}</h1>
          <p class="pbi-subtitle">Interactive overview — click any tile to drill into the data</p>
        </div>
      </div>

      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">
        {{ error }}
      </Message>

      <GetStartedWizard mode="button" />

      <div v-if="loading" class="pbi-loading">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
        <span>Loading dashboard data…</span>
      </div>

      <template v-if="data && !loading">



        <div class="pbi-kpi-grid">
          <div
            v-for="kpi in kpiConfig"
            :key="kpi.key"
            class="pbi-kpi-tile"
            @click="navigateTo(kpi.route)"
            role="button"
            tabindex="0"
          >
            <div class="pbi-kpi-tile__icon" :style="{ background: `var(${kpi.color})` }">
              <i :class="kpi.icon"></i>
            </div>
            <div class="pbi-kpi-tile__body">
              <div class="pbi-kpi-tile__value">{{ getKpiValue(kpi.key) }}</div>
              <div class="pbi-kpi-tile__label">{{ kpi.label }}</div>
            </div>
            <i class="pi pi-chevron-right pbi-kpi-tile__arrow"></i>
          </div>
        </div>




        <div class="pbi-main-grid">
          <div class="pbi-col-left">
            <div class="pbi-card">
              <div class="pbi-card__header">
                <div class="pbi-card__header-left">
                  <i class="pi pi-chart-bar"></i>
                  <span class="pbi-card__title">{{ t('dashboard.assetsByStatus') }}</span>
                </div>
                <span class="pbi-card__badge">{{ totalStatusDevices }} total</span>
              </div>

              <div class="pbi-stacked-bar">
                <div
                  v-for="status in statusConfig"
                  :key="status.key"
                  class="pbi-stacked-bar__segment"
                  :style="{
                    width: statusBarWidth(status.count || 0),
                    background: status.color
                  }"
                  :title="`${status.label}: ${status.count || 0}`"
                  @click="navigateTo(status.route)"
                ></div>
              </div>

              <div class="pbi-status-legend">
                <div
                  v-for="status in statusConfig"
                  :key="status.key"
                  class="pbi-status-row"
                  @click="navigateTo(status.route)"
                >
                  <span class="pbi-status-row__dot" :style="{ background: status.color }"></span>
                  <i :class="status.icon" style="font-size: 0.8rem;" :style="{ color: status.color }"></i>
                  <span class="pbi-status-row__label">{{ status.label }}</span>
                  <span class="pbi-status-row__count">{{ status.count || 0 }}</span>
                  <i class="pi pi-chevron-right pbi-row-arrow"></i>
                </div>
              </div>
            </div>

            <div class="pbi-card">
              <div class="pbi-card__header">
                <div class="pbi-card__header-left">
                  <i class="pi pi-th-large"></i>
                  <span class="pbi-card__title">{{ t('dashboard.assetsByCategory') }}</span>
                </div>
              </div>
              <div class="pbi-category-list">
                <div
                  v-for="(cat, catIdx) in sortedCategories"
                  :key="cat.category"
                  class="pbi-category-row"
                  @click="navigateTo('/hardware')"
                >
                  <div class="pbi-category-row__info">
                    <span class="pbi-category-row__label">{{ cat.category }}</span>
                    <div class="pbi-category-row__meta">
                      <span class="pbi-category-row__count">{{ cat.count }}</span>
                      <span v-if="cat.totalValue" class="pbi-category-row__value">${{ cat.totalValue.toLocaleString() }}</span>
                    </div>
                  </div>
                  <div class="pbi-category-row__bar-track">
                    <div
                      class="pbi-category-row__bar-fill"
                      :style="{
                        width: categoryBarWidth(cat.count),
                        background: getCategoryColor(catIdx)
                      }"
                    ></div>
                  </div>
                </div>
                <div v-if="sortedCategories.length === 0" class="pbi-empty">
                  {{ t('common.noData') }}
                </div>
              </div>
            </div>
          </div>

          <div class="pbi-col-right">
            <div class="pbi-card">
              <div class="pbi-card__header">
                <div class="pbi-card__header-left">
                  <i class="pi pi-bell"></i>
                  <span class="pbi-card__title">Alerts & Actions</span>
                </div>
                <span v-if="activeAlerts.length" class="pbi-card__badge pbi-card__badge--alert">
                  {{ activeAlerts.length }} active
                </span>
              </div>

              <div class="pbi-alert-grid">
                <div
                  v-for="alert in alertConfig"
                  :key="alert.key"
                  class="pbi-alert-tile"
                  :class="[
                    `pbi-alert-tile--${alert.severity}`,
                    { 'pbi-alert-tile--active': (data.cards as any)[alert.key] > 0 }
                  ]"
                  @click="navigateTo(alert.route)"
                >
                  <div class="pbi-alert-tile__icon">
                    <i :class="alert.icon"></i>
                  </div>
                  <div class="pbi-alert-tile__count">{{ (data.cards as any)[alert.key] || 0 }}</div>
                  <div class="pbi-alert-tile__label">{{ alert.label }}</div>
                </div>
              </div>
            </div>

            <div class="pbi-card">
              <div class="pbi-card__header">
                <div class="pbi-card__header-left">
                  <i class="pi pi-history"></i>
                  <span class="pbi-card__title">Recent Activity</span>
                </div>
              </div>

              <div class="pbi-activity-list">
                <template v-if="data.recentActivity?.length">
                  <div
                    v-for="(activity, idx) in data.recentActivity"
                    :key="idx"
                    class="pbi-activity-item"
                    @click="navigateTo(routeForEntity(activity.entityType))"
                  >
                    <div class="pbi-activity-item__icon">
                      <i :class="actionIcons[activity.action] || 'pi pi-circle'"></i>
                    </div>
                    <div class="pbi-activity-item__body">
                      <div class="pbi-activity-item__action">
                        <span class="pbi-activity-item__verb">{{ actionLabels[activity.action] || activity.action }}</span>
                        <span class="pbi-activity-item__entity">{{ activity.entityType }}</span>
                      </div>
                      <div class="pbi-activity-item__meta">
                        {{ activity.userEmail }} · {{ timeAgo(activity.timestamp) }}
                        <span v-if="activity.details"> · {{ activity.details }}</span>
                      </div>
                    </div>
                    <i class="pi pi-chevron-right pbi-row-arrow"></i>
                  </div>
                </template>
                <div v-else class="pbi-empty">
                  <i class="pi pi-history" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>
                  No recent activity
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>

.pbi-dashboard { padding: 0; }
.pbi-inner { max-width: 1440px; margin: 0 auto; padding: 28px 24px 48px; }

.pbi-header { margin-bottom: 24px; }
.pbi-title {
  font-size: 1.75rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1.2;
}
.pbi-subtitle {
  margin-top: 4px; font-size: 13px; color: var(--an-text-subtle);
}

.pbi-loading {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 48px; color: var(--an-text-muted);
}

.pbi-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

@media (max-width: 1100px) { .pbi-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px)  { .pbi-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px)  { .pbi-kpi-grid { grid-template-columns: 1fr; } }

.pbi-kpi-tile {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.pbi-kpi-tile::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pbi-kpi-tile:hover {
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.pbi-kpi-tile:hover::before { opacity: 1; }

.pbi-kpi-tile__icon {
  width: 42px; height: 42px;
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: white;
  font-size: 1.1rem;
}

.pbi-kpi-tile__body { flex: 1; min-width: 0; }
.pbi-kpi-tile__value {
  font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.pbi-kpi-tile__label { font-size: 12px; color: var(--an-text-muted); margin-top: 2px; }
.pbi-kpi-tile__arrow { color: var(--an-text-muted); font-size: 0.75rem; opacity: 0; transition: opacity 0.2s; }
.pbi-kpi-tile:hover .pbi-kpi-tile__arrow { opacity: 1; }

.pbi-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 960px) { .pbi-main-grid { grid-template-columns: 1fr; } }

.pbi-col-left, .pbi-col-right { display: flex; flex-direction: column; gap: 16px; }

.pbi-card {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-lg);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.pbi-card__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--an-border-dark);
}

.pbi-card__header-left { display: flex; align-items: center; gap: 8px; }
.pbi-card__title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }

.pbi-card__badge {
  font-size: 11px; font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--an-surface-elevated);
  color: var(--an-text-subtle);
  font-variant-numeric: tabular-nums;
}

.pbi-card__badge--alert {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.pbi-stacked-bar {
  display: flex;
  height: 10px;
  margin: 16px 18px 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--an-surface-elevated);
}

.pbi-stacked-bar__segment {
  min-width: 3px;
  cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
  position: relative;
}

.pbi-stacked-bar__segment:hover {
  opacity: 0.85;
  filter: brightness(1.2);
}

.pbi-stacked-bar__segment:first-child { border-radius: 999px 0 0 999px; }
.pbi-stacked-bar__segment:last-child  { border-radius: 0 999px 999px 0; }

.pbi-status-legend { padding: 4px 0 2px; }

.pbi-status-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--an-border-dark);
  cursor: pointer;
  transition: background 0.15s ease;
}

.pbi-status-row:last-child { border-bottom: none; }
.pbi-status-row:hover { background: var(--an-surface-elevated); }

.pbi-status-row__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pbi-status-row__label { flex: 1; font-size: 13px; color: var(--an-text-subtle); }
.pbi-status-row__count {
  font-size: 14px; font-weight: 700; min-width: 28px; text-align: right;
  font-variant-numeric: tabular-nums;
}

.pbi-category-list { padding: 4px 0 2px; }

.pbi-category-row {
  padding: 10px 18px;
  border-bottom: 1px solid var(--an-border-dark);
  cursor: pointer;
  transition: background 0.15s ease;
}

.pbi-category-row:last-child { border-bottom: none; }
.pbi-category-row:hover { background: var(--an-surface-elevated); }

.pbi-category-row__info {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}

.pbi-category-row__label { font-size: 13px; color: var(--an-text-subtle); }
.pbi-category-row__meta { display: flex; align-items: center; gap: 12px; }
.pbi-category-row__count { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pbi-category-row__value { font-size: 12px; color: var(--an-emerald); }

.pbi-category-row__bar-track {
  height: 6px;
  border-radius: 999px;
  background: var(--an-surface-elevated);
  overflow: hidden;
}

.pbi-category-row__bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.pbi-alert-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 14px;
}

@media (max-width: 600px) { .pbi-alert-grid { grid-template-columns: repeat(2, 1fr); } }

.pbi-alert-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14px 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--an-border-dark);
  background: var(--an-surface-elevated);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  opacity: 0.45;
}

.pbi-alert-tile--active { opacity: 1; }

.pbi-alert-tile--active.pbi-alert-tile--error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.06);
}

.pbi-alert-tile--active.pbi-alert-tile--warning {
  border-color: rgba(249, 115, 22, 0.3);
  background: rgba(249, 115, 22, 0.06);
}

.pbi-alert-tile--active.pbi-alert-tile--info {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.06);
}

.pbi-alert-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.pbi-alert-tile__icon { font-size: 1.25rem; margin-bottom: 6px; }
.pbi-alert-tile--error .pbi-alert-tile__icon { color: #ef4444; }
.pbi-alert-tile--warning .pbi-alert-tile__icon { color: #f97316; }
.pbi-alert-tile--info .pbi-alert-tile__icon { color: #3b82f6; }

.pbi-alert-tile__count {
  font-size: 1.25rem; font-weight: 700; line-height: 1;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.pbi-alert-tile__label { font-size: 11px; color: var(--an-text-muted); line-height: 1.3; }

.pbi-activity-list { max-height: 480px; overflow-y: auto; padding: 2px 0; }

.pbi-activity-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--an-border-dark);
  cursor: pointer;
  transition: background 0.15s ease;
}

.pbi-activity-item:last-child { border-bottom: none; }
.pbi-activity-item:hover { background: var(--an-surface-elevated); }

.pbi-activity-item__icon {
  flex-shrink: 0; padding-top: 2px;
  font-size: 0.875rem; color: var(--an-text-muted);
}

.pbi-activity-item__body { flex: 1; min-width: 0; }
.pbi-activity-item__action { font-size: 13px; }
.pbi-activity-item__verb { font-weight: 600; }
.pbi-activity-item__entity { color: var(--an-cobalt); margin-left: 4px; }
.pbi-activity-item__meta { font-size: 12px; color: var(--an-text-muted); margin-top: 2px; }

.pbi-row-arrow {
  font-size: 0.7rem; color: var(--an-text-muted);
  opacity: 0; transition: opacity 0.15s;
  flex-shrink: 0; align-self: center;
}

.pbi-status-row:hover .pbi-row-arrow,
.pbi-activity-item:hover .pbi-row-arrow { opacity: 1; }

.pbi-empty {
  padding: 32px; text-align: center; color: var(--an-text-muted); font-size: 13px;
}
</style>
