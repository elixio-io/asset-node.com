<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '../lib/api'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'


interface PlatformStats {
  totalOrgs: number
  activeOrgs: number
  totalUsers: number
  activeUsers: number
  todayOrgs: number
  todayUsers: number
  plans: { free: number; starter: number; pro: number; enterprise: number }
}

interface OrgRow {
  _id: string
  name: string
  slug: string
  plan: string
  isActive: boolean
  notes?: string
  userCount: number
  billingStatus: string
  billing?: {
    status?: string
    trialEndsAt?: string
    accessOverride?: { plan?: string; grantedAt?: string; expiresAt?: string }
  }
  createdAt: string
}

interface UserRow {
  _id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  companyName: string
  orgId?: { _id: string; name: string; slug: string; plan: string }
}

interface NotificationConfig {
  maintainerEmail: string
  webhookUrl: string
  webhookSecret: string
  note: string
}

interface SystemHealth {
  status: string
  uptime: number
  uptimeFormatted: string
  memory: { rss: string; heapUsed: string; heapTotal: string; external: string; rawBytes: { rss: number; heapUsed: number; heapTotal: number } }
  db: { status: string; name: string }
  timestamp: string
}

interface DbStats {
  dbName: string
  totalCollections: number
  totalDocuments: number
  totalStorageFormatted: string
  collections: Array<{ name: string; count: number; storageSizeFormatted: string; indexCount: number }>
}

interface RevenueData {
  mrr: number
  arr: number
  mrrFormatted: string
  arrFormatted: string
  activeSubscriptions: number
  trialingOrgs: number
  pastDueOrgs: number
  churnedLast30Days: number
  revenueByPlan: Record<string, { count: number; mrr: number }>
}

interface TrialOrg {
  _id: string
  name: string
  slug: string
  plan: string
  daysRemaining: number
  isExpiringSoon: boolean
  trialEndsAt: string
}


const activeTab = ref(0)

const statsLoading = ref(false)
const stats = ref<PlatformStats | null>(null)

const orgsLoading = ref(false)
const orgs = ref<OrgRow[]>([])
const orgsTotal = ref(0)
const orgPage = ref(1)
const orgSearch = ref('')
const orgPlanFilter = ref('')

const usersLoading = ref(false)
const users = ref<UserRow[]>([])
const usersTotal = ref(0)
const userPage = ref(1)
const userSearch = ref('')
const userRoleFilter = ref('')
const userActiveFilter = ref<boolean | null>(null)

const notifConfig = ref<NotificationConfig | null>(null)
const notifLoading = ref(false)
const testLoading = ref(false)
const testResult = ref<{ success: boolean; message?: string; error?: string } | null>(null)

const editingOrg = ref<OrgRow | null>(null)
const orgEditDialog = ref(false)
const orgSaving = ref(false)

const systemHealth = ref<SystemHealth | null>(null)
const dbStats = ref<DbStats | null>(null)
const systemLoading = ref(false)

const revenue = ref<RevenueData | null>(null)
const trials = ref<TrialOrg[]>([])
const billingLoading = ref(false)

const grantingTrial = ref<string | null>(null)

const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)


const kpiCards = computed(() => {
  if (!stats.value) return []
  return [
    { title: 'Total Organizations', value: stats.value.totalOrgs, sub: `${stats.value.todayOrgs} today`, icon: 'pi pi-building', color: 'text-blue-500' },
    { title: 'Active Orgs', value: stats.value.activeOrgs, sub: `${stats.value.totalOrgs - stats.value.activeOrgs} suspended`, icon: 'pi pi-check-circle', color: 'text-green-500' },
    { title: 'Total Users', value: stats.value.totalUsers, sub: `${stats.value.todayUsers} today`, icon: 'pi pi-users', color: 'text-purple-500' },
    { title: 'Active Users', value: stats.value.activeUsers, sub: `${stats.value.totalUsers - stats.value.activeUsers} inactive`, icon: 'pi pi-user-plus', color: 'text-orange-500' }
  ]
})

const planChartData = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'free', count: stats.value.plans.free, color: 'secondary' },
    { label: 'starter', count: stats.value.plans.starter, color: 'info' },
    { label: 'pro', count: stats.value.plans.pro, color: 'primary' },
    { label: 'enterprise', count: stats.value.plans.enterprise, color: 'warn' }
  ]
})


onMounted(async () => {
  await Promise.all([fetchStats(), fetchOrgs(), fetchNotifConfig()])
})

