<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useStatusTranslation } from '../composables/useEntityTranslation'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const { t } = useI18n()
interface EmployeeInfo { id: string; name: string; email: string; departmentId?: any; jobTitle?: string }
interface HardwareItem { _id: string; serialNumber?: string; assetTag?: string; model: string; categoryId?: { name: string }; statusId?: { name: string; slug?: string }; manufacturerId?: { name: string } }
interface PeripheralItem { _id: string; serialNumber?: string; model: string; categoryId?: { name: string }; statusId?: { name: string; slug?: string } }

const { translateStatusName } = useStatusTranslation()
interface AssignmentItem { _id: string; status: string; assignmentDate: string; hardware?: HardwareItem; peripherals?: PeripheralItem[] }
interface MyItemsData { employee: EmployeeInfo; hardware: HardwareItem[]; peripherals: PeripheralItem[]; assignments: AssignmentItem[]; totals: { hardware: number; peripherals: number; activeAssignments: number; pendingReturns: number } }

const data = ref<MyItemsData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const returning = ref<string | null>(null)
const statusSeverity: Record<string, string> = { available: 'success', assigned: 'info', defective: 'danger', inRepair: 'warn', active: 'success', pendingReturn: 'warn' }

async function fetchMyItems() {
  loading.value = true; error.value = null
  try { data.value = (await api.get('/my-items')).data }
  catch (err: any) { error.value = err.response?.status === 404 ? t('myItems.noProfile') : t('myItems.loadError') }
  finally { loading.value = false }
}

async function requestReturn(assignmentId: string) {
  returning.value = assignmentId
  try { await api.post(`/my-items/return/${assignmentId}`, {}); await fetchMyItems() }
  catch (err: any) { error.value = err.response?.data?.error || t('myItems.returnError') }
  finally { returning.value = null }
}

