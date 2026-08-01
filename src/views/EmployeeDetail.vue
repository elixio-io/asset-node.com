<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import { extractApiError } from '../lib/extractApiError'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'
import ChangeHistory from '../components/ChangeHistory.vue'
import QuickCreateSelect from '../components/QuickCreateSelect.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

interface NamedRef { _id: string; name: string; color?: string; icon?: string }
interface EmployeeDetail {
  _id: string; firstName: string; lastName: string; email: string
  departmentId?: NamedRef | null; locationId?: NamedRef | null
  jobTitle?: string; phone?: string
  managerId?: { _id: string; firstName: string; lastName: string; email?: string } | null
  userId?: { _id: string; email: string; role: string } | null
  isActive: boolean; startDate?: string; endDate?: string
  createdAt: string; updatedAt?: string; notes?: string
  _related: {
    hardware: any[]; peripherals: any[]; assignments: any[]
    licenseSeats: any[]; consumableCheckouts: any[]
  }
}

const employee = ref<EmployeeDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref(0)

const editing = ref(false)
const saving = ref(false)
const editForm = ref<any>({})
const departments = ref<NamedRef[]>([])
const locations = ref<NamedRef[]>([])
const managerOptions = ref<{ label: string; value: string }[]>([])

const historyVisible = ref(false)
const showMfaResetDialog = ref(false)
const mfaResetPassword = ref('')
const mfaResetCode = ref('')
const mfaResetStepUpRequired = ref(false)
const mfaResetLoading = ref(false)
const securityNotice = ref<string | null>(null)

const fullName = computed(() => employee.value ? `${employee.value.firstName} ${employee.value.lastName}` : '')
const initials = computed(() => {
  if (!employee.value) return ''
  return (employee.value.firstName[0] + employee.value.lastName[0]).toUpperCase()
})
const canResetMfa = computed(() => Boolean(
  authStore.isAdmin
  && employee.value?.userId?._id
  && employee.value.userId._id !== authStore.user?.id
))

const totalAssetValue = computed(() => {
  if (!employee.value?._related) return 0
  const hwValue = employee.value._related.hardware.reduce((s, h) => s + (h.purchasePrice || 0), 0)
  const licValue = employee.value._related.licenseSeats.reduce((s, l) => {
    return s + (l.costPerSeat || 0) * (l.seats?.length || 0)
  }, 0)
  return hwValue + licValue
})

const assetCounts = computed(() => {
  const r = employee.value?._related
  if (!r) return { hardware: 0, peripherals: 0, licenses: 0, consumables: 0 }
  return {
    hardware: r.hardware.length,
    peripherals: r.peripherals.length,
    licenses: r.licenseSeats.length,
    consumables: r.consumableCheckouts.reduce((s: number, c: any) => s + (c.checkouts?.length || 0), 0)
  }
})