const heapPercent = computed(() => {
  if (!systemHealth.value) return 0
  const raw = systemHealth.value.memory.rawBytes
  return Math.round((raw.heapUsed / raw.heapTotal) * 100)
})


async function fetchStats(): Promise<void> {
  statsLoading.value = true
  try {
    const res = await api.get('/super-admin/stats')
    stats.value = res.data
  } catch {
    showError('Failed to load platform stats')
  } finally {
    statsLoading.value = false
  }
}

async function fetchOrgs(): Promise<void> {
  orgsLoading.value = true
  try {
    const res = await api.get('/super-admin/organizations', {
      params: {
        page: orgPage.value,
        limit: 25,
        ...(orgSearch.value && { search: orgSearch.value }),
        ...(orgPlanFilter.value && { plan: orgPlanFilter.value })
      }
    })
    orgs.value = res.data.data
    orgsTotal.value = res.data.total
  } catch {
    showError('Failed to load organizations')
  } finally {
    orgsLoading.value = false
  }
}

async function fetchUsers(): Promise<void> {
  usersLoading.value = true
  try {
    const res = await api.get('/super-admin/users', {
      params: {
        page: userPage.value,
        limit: 25,
        ...(userSearch.value && { search: userSearch.value }),
        ...(userRoleFilter.value && { role: userRoleFilter.value }),
        ...(userActiveFilter.value !== null && { isActive: userActiveFilter.value })
      }
    })
    users.value = res.data.data
    usersTotal.value = res.data.total
  } catch {
    showError('Failed to load users')
  } finally {
    usersLoading.value = false
  }
}

async function fetchNotifConfig(): Promise<void> {
  notifLoading.value = true
  try {
    const res = await api.get('/super-admin/notifications/config')
    notifConfig.value = res.data
  } catch {
    showError('Failed to load notification config')
  } finally {
    notifLoading.value = false
  }
}

async function updateOrgPlan(org: OrgRow, newPlan: string): Promise<void> {
  try {
    await api.patch(`/super-admin/organizations/${org._id}`, { plan: newPlan })
    org.plan = newPlan
    showSuccess(`Plan updated to ${newPlan}`)
  } catch {
    showError('Failed to update plan')
  }
}

async function grantEnterpriseTrial(org: OrgRow): Promise<void> {
  grantingTrial.value = org._id
  try {
    const res = await api.post(`/super-admin/organizations/${org._id}/enterprise-trial`, { days: 30 })
    org.billing = {
      ...org.billing,
      accessOverride: res.data.accessOverride
    }
    showSuccess(`Enterprise access unlocked for ${org.name} without changing billing`)
  } catch (err: any) {
    showError(err?.response?.data?.error || 'Failed to unlock Enterprise access')
  } finally {
    grantingTrial.value = null
  }
}

function hasActiveEnterpriseAccess(org: OrgRow): boolean {
  const override = org.billing?.accessOverride
  return override?.plan === 'enterprise' && !!override.expiresAt && new Date(override.expiresAt).getTime() > Date.now()
}

async function revokeEnterpriseAccess(org: OrgRow): Promise<void> {
  if (!window.confirm(`Revoke temporary Enterprise access for ${org.name}? Billing will remain unchanged.`)) return
  grantingTrial.value = org._id
  try {
    await api.delete(`/super-admin/organizations/${org._id}/enterprise-trial`)
    if (org.billing) org.billing.accessOverride = undefined
    showSuccess(`Temporary Enterprise access revoked for ${org.name}`)
  } catch (err: any) {
    showError(err?.response?.data?.error || 'Failed to revoke Enterprise access')
  } finally {
    grantingTrial.value = null
  }
}

async function toggleOrgActive(org: OrgRow): Promise<void> {
  try {
    await api.patch(`/super-admin/organizations/${org._id}`, { isActive: !org.isActive })
    org.isActive = !org.isActive
    showSuccess(`Organization ${org.isActive ? 'activated' : 'suspended'}`)
  } catch {
    showError('Failed to update organization status')
  }
}

async function saveOrgNotes(): Promise<void> {
  if (!editingOrg.value) return
  orgSaving.value = true
  try {
    await api.patch(`/super-admin/organizations/${editingOrg.value._id}`, {
      notes: editingOrg.value.notes
    })
    const target = orgs.value.find((o) => o._id === editingOrg.value!._id)
    if (target) target.notes = editingOrg.value.notes
    orgEditDialog.value = false
    showSuccess('Notes saved')
  } catch {
    showError('Failed to save notes')
  } finally {
    orgSaving.value = false
  }
}