onMounted(fetchMyItems)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error && error !== $t('myItems.noProfile')" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div v-if="error === $t('myItems.noProfile')" class="an-card flex flex-column align-items-center justify-content-center text-center p-5 mt-4" style="min-height: 400px; border: 1px dashed var(--an-border-light);">
        <div class="avatar-circle mb-4" style="width: 64px; height: 64px; background: rgba(255,255,255,0.05); color: var(--an-text-subtle); font-size: 24px;">
          <i class="pi pi-user-minus"></i>
        </div>
        <h2 class="text-xl font-bold mb-2">{{ $t('myItems.noProfile') }}</h2>
        <p style="color: var(--an-text-muted); max-width: 500px; line-height: 1.5; font-size: 14px;" class="mb-4">
          {{ $t('myItems.noProfileExplanation') }}
        </p>
      </div>
      <div v-else-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <template v-else-if="data">
        <h1 class="text-2xl font-bold mb-2">{{ $t('myItems.title') }}</h1>
        <p style="color:var(--an-text-muted);font-size:14px;" class="mb-4">{{ $t('myItems.subtitle') }}</p>

        <div class="an-card mb-4" style="padding:20px;display:flex;align-items:center;gap:16px;">
          <div class="avatar-circle" style="width:48px;height:48px;background:var(--p-primary-color);color:#fff;font-weight:700;font-size:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            {{ data.employee.name.split(' ').map(n => n[0]).join('') }}
          </div>
          <div>
            <div class="font-bold" style="font-size:16px;">{{ data.employee.name }}</div>
            <div style="color:var(--an-text-muted);font-size:13px;">{{ data.employee.jobTitle }}<span v-if="data.employee.departmentId && typeof data.employee.departmentId === 'object'"> · {{ data.employee.departmentId.name }}</span></div>
            <div style="color:var(--an-text-muted);font-size:12px;">{{ data.employee.email }}</div>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          <div class="kpi-card text-center"><div class="kpi-value" style="color:var(--p-primary-color);">{{ data.totals.hardware }}</div><div class="kpi-label">{{ $t('myItems.hardware') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color:var(--p-blue-500);">{{ data.totals.peripherals }}</div><div class="kpi-label">{{ $t('myItems.peripherals') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color:var(--p-green-500);">{{ data.totals.activeAssignments }}</div><div class="kpi-label">{{ $t('myItems.activeAssignments') }}</div></div>
          <div class="kpi-card text-center"><div class="kpi-value" style="color:var(--p-yellow-500);">{{ data.totals.pendingReturns }}</div><div class="kpi-label">{{ $t('myItems.pendingReturns') }}</div></div>
        </div>

        <div class="an-card mb-4">
          <div style="padding:16px 20px;font-weight:700;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--an-border-dark);"><i class="pi pi-desktop"></i>{{ $t('myItems.myHardware') }}</div>
          <div v-if="data.hardware.length > 0">
            <div v-for="item in data.hardware" :key="item._id" class="list-item">
              <div class="flex align-items-center gap-3">
                <div class="avatar-circle" style="width:40px;height:40px;background:rgba(255,255,255,0.12);color:var(--p-primary-color);font-size:14px;"><i class="pi pi-desktop"></i></div>
                <div><div class="font-bold" style="font-size:14px;">{{ item.model }}</div><div style="font-size:12px;color:var(--an-text-muted);">{{ item.serialNumber || item.assetTag }} · {{ item.manufacturerId?.name || item.categoryId?.name || '' }}</div></div>
              </div>
              <Tag :value="translateStatusName(item.statusId)" severity="secondary" />
            </div>
          </div>
          <div v-else style="padding:20px;color:var(--an-text-muted);">{{ $t('myItems.noHardware') }}</div>
        </div>

        <div class="an-card mb-4">
          <div style="padding:16px 20px;font-weight:700;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--an-border-dark);"><i class="pi pi-link"></i>{{ $t('myItems.myPeripherals') }}</div>
          <div v-if="data.peripherals.length > 0">
            <div v-for="item in data.peripherals" :key="item._id" class="list-item">
              <div class="flex align-items-center gap-3">
                <div class="avatar-circle" style="width:40px;height:40px;background:rgba(59,130,246,0.12);color:var(--p-blue-500);font-size:14px;"><i class="pi pi-link"></i></div>
                <div><div class="font-bold" style="font-size:14px;">{{ item.model }}</div><div style="font-size:12px;color:var(--an-text-muted);">{{ item.serialNumber }} · {{ item.categoryId?.name || '' }}</div></div>
              </div>
              <Tag :value="translateStatusName(item.statusId)" severity="secondary" />
            </div>
          </div>
          <div v-else style="padding:20px;color:var(--an-text-muted);">{{ $t('myItems.noPeripherals') }}</div>
        </div>

        <div class="an-card">
          <div style="padding:16px 20px;font-weight:700;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--an-border-dark);"><i class="pi pi-arrows-h"></i>{{ $t('myItems.myAssignments') }}</div>
          <div v-if="data.assignments.length > 0">
            <div v-for="a in data.assignments" :key="a._id" class="list-item">
              <div><div class="font-bold" style="font-size:14px;">{{ a.hardware?.model || t('myItems.assignment') }}</div><div style="font-size:12px;color:var(--an-text-muted);">{{ new Date(a.assignmentDate).toLocaleDateString() }}</div></div>
              <div class="flex align-items-center gap-2">
                <Tag :value="t(`status.${a.status}`, a.status)" :severity="(statusSeverity[a.status] as any) || 'secondary'" />
                <Button v-if="a.status === 'active'" size="small" severity="warn" outlined :loading="returning === a._id" :label="$t('myItems.requestReturn')" @click="requestReturn(a._id)" />
              </div>
            </div>
          </div>
          <div v-else style="padding:20px;color:var(--an-text-muted);">{{ $t('myItems.noAssignments') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>

.kpi-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.kpi-card { background: var(--an-surface-card); border-radius: var(--radius-md); }
.kpi-value { font-size: 1.8rem; }



</style>
