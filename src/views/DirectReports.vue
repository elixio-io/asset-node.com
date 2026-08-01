<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const { t } = useI18n()

interface DirectReport {
  employee: { _id: string; firstName: string; lastName: string; email: string; department?: string; jobTitle?: string }
  hardware: { _id: string; serialNumber: string; model: string; category: string; status: string }[]
  peripherals: { _id: string; serialNumber: string; model: string; type: string; status: string }[]
  summary: { totalHardware: number; totalPeripherals: number; activeAssignments: number; pendingReturns: number; unacknowledged: number }
}
interface TeamData {
  manager: { name: string; id: string }
  directReports: DirectReport[]
  totals: { employees: number; totalHardware: number; totalPeripherals: number; pendingReturns: number; unacknowledged: number }
}

const data = ref<TeamData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const expandedRows = ref<string[]>([])

const statusSeverity: Record<string, string> = { available: 'success', assigned: 'info', defective: 'danger', inRepair: 'warn' }

function toggleExpand(id: string) { const idx = expandedRows.value.indexOf(id); if (idx >= 0) expandedRows.value.splice(idx, 1); else expandedRows.value.push(id) }

async function fetchTeam() {
  loading.value = true; error.value = null
  try { data.value = (await api.get('/direct-reports')).data }
  catch (err: any) { error.value = err.response?.status === 404 ? t('directReports.noProfile') : t('directReports.loadError') }
  finally { loading.value = false }
}

onMounted(fetchTeam)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error && error !== $t('directReports.noProfile')" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div v-if="error === $t('directReports.noProfile')" class="an-card flex flex-column align-items-center justify-content-center text-center p-5 mt-4" style="min-height: 400px; border: 1px dashed var(--an-border-light);">
        <div class="avatar-circle mb-4" style="width: 64px; height: 64px; background: rgba(255,255,255,0.05); color: var(--an-text-subtle); font-size: 24px;">
          <i class="pi pi-users"></i>
        </div>
        <h2 class="text-xl font-bold mb-2">{{ $t('directReports.noProfile') }}</h2>
        <p style="color: var(--an-text-muted); max-width: 500px; line-height: 1.5; font-size: 14px;" class="mb-4">
          {{ $t('directReports.noProfileExplanation') }}
        </p>
      </div>

      <div v-else-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i></div>

      <template v-else-if="data">
        <div class="view-header">
          <div>
            <h1 class="text-2xl font-bold">{{ $t('directReports.title') }}</h1>
            <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('directReports.subtitle', { name: data.manager.name }) }}</p>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          <div class="kpi-card text-center"><div class="kpi-value" style="color: var(--p-primary-color);">{{ data.totals.employees }}</div><div class="kpi-label">{{ $t('directReports.employees') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color: var(--an-blue);">{{ data.totals.totalHardware }}</div><div class="kpi-label">{{ $t('directReports.totalHardware') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color: var(--an-emerald);">{{ data.totals.totalPeripherals }}</div><div class="kpi-label">{{ $t('directReports.totalPeripherals') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color: var(--an-amber);">{{ data.totals.pendingReturns }}</div><div class="kpi-label">{{ $t('directReports.pendingReturns') }}</div></div>
        </div>

        <div v-for="report in data.directReports" :key="report.employee._id" class="employee-card mb-3" @click="toggleExpand(report.employee._id)">
          <div class="flex align-items-center gap-3 p-3" style="cursor: pointer;">
            <div class="avatar-circle"><span>{{ report.employee.firstName[0] }}{{ report.employee.lastName[0] }}</span></div>
            <div class="flex-1">
              <div class="font-bold">{{ report.employee.firstName }} {{ report.employee.lastName }}</div>
              <div style="font-size: 12px; color: var(--an-text-muted);">
                {{ report.employee.jobTitle }}<span v-if="report.employee.department"> · {{ report.employee.department }}</span>
              </div>
            </div>
            <div class="flex gap-2 mr-3">
              <Tag :value="String(report.summary.totalHardware)" severity="primary" />
              <Tag :value="String(report.summary.totalPeripherals)" severity="info" />
              <Tag v-if="report.summary.pendingReturns > 0" :value="report.summary.pendingReturns + ' ' + $t('directReports.pending')" severity="warn" />
            </div>
            <i :class="expandedRows.includes(report.employee._id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
          </div>

          <div v-if="expandedRows.includes(report.employee._id)" class="p-3" style="border-top: 1px solid var(--an-border-dark);">
            <div v-if="report.hardware.length > 0" class="mb-3">
              <div class="font-bold mb-2" style="font-size: 13px;">{{ $t('directReports.hardware') }}</div>
              <Tag v-for="hw in report.hardware" :key="hw._id" :value="`${hw.model} (${hw.serialNumber})`" :severity="(statusSeverity[hw.status] as any) || 'secondary'" class="mr-2 mb-2" v-tooltip="t(`status.${hw.status}`, hw.status)" />
            </div>
            <div v-if="report.peripherals.length > 0">
              <div class="font-bold mb-2" style="font-size: 13px;">{{ $t('directReports.peripherals') }}</div>
              <Tag v-for="p in report.peripherals" :key="p._id" :value="`${p.model} (${p.type})`" :severity="(statusSeverity[p.status] as any) || 'secondary'" class="mr-2 mb-2" v-tooltip="t(`status.${p.status}`, p.status)" />
            </div>
            <div v-if="report.hardware.length === 0 && report.peripherals.length === 0" style="color: var(--an-text-muted);">{{ $t('directReports.noAssets') }}</div>
          </div>
        </div>

        <div v-if="data.directReports.length === 0" class="text-center p-5" style="color: var(--an-text-muted);">
          <i class="pi pi-users" style="font-size: 2rem;"></i>
          <div class="mt-2">{{ $t('directReports.noReports') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>

.kpi-grid { grid-template-columns: repeat(4, 1fr); }
.kpi-value { font-size: 1.75rem; }
.employee-card { border-radius: var(--radius-lg); border: 1px solid var(--an-border-dark); background: var(--an-surface-dark); transition: border-color 0.2s; }
.employee-card:hover { border-color: var(--an-border-light); }
.avatar-circle { width: 40px; height: 40px; background: var(--p-primary-color); font-weight: 600; font-size: 14px; }
</style>