async function updateUserRole(user: UserRow, newRole: string): Promise<void> {
  try {
    await api.patch(`/super-admin/users/${user._id}/role`, { role: newRole })
    user.role = newRole
    showSuccess(`Role updated to ${newRole}`)
  } catch {
    showError('Failed to update role')
  }
}

async function toggleUserActive(user: UserRow): Promise<void> {
  try {
    await api.patch(`/super-admin/users/${user._id}/active`, { isActive: !user.isActive })
    user.isActive = !user.isActive
    showSuccess(`User ${user.isActive ? 'activated' : 'deactivated'}`)
  } catch {
    showError('Failed to update user status')
  }
}

async function sendTestNotification(): Promise<void> {
  testLoading.value = true
  testResult.value = null
  try {
    const res = await api.post('/super-admin/notifications/test')
    testResult.value = { success: true, message: res.data.message }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Test failed'
    testResult.value = { success: false, error: message }
    showError(message)
  } finally {
    testLoading.value = false
  }
}

function onTabChange(e: any): void {
  const index = e.index
  if (index === 2 && users.value.length === 0) fetchUsers()
  if (index === 4 && !systemHealth.value) fetchSystemHealth()
  if (index === 5 && !revenue.value) fetchBilling()
}

async function fetchSystemHealth(): Promise<void> {
  systemLoading.value = true
  try {
    const [healthRes, dbRes] = await Promise.all([
      api.get('/super-admin/system/health'),
      api.get('/super-admin/system/db-stats')
    ])
    systemHealth.value = healthRes.data
    dbStats.value = dbRes.data
  } catch {
    showError('Failed to load system health')
  } finally {
    systemLoading.value = false
  }
}

async function fetchBilling(): Promise<void> {
  billingLoading.value = true
  try {
    const [revRes, trialRes] = await Promise.all([
      api.get('/super-admin/stats/revenue'),
      api.get('/super-admin/billing/trials')
    ])
    revenue.value = revRes.data
    trials.value = trialRes.data?.data || []
  } catch {
    showError('Failed to load billing data')
  } finally {
    billingLoading.value = false
  }
}

async function exportCsv(type: 'organizations' | 'users'): Promise<void> {
  try {
    const res = await api.get(`/super-admin/export/${type}`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showSuccess(`${type} exported`)
  } catch {
    showError(`Failed to export ${type}`)
  }
}

function showError(msg: string) {
  error.value = msg
  setTimeout(() => error.value = null, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => successMsg.value = null, 5000)
}

function planColor(plan: string): string {
  const colors: Record<string, string> = {
    free: 'secondary', starter: 'info', pro: 'primary', enterprise: 'warn'
  }
  return colors[plan] ?? 'secondary'
}

function roleColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'primary', manager: 'info', employee: 'secondary', viewer: 'secondary'
  }
  return colors[role] ?? 'secondary'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