async function loadEmployee() {
  loading.value = true
  error.value = null
  try {
    const { data } = await api.get(`/employees/${route.params.id}`)
    employee.value = data
  } catch (e: any) {
    error.value = extractApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadLookups() {
  const [dRes, lRes, eRes] = await Promise.all([
    api.get('/departments'), api.get('/locations'), api.get('/employees')
  ])
  departments.value = dRes.data
  locations.value = lRes.data
  managerOptions.value = eRes.data
    .filter((e: any) => e._id !== route.params.id)
    .map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
}

onMounted(() => { loadEmployee(); loadLookups() })

function startEdit() {
  if (!employee.value) return
  editForm.value = {
    firstName: employee.value.firstName,
    lastName: employee.value.lastName,
    email: employee.value.email,
    jobTitle: employee.value.jobTitle || '',
    phone: employee.value.phone || '',
    departmentId: employee.value.departmentId?._id || '',
    locationId: employee.value.locationId?._id || '',
    managerId: employee.value.managerId?._id || '',
    startDate: employee.value.startDate ? new Date(employee.value.startDate) : null,
    endDate: employee.value.endDate ? new Date(employee.value.endDate) : null,
    notes: employee.value.notes || ''
  }
  editing.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    const payload = { ...editForm.value }
    if (payload.startDate instanceof Date) payload.startDate = payload.startDate.toISOString()
    if (payload.endDate instanceof Date) payload.endDate = payload.endDate.toISOString()
    if (!payload.departmentId) payload.departmentId = null
    if (!payload.locationId) payload.locationId = null
    if (!payload.managerId) payload.managerId = null
    await api.put(`/employees/${route.params.id}`, payload)
    editing.value = false
    await loadEmployee()
  } catch (e: any) {
    error.value = extractApiError(e)
  } finally {
    saving.value = false
  }
}

async function resetEmployeeMfa() {
  if (!employee.value?.userId?._id) return
  mfaResetLoading.value = true
  error.value = null
  try {
    const resetEndpoint = authStore.isSuperAdmin
      ? `/super-admin/users/${employee.value.userId._id}/mfa/reset`
      : `/auth/admin/users/${employee.value.userId._id}/mfa/reset`
    await api.post(resetEndpoint, {
      ...(authStore.user?.ssoOnly ? {} : { currentPassword: mfaResetPassword.value }),
      ...(mfaResetStepUpRequired.value && { code: mfaResetCode.value })
    })
    showMfaResetDialog.value = false
    mfaResetPassword.value = ''
    mfaResetCode.value = ''
    securityNotice.value = 'Two-factor authentication was reset. All of the user\'s existing sessions were revoked immediately.'
  } catch (e: any) {
    if (e?.response?.data?.code === 'MFA_STEP_UP_REQUIRED') {
      mfaResetStepUpRequired.value = true
    }
    error.value = extractApiError(e)
  } finally {
    mfaResetLoading.value = false
  }
}

async function openMfaResetDialog() {
  error.value = null
  try {
    const { data } = await api.get('/auth/security')
    mfaResetStepUpRequired.value = Boolean(data.stepUpRequired)
  } catch {
    mfaResetStepUpRequired.value = false
  }
  showMfaResetDialog.value = true
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString('de-DE') : '—'
}
function fmtCurrency(v: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v)
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner">

      <div v-if="loading" class="ed-loading">
        <ProgressSpinner style="width: 48px; height: 48px;" />
      </div>

      <div v-else-if="error && !employee" class="ed-loading">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--an-red);" />
        <p>{{ error }}</p>
        <Button :label="t('employees.detail.backToEmployees')" severity="secondary" size="small" @click="router.push('/employees')" />
      </div>

      <template v-else-if="employee">
        <div class="view-header">
          <div class="flex align-items-center gap-3">
            <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.push('/employees')" />
            <div class="ed-avatar-lg"><span>{{ initials }}</span></div>
            <div>
              <h1 class="text-xl font-bold" style="margin: 0;">{{ fullName }}</h1>
              <p class="mt-1" style="font-size: 14px; color: var(--an-text-subtle); margin: 4px 0 0;">
                {{ employee.jobTitle || '—' }}
                <span v-if="employee.departmentId"> · {{ employee.departmentId.name }}</span>
              </p>
            </div>
            <Tag :value="employee.isActive ? $t('common.active') : $t('common.inactive')"
                 :severity="employee.isActive ? 'success' : 'danger'" style="margin-left: 8px;" />
          </div>
          <div class="flex gap-2">
            <Button icon="pi pi-history" :label="$t('common.history')" severity="secondary" size="small" outlined @click="historyVisible = true" />
            <Button v-if="canResetMfa" icon="pi pi-shield" label="Reset 2FA" severity="warning" size="small" outlined @click="openMfaResetDialog" />
            <Button v-if="!editing" icon="pi pi-pencil" :label="t('employees.detail.editProfile')" size="small" @click="startEdit" />
          </div>
        </div>

        <Message v-if="error" severity="error" :closable="true" @close="error = null" class="mb-3">{{ error }}</Message>
        <Message v-if="securityNotice" severity="success" :closable="true" @close="securityNotice = null" class="mb-3">{{ securityNotice }}</Message>

        <div class="ed-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label"><i class="pi pi-desktop" style="margin-right: 4px;" /> {{ $t('employees.detail.hardware') }}</div>
            <div class="kpi-value">{{ assetCounts.hardware }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="pi pi-tablet" style="margin-right: 4px;" /> {{ $t('employees.detail.peripherals') }}</div>
            <div class="kpi-value">{{ assetCounts.peripherals }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="pi pi-key" style="margin-right: 4px;" /> {{ $t('employees.detail.licenses') }}</div>
            <div class="kpi-value">{{ assetCounts.licenses }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="pi pi-box" style="margin-right: 4px;" /> {{ $t('employees.detail.consumables') }}</div>
            <div class="kpi-value">{{ assetCounts.consumables }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><i class="pi pi-wallet" style="margin-right: 4px;" /> {{ $t('employees.detail.totalAssetValue') }}</div>
            <div class="kpi-value" style="font-size: 1.25rem;">{{ fmtCurrency(totalAssetValue) }}</div>
          </div>
        </div>

        <TabView v-model:activeIndex="activeTab" class="ed-tabs">
          <TabPanel :header="$t('employees.detail.overview')">
            <div class="pd-section">
              <h2 class="pd-section-title"><i class="pi pi-user" /> {{ $t('employees.detail.profile') }}</h2>

              <div v-if="!editing" class="ed-profile-grid">
                <div class="ed-field"><span class="ed-field-label">{{ $t('common.email') }}</span><span>{{ employee.email }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('common.phone') }}</span><span>{{ employee.phone || '—' }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('common.department') }}</span><span>{{ employee.departmentId?.name || '—' }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('common.location') }}</span><span>{{ employee.locationId?.name || '—' }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('employees.manager') }}</span><span>{{ employee.managerId ? `${employee.managerId.firstName} ${employee.managerId.lastName}` : '—' }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('employees.startDate') }}</span><span>{{ fmtDate(employee.startDate) }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('employees.endDate') }}</span><span>{{ fmtDate(employee.endDate) }}</span></div>
                <div class="ed-field"><span class="ed-field-label">{{ $t('common.createdAt') }}</span><span>{{ fmtDate(employee.createdAt) }}</span></div>
              </div>

              <div v-else class="ed-edit-grid">
                <div class="ed-edit-field">
                  <label>{{ $t('employees.firstName') }}</label>
                  <InputText v-model="editForm.firstName" class="w-full" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('employees.lastName') }}</label>
                  <InputText v-model="editForm.lastName" class="w-full" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('common.email') }}</label>
                  <InputText v-model="editForm.email" class="w-full" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('employees.jobTitle') }}</label>
                  <InputText v-model="editForm.jobTitle" class="w-full" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('common.phone') }}</label>
                  <InputText v-model="editForm.phone" class="w-full" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('common.department') }}</label>
                  <QuickCreateSelect v-model="editForm.departmentId" :options="departments" entityType="departments" :placeholder="$t('common.select')" />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('common.location') }}</label>
                  <Select v-model="editForm.locationId" :options="locations" optionLabel="name" optionValue="_id" :placeholder="$t('common.select')" class="w-full" showClear />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('employees.manager') }}</label>
                  <Select v-model="editForm.managerId" :options="managerOptions" optionLabel="label" optionValue="value" :placeholder="$t('common.select')" class="w-full" showClear />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('employees.startDate') }}</label>
                  <DatePicker v-model="editForm.startDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
                </div>
                <div class="ed-edit-field">
                  <label>{{ $t('employees.endDate') }}</label>
                  <DatePicker v-model="editForm.endDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
                </div>
                <div class="ed-edit-actions">
                  <Button :label="$t('employees.detail.cancelEdit')" severity="secondary" size="small" @click="editing = false" />
                  <Button :label="$t('employees.detail.saveProfile')" size="small" :loading="saving" @click="saveEdit" />
                </div>
              </div>
            </div>

            <div class="pd-section">
              <h2 class="pd-section-title">
                <i class="pi pi-history" />
                {{ $t('employees.detail.assignmentHistory') }}
                <span class="pd-count-badge">{{ employee._related.assignments.length }}</span>
              </h2>
              <div v-if="!employee._related.assignments.length" class="empty-state">
                <i class="pi pi-inbox" style="font-size: 2rem;" /><p>{{ $t('employees.detail.noHistory') }}</p>
              </div>
              <table v-else class="an-table">
                <thead><tr>
                  <th>{{ $t('common.hardware') }}</th>
                  <th>{{ $t('common.status') }}</th>
                  <th>{{ $t('common.date') }}</th>
                </tr></thead>
                <tbody>
                  <tr v-for="a in employee._related.assignments" :key="a._id" class="data-row">
                    <td>
                      <span v-if="a.hardware">{{ a.hardware.model }} <span style="color:var(--an-text-muted);font-size:12px;">{{ a.hardware.serialNumber }}</span></span>
                      <span v-else style="color:var(--an-text-muted);">—</span>
                    </td>
                    <td><Tag :value="a.status" :severity="a.status === 'active' ? 'success' : a.status === 'returned' ? 'info' : 'warn'" /></td>
                    <td>{{ fmtDate(a.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabPanel>

          <TabPanel :header="`${$t('employees.detail.hardware')} (${assetCounts.hardware})`">
            <div v-if="!employee._related.hardware.length" class="empty-state">
              <i class="pi pi-desktop" style="font-size: 2rem;" /><p>{{ $t('employees.detail.noHardware') }}</p>
            </div>
            <div v-else class="ed-asset-grid">
              <div v-for="hw in employee._related.hardware" :key="hw._id" class="pd-section card-hover" style="cursor:pointer;" @click="router.push(`/hardware`)">
                <div class="flex justify-content-between align-items-start">
                  <div>
                    <div class="font-bold">{{ hw.model }}</div>
                    <div class="pd-muted">{{ hw.serialNumber }}</div>
                  </div>
                  <Tag v-if="hw.statusId" :value="hw.statusId.name" :style="{ background: hw.statusId.color || 'var(--an-border-dark)', color: '#fff' }" />
                </div>
                <div class="ed-hw-meta mt-3">
                  <span v-if="hw.manufacturerId"><i class="pi pi-building" /> {{ hw.manufacturerId.name }}</span>
                  <span v-if="hw.categoryId"><i class="pi pi-tag" /> {{ hw.categoryId.name }}</span>
                  <span v-if="hw.locationId"><i class="pi pi-map-marker" /> {{ hw.locationId.name }}</span>
                  <span v-if="hw.purchasePrice"><i class="pi pi-wallet" /> {{ fmtCurrency(hw.purchasePrice) }}</span>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel :header="`${$t('employees.detail.peripherals')} (${assetCounts.peripherals})`">
            <div v-if="!employee._related.peripherals.length" class="empty-state">
              <i class="pi pi-tablet" style="font-size: 2rem;" /><p>{{ $t('employees.detail.noPeripherals') }}</p>
            </div>
            <div v-else class="ed-asset-grid">
              <div v-for="p in employee._related.peripherals" :key="p._id" class="pd-section card-hover">
                <div class="flex justify-content-between align-items-start">
                  <div>
                    <div class="font-bold">{{ p.model }}</div>
                    <div class="pd-muted">{{ p.serialNumber }}</div>
                  </div>
                  <Tag v-if="p.statusId" :value="p.statusId.name" :style="{ background: p.statusId.color || 'var(--an-border-dark)', color: '#fff' }" />
                </div>
                <div class="ed-hw-meta mt-3">
                  <span v-if="p.manufacturerId"><i class="pi pi-building" /> {{ p.manufacturerId.name }}</span>
                  <span v-if="p.categoryId"><i class="pi pi-tag" /> {{ p.categoryId.name }}</span>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel :header="`${$t('employees.detail.licenses')} (${assetCounts.licenses})`">
            <div v-if="!employee._related.licenseSeats.length" class="empty-state">
              <i class="pi pi-key" style="font-size: 2rem;" /><p>{{ $t('employees.detail.noLicenses') }}</p>
            </div>
            <table v-else class="an-table">
              <thead><tr>
                <th>{{ $t('common.name') }}</th>
                <th>{{ $t('licenses.vendor') }}</th>
                <th>{{ $t('common.type') }}</th>
                <th>{{ $t('common.costPerSeat') }}</th>
                <th>{{ $t('licenses.expiryDate') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="lic in employee._related.licenseSeats" :key="lic._id" class="data-row">
                  <td class="font-bold">{{ lic.name }}</td>
                  <td>{{ lic.publisher || '—' }}</td>
                  <td><Tag :value="lic.licenseType" severity="info" /></td>
                  <td>{{ fmtCurrency(lic.costPerSeat || 0, lic.currency) }}</td>
                  <td>{{ fmtDate(lic.expirationDate) }}</td>
                </tr>
              </tbody>
            </table>
          </TabPanel>

          <TabPanel :header="`${$t('employees.detail.consumables')} (${assetCounts.consumables})`">
            <div v-if="!employee._related.consumableCheckouts.length" class="empty-state">
              <i class="pi pi-box" style="font-size: 2rem;" /><p>{{ $t('employees.detail.noConsumables') }}</p>
            </div>
            <table v-else class="an-table">
              <thead><tr>
                <th>{{ $t('common.name') }}</th>
                <th>{{ $t('common.quantity') }}</th>
                <th>{{ $t('common.date') }}</th>
                <th>{{ $t('common.unitCost') }}</th>
              </tr></thead>
              <tbody>
                <template v-for="con in employee._related.consumableCheckouts" :key="con._id">
                  <tr v-for="co in con.checkouts" :key="co._id" class="data-row">
                    <td class="font-bold">{{ con.name }}</td>
                    <td>{{ co.quantity }}</td>
                    <td>{{ fmtDate(co.checkedOutAt) }}</td>
                    <td>{{ fmtCurrency(con.unitCost || 0, con.currency) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </TabPanel>
        </TabView>
      </template>

      <ChangeHistory v-if="historyVisible" :entityType="'Employee'" :entityId="(route.params.id as string)" :visible="historyVisible" @update:visible="historyVisible = $event" />

      <Dialog v-model:visible="showMfaResetDialog" header="Reset two-factor authentication" modal :style="{ width: '480px' }" @hide="mfaResetPassword = ''; mfaResetCode = ''">
        <Message v-if="error" severity="error" :closable="true" @close="error = null" class="mb-3">{{ error }}</Message>
        <Message severity="warn" :closable="false" class="mb-3">
          This removes the user's authenticator secret and every recovery code. Passkeys are not removed.
        </Message>
        <p class="mb-3">
          {{ authStore.user?.ssoOnly ? 'Your SSO sign-in must be less than ten minutes old.' : 'Confirm this support action with your own administrator password.' }}
        </p>
        <InputText v-if="!authStore.user?.ssoOnly" v-model="mfaResetPassword" type="password" autocomplete="current-password" class="w-full" />
        <InputText v-if="mfaResetStepUpRequired" v-model="mfaResetCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Your authenticator code" class="w-full mt-3" />
        <template #footer>
          <Button label="Cancel" text @click="showMfaResetDialog = false; mfaResetPassword = ''; mfaResetCode = ''" />
          <Button label="Reset 2FA" severity="danger" :loading="mfaResetLoading" :disabled="(!authStore.user?.ssoOnly && !mfaResetPassword) || (mfaResetStepUpRequired && !mfaResetCode)" @click="resetEmployeeMfa" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>
.ed-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 24px; color: var(--an-text-muted); }

.ed-avatar-lg {
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--p-primary-color); color: var(--an-bg-dark);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px; flex-shrink: 0;
}

.ed-kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin-bottom: 24px;
}

.ed-tabs { margin-top: 8px; }

.ed-profile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.ed-field { display: flex; flex-direction: column; gap: 4px; }
.ed-field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--an-text-subtle); }

.ed-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.ed-edit-field { display: flex; flex-direction: column; gap: 6px; }
.ed-edit-field label { font-size: 13px; font-weight: 600; color: var(--an-text-subtle); }
.ed-edit-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; }

.ed-asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

.ed-hw-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: var(--an-text-subtle); }
.ed-hw-meta i { font-size: 12px; margin-right: 2px; }

@media (max-width: 768px) {
  .ed-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .ed-asset-grid { grid-template-columns: 1fr; }
  .ed-profile-grid { grid-template-columns: 1fr; }
  .ed-edit-grid { grid-template-columns: 1fr; }
}
</style>