function openOrgNotes(org: OrgRow): void {
  editingOrg.value = { ...org }
  orgEditDialog.value = true
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <Message v-if="successMsg" severity="success" closable @close="successMsg = null" class="mb-4">{{ successMsg }}</Message>

      <div class="view-header">
        <div>
          <div class="flex align-items-center gap-3 mb-1">
            <i class="pi pi-shield text-purple-500" style="font-size: 2rem;"></i>
            <h1 class="text-2xl font-bold m-0" style="letter-spacing: -0.02em;">Platform Super-Admin</h1>
          </div>
          <p class="mt-1" style="color: var(--an-text-subtle); font-size: 14px;">
            Platform-wide overview — organizations, users, and maintainer alerts
          </p>
        </div>
        <div class="flex align-items-center gap-2">
          <Button
            severity="secondary"
            icon="pi pi-refresh"
            label="Refresh Stats"
            :loading="statsLoading"
            @click="fetchStats"
          />
        </div>
      </div>

      <TabView v-model:activeIndex="activeTab" @tab-change="onTabChange" class="mb-4">
        <TabPanel>
          <template #header>
            <i class="pi pi-th-large mr-2"></i>
            <span>Overview</span>
          </template>

          <div class="grid mb-4">
            <div v-for="card in kpiCards" :key="card.title" class="col-12 sm:col-6 lg:col-3">
              <div class="surface-card p-4 border-round-xl shadow-2">
                <div class="flex align-items-center justify-content-between mb-3">
                  <span class="text-sm font-semibold uppercase" style="color: var(--an-text-muted);">{{ card.title }}</span>
                  <i :class="[card.icon, card.color]" style="font-size: 1.25rem;"></i>
                </div>
                <div class="text-3xl font-bold mb-1">{{ card.value ?? '—' }}</div>
                <div class="text-sm" style="color: var(--an-text-subtle);">{{ card.sub }}</div>
              </div>
            </div>
          </div>

          <div class="surface-card p-5 border-round-xl shadow-2 mb-4">
            <div class="text-lg font-semibold mb-4 border-bottom-1 pb-3" style="border-color: var(--an-border-dark);">
              <i class="pi pi-chart-bar mr-2"></i>
              Plan Distribution
            </div>
            <div class="grid text-center">
              <div v-for="plan in planChartData" :key="plan.label" class="col-6 sm:col-3 p-4">
                <div class="text-4xl font-bold mb-2">{{ plan.count }}</div>
                <Tag :severity="planColor(plan.label)" :value="plan.label" class="text-uppercase" style="letter-spacing: 0.05em;" />
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header>
            <i class="pi pi-building mr-2"></i>
            <span>Organizations</span>
            <Tag v-if="orgsTotal" class="ml-2" severity="secondary" rounded>{{ orgsTotal }}</Tag>
          </template>

          <div class="filter-bar surface-card border-round-lg shadow-1 p-3 mb-4 flex gap-3 align-items-center flex-wrap">
            <div class="an-search-wrapper" style="width: 250px;">
              <i class="pi pi-search an-search-icon" />
              <InputText
                v-model="orgSearch"
                placeholder="Search organizations…"
                class="an-search-input"
                @update:model-value="orgPage = 1; fetchOrgs()"
              />
            </div>
            <Select
              v-model="orgPlanFilter"
              :options="[{label: 'All Plans', value: ''}, {label: 'Free', value: 'free'}, {label: 'Starter', value: 'starter'}, {label: 'Pro', value: 'pro'}, {label: 'Enterprise', value: 'enterprise'}]"
              optionLabel="label"
              optionValue="value"
              placeholder="Plan"
              @update:model-value="orgPage = 1; fetchOrgs()"
              style="width: 160px;"
            />
            <div style="margin-left: auto;">
              <Button icon="pi pi-download" label="Export CSV" severity="secondary" size="small" @click="exportCsv('organizations')" />
            </div>
          </div>

          <div class="table-wrapper surface-card border-round-xl shadow-2">
            <table class="an-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Enterprise Trial</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in orgs" :key="item._id" class="data-row">
                  <td>
                    <div class="font-bold">{{ item.name }}</div>
                    <div class="text-xs" style="color: var(--an-text-subtle);">{{ item.slug }}</div>
                  </td>
                  <td>
                    <Select
                      v-model="item.plan"
                      :options="['free', 'starter', 'pro', 'enterprise']"
                      @update:model-value="(val: string) => updateOrgPlan(item, val)"
                      class="w-full"
                      style="max-width: 120px;"
                    >
                      <template #value="slotProps">
                        <Tag :severity="planColor(slotProps.value)" :value="slotProps.value" />
                      </template>
                      <template #option="slotProps">
                        <Tag :severity="planColor(slotProps.option)" :value="slotProps.option" />
                      </template>
                    </Select>
                  </td>
                  <td>
                    <div class="flex flex-column gap-1 align-items-start">
                      <Tag
                        :value="hasActiveEnterpriseAccess(item)
                          ? `Enterprise until ${formatDate(item.billing?.accessOverride?.expiresAt)}`
                          : item.billingStatus === 'trialing'
                            ? `Trial until ${formatDate(item.billing?.trialEndsAt)}`
                            : item.billingStatus"
                        :severity="hasActiveEnterpriseAccess(item) || item.billingStatus === 'trialing' ? 'success' : item.billingStatus === 'active' ? 'info' : 'secondary'"
                      />
                      <small v-if="hasActiveEnterpriseAccess(item)" style="color: var(--an-text-subtle);">
                        Billing remains {{ item.billingStatus }} / {{ item.plan }}
                      </small>
                      <Button
                        :label="hasActiveEnterpriseAccess(item) ? 'Extend 30 days' : 'Unlock 30 days'"
                        icon="pi pi-gift"
                        size="small"
                        text
                        :loading="grantingTrial === item._id"
                        @click="grantEnterpriseTrial(item)"
                      />
                      <Button
                        v-if="hasActiveEnterpriseAccess(item)"
                        label="Revoke"
                        icon="pi pi-times"
                        severity="danger"
                        size="small"
                        text
                        :loading="grantingTrial === item._id"
                        @click="revokeEnterpriseAccess(item)"
                      />
                    </div>
                  </td>
                  <td><Tag severity="secondary" rounded>{{ item.userCount }}</Tag></td>
                  <td>
                    <div class="flex align-items-center">
                      <input type="checkbox" :checked="item.isActive" @change="toggleOrgActive(item)" style="cursor: pointer;" />
                      <span class="ml-2 text-sm">{{ item.isActive ? 'Active' : 'Suspended' }}</span>
                    </div>
                  </td>
                  <td><span class="text-sm" style="color: var(--an-text-subtle);">{{ formatDate(item.createdAt) }}</span></td>
                  <td>
                    <div class="flex gap-1">
                      <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openOrgNotes(item)" v-tooltip.top="'Notes'" />
                    </div>
                  </td>
                </tr>
                <tr v-if="orgs.length === 0">
                  <td colspan="7" class="text-center p-5" style="color: var(--an-text-muted);">
                    <i class="pi pi-building mb-2" style="font-size: 2rem;"></i>
                    <p>No organizations found.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header>
            <i class="pi pi-users mr-2"></i>
            <span>Users</span>
            <Tag v-if="usersTotal" class="ml-2" severity="secondary" rounded>{{ usersTotal }}</Tag>
          </template>

          <div class="filter-bar surface-card border-round-lg shadow-1 p-3 mb-4 flex gap-3 align-items-center flex-wrap">
            <div class="an-search-wrapper" style="width: 250px;">
              <i class="pi pi-search an-search-icon" />
              <InputText
                v-model="userSearch"
                placeholder="Search users…"
                class="an-search-input"
                @update:model-value="userPage = 1; fetchUsers()"
              />
            </div>
            <Select
              v-model="userRoleFilter"
              :options="[{label: 'All Roles', value: ''}, {label: 'Admin', value: 'admin'}, {label: 'Manager', value: 'manager'}, {label: 'Employee', value: 'employee'}, {label: 'Viewer', value: 'viewer'}]"
              optionLabel="label"
              optionValue="value"
              placeholder="Role"
              @update:model-value="userPage = 1; fetchUsers()"
              style="width: 140px;"
            />
            <Select
              v-model="userActiveFilter"
              :options="[{label: 'All Status', value: null}, {label: 'Active', value: true}, {label: 'Inactive', value: false}]"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              @update:model-value="userPage = 1; fetchUsers()"
              style="width: 140px;"
            />
            <div style="margin-left: auto;">
              <Button icon="pi pi-download" label="Export CSV" severity="secondary" size="small" @click="exportCsv('users')" />
            </div>
          </div>

          <div class="table-wrapper surface-card border-round-xl shadow-2">
            <table class="an-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in users" :key="item._id" class="data-row">
                  <td>
                    <div class="font-bold">{{ item.firstName }} {{ item.lastName }}</div>
                    <div class="text-xs" style="color: var(--an-text-subtle);">{{ item.email }}</div>
                  </td>
                  <td>
                    <div class="text-sm">{{ item.companyName }}</div>
                    <Tag v-if="item.orgId?.plan" :severity="planColor(item.orgId.plan)" :value="item.orgId.plan" class="mt-1 text-xs" />
                  </td>
                  <td>
                    <Select
                      v-model="item.role"
                      :options="['superAdmin', 'admin', 'manager', 'employee', 'viewer']"
                      @update:model-value="(val: string) => updateUserRole(item, val)"
                      class="w-full"
                      style="max-width: 120px;"
                    >
                      <template #value="slotProps">
                        <Tag :severity="roleColor(slotProps.value)" :value="slotProps.value" />
                      </template>
                      <template #option="slotProps">
                        <Tag :severity="roleColor(slotProps.option)" :value="slotProps.option" />
                      </template>
                    </Select>
                  </td>
                  <td>
                    <div class="flex align-items-center">
                      <input type="checkbox" :checked="item.isActive" @change="toggleUserActive(item)" style="cursor: pointer;" />
                      <span class="ml-2 text-sm">{{ item.isActive ? 'Active' : 'Inactive' }}</span>
                    </div>
                  </td>
                  <td><span class="text-sm" style="color: var(--an-text-subtle);">{{ formatDate(item.lastLoginAt) }}</span></td>
                  <td><span class="text-sm" style="color: var(--an-text-subtle);">{{ formatDate(item.createdAt) }}</span></td>
                </tr>
                <tr v-if="users.length === 0">
                  <td colspan="6" class="text-center p-5" style="color: var(--an-text-muted);">
                    <i class="pi pi-users mb-2" style="font-size: 2rem;"></i>
                    <p>No users found.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header>
            <i class="pi pi-server mr-2"></i>
            <span>System</span>
          </template>

          <div v-if="systemLoading" class="text-center p-6"><i class="pi pi-spin pi-spinner text-3xl"></i></div>
          <div v-else-if="systemHealth" class="flex flex-column gap-4">
            <div class="grid">
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="flex justify-content-between align-items-center mb-2">
                    <span class="text-sm font-semibold" style="color: var(--an-text-muted);">STATUS</span>
                    <i :class="systemHealth.status === 'ok' ? 'pi pi-check-circle text-green-400' : 'pi pi-exclamation-triangle text-orange-400'" style="font-size: 1.5rem;"></i>
                  </div>
                  <div class="text-2xl font-bold" :style="{ color: systemHealth.status === 'ok' ? '#4ade80' : '#fb923c' }">{{ systemHealth.status.toUpperCase() }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">DB: {{ systemHealth.db.status }}</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="flex justify-content-between align-items-center mb-2">
                    <span class="text-sm font-semibold" style="color: var(--an-text-muted);">UPTIME</span>
                    <i class="pi pi-clock text-blue-400" style="font-size: 1.5rem;"></i>
                  </div>
                  <div class="text-2xl font-bold">{{ systemHealth.uptimeFormatted }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">{{ systemHealth.uptime.toLocaleString() }}s total</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="flex justify-content-between align-items-center mb-2">
                    <span class="text-sm font-semibold" style="color: var(--an-text-muted);">HEAP USAGE</span>
                    <i class="pi pi-chart-bar text-purple-400" style="font-size: 1.5rem;"></i>
                  </div>
                  <div class="text-2xl font-bold">{{ heapPercent }}%</div>
                  <ProgressBar :value="heapPercent" :showValue="false" style="height: 6px;" class="mt-2" />
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">{{ systemHealth.memory.heapUsed }} / {{ systemHealth.memory.heapTotal }}</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="flex justify-content-between align-items-center mb-2">
                    <span class="text-sm font-semibold" style="color: var(--an-text-muted);">RSS MEMORY</span>
                    <i class="pi pi-database text-cyan-400" style="font-size: 1.5rem;"></i>
                  </div>
                  <div class="text-2xl font-bold">{{ systemHealth.memory.rss }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">External: {{ systemHealth.memory.external }}</div>
                </div>
              </div>
            </div>

            <div v-if="dbStats" class="surface-card border-round-xl shadow-2">
              <div class="p-4 border-bottom-1" style="border-color: var(--an-border-dark);">
                <div class="flex justify-content-between align-items-center">
                  <div>
                    <div class="text-lg font-semibold"><i class="pi pi-database mr-2"></i>Database Collections</div>
                    <div class="text-xs mt-1" style="color: var(--an-text-subtle);">{{ dbStats.dbName }} — {{ dbStats.totalCollections }} collections, {{ dbStats.totalDocuments.toLocaleString() }} docs, {{ dbStats.totalStorageFormatted }}</div>
                  </div>
                  <Button icon="pi pi-refresh" text rounded severity="secondary" @click="fetchSystemHealth" />
                </div>
              </div>
              <div class="table-wrapper">
                <table class="an-table">
                  <thead><tr><th>Collection</th><th>Documents</th><th>Storage</th><th>Indexes</th></tr></thead>
                  <tbody>
                    <tr v-for="col in dbStats.collections" :key="col.name" class="data-row">
                      <td class="font-mono text-sm">{{ col.name }}</td>
                      <td>{{ col.count.toLocaleString() }}</td>
                      <td>{{ col.storageSizeFormatted }}</td>
                      <td>{{ col.indexCount }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-else class="text-center p-6" style="color: var(--an-text-muted);">
            <i class="pi pi-server mb-2" style="font-size: 2rem;"></i>
            <p>System health data will load when this tab is activated.</p>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header>
            <i class="pi pi-wallet mr-2"></i>
            <span>Billing</span>
          </template>

          <div v-if="billingLoading" class="text-center p-6"><i class="pi pi-spin pi-spinner text-3xl"></i></div>
          <div v-else-if="revenue" class="flex flex-column gap-4">
            <div class="grid">
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="text-sm font-semibold mb-2" style="color: var(--an-text-muted);">MRR</div>
                  <div class="text-2xl font-bold" style="color: #4ade80;">{{ revenue.mrrFormatted }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">ARR: {{ revenue.arrFormatted }}</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="text-sm font-semibold mb-2" style="color: var(--an-text-muted);">ACTIVE SUBS</div>
                  <div class="text-2xl font-bold">{{ revenue.activeSubscriptions }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">{{ revenue.trialingOrgs }} trialing</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="text-sm font-semibold mb-2" style="color: var(--an-text-muted);">PAST DUE</div>
                  <div class="text-2xl font-bold" :style="{ color: revenue.pastDueOrgs > 0 ? '#f87171' : '#4ade80' }">{{ revenue.pastDueOrgs }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">needs attention</div>
                </div>
              </div>
              <div class="col-12 md:col-3">
                <div class="surface-card p-4 border-round-xl shadow-2">
                  <div class="text-sm font-semibold mb-2" style="color: var(--an-text-muted);">30-DAY CHURN</div>
                  <div class="text-2xl font-bold" :style="{ color: revenue.churnedLast30Days > 0 ? '#fb923c' : '#4ade80' }">{{ revenue.churnedLast30Days }}</div>
                  <div class="text-xs mt-1" style="color: var(--an-text-subtle);">cancellations</div>
                </div>
              </div>
            </div>

            <div class="surface-card p-5 border-round-xl shadow-2">
              <h3 class="text-lg font-semibold mb-3"><i class="pi pi-chart-bar mr-2"></i>Revenue by Plan</h3>
              <div class="grid">
                <div v-for="(data, plan) in revenue.revenueByPlan" :key="plan" class="col-12 md:col-4">
                  <div class="p-3 border-round-lg border-1" style="border-color: var(--an-border-dark);">
                    <div class="flex justify-content-between align-items-center mb-2">
                      <Tag :severity="planColor(plan)" :value="plan" />
                      <span class="font-bold" style="color: #4ade80;">€{{ (data.mrr / 100).toFixed(2) }}/mo</span>
                    </div>
                    <div class="text-sm" style="color: var(--an-text-subtle);">{{ data.count }} organizations</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="trials.length > 0" class="surface-card border-round-xl shadow-2">
              <div class="p-4 border-bottom-1" style="border-color: var(--an-border-dark);">
                <div class="text-lg font-semibold"><i class="pi pi-hourglass mr-2"></i>Active Trials ({{ trials.length }})</div>
              </div>
              <div class="table-wrapper">
                <table class="an-table">
                  <thead><tr><th>Organization</th><th>Plan</th><th>Days Left</th><th>Expires</th></tr></thead>
                  <tbody>
                    <tr v-for="t in trials" :key="t._id" class="data-row">
                      <td>
                        <div class="font-bold">{{ t.name }}</div>
                        <div class="text-xs" style="color: var(--an-text-subtle);">{{ t.slug }}</div>
                      </td>
                      <td><Tag :severity="planColor(t.plan)" :value="t.plan" /></td>
                      <td>
                        <Tag :severity="t.isExpiringSoon ? 'danger' : 'info'" :value="t.daysRemaining + 'd'" />
                      </td>
                      <td class="text-sm" style="color: var(--an-text-subtle);">{{ formatDate(t.trialEndsAt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-else class="text-center p-6" style="color: var(--an-text-muted);">
            <i class="pi pi-wallet mb-2" style="font-size: 2rem;"></i>
            <p>Billing data will load when this tab is activated.</p>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header>
            <i class="pi pi-bell mr-2"></i>
            <span>Maintainer Alerts</span>
          </template>

          <div class="grid">
            <div class="col-12 md:col-6">
              <div class="surface-card p-5 border-round-xl shadow-2 mb-4">
                <div class="flex align-items-center gap-2 mb-4 border-bottom-1 pb-3" style="border-color: var(--an-border-dark);">
                  <i class="pi pi-slack" style="font-size: 1.5rem; color: #E01E5A;"></i>
                  <div class="text-lg font-semibold">Slack Connect</div>
                </div>

                <div v-if="notifConfig" class="flex flex-column gap-3">
                  <p class="text-sm m-0" style="color: var(--an-text-subtle);">
                    The platform maintainer notifier will send alerts for new organization sign-ups and system events to the configured Slack webhook.
                  </p>
                  <div class="mt-2">
                    <label class="block text-sm font-semibold mb-1" style="color: var(--an-text-muted);">Maintainer Email</label>
                    <div class="p-3 border-round bg-black-alpha-20 border-1" style="border-color: var(--an-border-dark);">{{ notifConfig.maintainerEmail || 'Not configured' }}</div>
                  </div>
                  <div>
                    <label class="block text-sm font-semibold mb-1" style="color: var(--an-text-muted);">Webhook URL Status</label>
                    <div class="flex align-items-center px-3 py-2 border-round border-1" :class="notifConfig.webhookUrl ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'">
                      <i :class="notifConfig.webhookUrl ? 'pi pi-check text-green-300 mr-2' : 'pi pi-times text-red-300 mr-2'"></i>
                      <span :class="notifConfig.webhookUrl ? 'text-green-100' : 'text-red-100'">
                        {{ notifConfig.webhookUrl ? 'Configured and active' : 'Missing configuration' }}
                      </span>
                    </div>
                  </div>
                  <div class="mt-4 pt-3 flex border-top-1" style="border-color: var(--an-border-dark);">
                    <Button
                      severity="primary"
                      icon="pi pi-send"
                      label="Send Test Alert"
                      :loading="testLoading"
                      @click="sendTestNotification"
                    />
                  </div>

                  <Message v-if="testResult" :severity="testResult.success ? 'success' : 'error'" class="mt-3" closable>
                    <div class="font-bold">{{ testResult.success ? 'Test Placed' : 'Test Failed' }}</div>
                    <div class="text-sm mt-1">{{ testResult.message || testResult.error }}</div>
                  </Message>
                </div>
                <div v-else class="text-center p-3">
                  <i class="pi pi-spin pi-spinner text-2xl"></i>
                </div>
              </div>
            </div>

            <div class="col-12 md:col-6">
              <div class="surface-card p-5 border-round-xl shadow-2">
                <h3 class="text-lg font-semibold mb-3"><i class="pi pi-info-circle mr-2"></i>Environment Details</h3>
                <p class="text-sm mb-3" style="color: var(--an-text-subtle);">
                  To use the maintainer notifications, the following environment variables must be defined on the production server (Coolify):
                </p>
                <div class="p-4 border-round bg-black-alpha-30 border-1 font-mono text-sm" style="border-color: var(--an-border-dark);">
                  <div class="mb-2"><span class="text-purple-400">MAINTAINER_EMAIL</span>=alexander...</div>
                  <div class="mb-2"><span class="text-purple-400">MAINTAINER_WEBHOOK_URL</span>=https://hooks.slack.com/services/...</div>
                  <div><span class="text-purple-400">MAINTAINER_WEBHOOK_SECRET</span>=your-hmac-secret-if-using-generic</div>
                </div>
                <div class="mt-3 p-3 border-round bg-blue-900 border-1 border-blue-500 text-blue-100 text-sm">
                  <i class="pi pi-exclamation-triangle mr-2"></i>
                  <span>Note: Do not expose webhook secrets or URLs to frontend clients.</span>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>
      </TabView>

      <Dialog v-model:visible="orgEditDialog" header="Organization Notes" :style="{ width: '500px' }" modal>
        <template v-if="editingOrg">
          <div class="mb-3 font-semibold">{{ editingOrg.name }}</div>
          <div class="flex flex-column gap-2 mb-3">
            <textarea
              v-model="editingOrg.notes"
              class="w-full p-3 border-round bg-black-alpha-20 border-1"
              style="border-color: var(--an-border-dark); color: var(--an-text-primary); resize: vertical; min-height: 150px; font-family: inherit;"
              placeholder="Internal notes about this organization..."
            ></textarea>
          </div>
          <div class="text-right">
            <Button label="Cancel" text severity="secondary" @click="orgEditDialog = false" class="mr-2" />
            <Button label="Save Notes" severity="primary" :loading="orgSaving" @click="saveOrgNotes" />
          </div>
        </template>
      </Dialog>

    </div>
  </div>
</template>
