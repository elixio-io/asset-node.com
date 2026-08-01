<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useFormatters } from '../composables/useFormatters'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'

const { t } = useI18n()

const tabs = [
  { key: 'asset-summary', title: 'Asset Summary', icon: 'pi pi-box' },
  { key: 'depreciation', title: 'Depreciation', icon: 'pi pi-chart-line' },
  { key: 'warranty', title: 'Warranty Expirations', icon: 'pi pi-shield' },
  { key: 'due-back', title: 'Items Due Back', icon: 'pi pi-calendar' },
  { key: 'offboarding', title: 'Offboarding Status', icon: 'pi pi-user-minus' },
  { key: 'checkout-signatures', title: 'Checkout Signatures', icon: 'pi pi-pencil' },
  { key: 'activity', title: 'Activity Log', icon: 'pi pi-history' }
]

const activeTab = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const reportData = ref<any>(null)
const search = ref('')
const dateRange = ref<Date | null>(null)
const exportFormat = ref('csv')

const activeKey = computed(() => tabs[activeTab.value]?.key || 'assets')

async function loadReport() {
  loading.value = true; error.value = null
  try { reportData.value = (await api.get(`/reports/${activeKey.value}`)).data }
  catch { error.value = t('reports.loadError') }
  finally { loading.value = false }
}

async function exportReport() {
  try {
    const response = await api.get(`/reports/${activeKey.value}/export?format=${exportFormat.value}`, {
      responseType: 'blob'
    })
    const blob = new Blob([response.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = exportFormat.value === 'xlsx' ? 'xlsx' : 'csv'
    a.download = `${activeKey.value}-report-${new Date().toISOString().slice(0, 10)}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    error.value = t('reports.exportError')
  }
}

function onTabChange() { loadReport() }

function activityIcon(action: string) {
  switch (action) {
    case 'create': return 'pi pi-plus-circle'
    case 'update': return 'pi pi-pencil'
    case 'delete': return 'pi pi-trash'
    case 'checkout': return 'pi pi-sign-out'
    case 'checkin': return 'pi pi-sign-in'
    default: return 'pi pi-circle'
  }
}

function activitySeverity(action: string): string {
  switch (action) {
    case 'create': return 'success'
    case 'update': return 'info'
    case 'delete': return 'danger'
    case 'checkout': return 'warn'
    case 'checkin': return 'success'
    default: return 'secondary'
  }
}

const { fmtDate, fmtCurrency } = useFormatters()

onMounted(loadReport)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('reports.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ $t('reports.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2">
          <Select v-model="exportFormat" :options="[{label:'CSV',value:'csv'},{label:'PDF',value:'pdf'},{label:'Excel',value:'xlsx'}]" optionLabel="label" optionValue="value" style="width:120px;" />
          <Button severity="secondary" icon="pi pi-download" :label="$t('reports.export')" @click="exportReport" />
        </div>
      </div>

      <TabView v-model:activeIndex="activeTab" @update:activeIndex="onTabChange" class="mb-4">
        <TabPanel v-for="tab in tabs" :key="tab.key" :value="tab.key" :header="tab.title">
        </TabPanel>
      </TabView>

      <div class="flex align-items-center gap-3 mb-4">
        <div class="an-search-wrapper" style="max-width:320px;">
          <i class="pi pi-search an-search-icon" />
          <InputText v-model="search" :placeholder="$t('reports.searchPlaceholder')" class="an-search-input" />
        </div>
        <DatePicker v-model="dateRange" dateFormat="dd.mm.yy" showIcon style="max-width:200px;" />
        <Button icon="pi pi-refresh" text @click="loadReport" />
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <template v-else-if="activeKey === 'asset-summary'">
        <div class="an-card">
          <table class="an-table">
            <thead><tr><th>{{ $t('common.name') }}</th><th>{{ $t('common.type') }}</th><th>{{ $t('common.status') }}</th><th>{{ $t('reports.purchaseDate') }}</th><th>{{ $t('reports.purchaseCost') }}</th><th>{{ $t('reports.currentValue') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in (reportData?.items || [])" :key="item._id">
                <td class="font-bold">{{ item.name }}</td>
                <td>{{ item.type || '—' }}</td>
                <td><Tag :value="item.status" :severity="item.status === 'deployed' ? 'info' : item.status === 'deployable' ? 'success' : 'warn'" /></td>
                <td>{{ fmtDate(item.purchaseDate) }}</td>
                <td>{{ fmtCurrency(item.purchaseCost) }}</td>
                <td>{{ fmtCurrency(item.currentValue) }}</td>
              </tr>
              <tr v-if="!reportData?.items?.length"><td colspan="6" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('reports.noData') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeKey === 'depreciation'">
        <div class="an-card">
          <table class="an-table">
            <thead><tr><th>{{ $t('common.name') }}</th><th>{{ $t('reports.purchaseCost') }}</th><th>{{ $t('reports.depreciationRate') }}</th><th>{{ $t('reports.currentValue') }}</th><th>{{ $t('reports.depreciationAmount') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in (reportData?.items || [])" :key="item._id">
                <td class="font-bold">{{ item.name }}</td>
                <td>{{ fmtCurrency(item.purchaseCost) }}</td>
                <td>{{ item.depreciationRate ? `${item.depreciationRate}%` : '—' }}</td>
                <td>{{ fmtCurrency(item.currentValue) }}</td>
                <td>{{ fmtCurrency(item.depreciationAmount) }}</td>
              </tr>
              <tr v-if="!reportData?.items?.length"><td colspan="5" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('reports.noData') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeKey === 'warranty'">
        <div class="an-card">
          <table class="an-table">
            <thead><tr><th>{{ $t('common.name') }}</th><th>{{ $t('reports.warrantyExpires') }}</th><th>{{ $t('reports.daysRemaining') }}</th><th>{{ $t('common.status') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in (reportData?.items || [])" :key="item._id">
                <td class="font-bold">{{ item.name }}</td>
                <td>{{ fmtDate(item.warrantyExpires) }}</td>
                <td>{{ item.daysRemaining ?? '—' }}</td>
                <td><Tag :value="item.daysRemaining <= 0 ? 'Expired' : item.daysRemaining <= 30 ? 'Expiring' : 'Active'" :severity="item.daysRemaining <= 0 ? 'danger' : item.daysRemaining <= 30 ? 'warn' : 'success'" /></td>
              </tr>
              <tr v-if="!reportData?.items?.length"><td colspan="4" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('reports.noData') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeKey === 'due-back' || activeKey === 'offboarding' || activeKey === 'checkout-signatures'">
        <div class="an-card">
          <table class="an-table">
            <thead><tr><th>{{ $t('common.name') }}</th><th>{{ $t('common.employee') }}</th><th>{{ $t('reports.dueDate') }}</th><th>{{ $t('common.status') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in (reportData?.items || [])" :key="item._id">
                <td class="font-bold">{{ item.name || item.assetName }}</td>
                <td>{{ item.employeeName || '—' }}</td>
                <td>{{ fmtDate(item.dueDate || item.date) }}</td>
                <td><Tag :value="item.status" :severity="item.status === 'overdue' ? 'danger' : item.status === 'completed' ? 'success' : 'warn'" /></td>
              </tr>
              <tr v-if="!reportData?.items?.length"><td colspan="4" class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('reports.noData') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeKey === 'activity'">
        <div class="an-card">
          <div v-if="reportData?.items?.length" class="activity-list">
            <div v-for="item in (reportData?.items || [])" :key="item._id" class="activity-item">
              <div class="flex align-items-center gap-3">
                <i :class="activityIcon(item.action)" style="font-size:18px;"></i>
                <div>
                  <div class="font-bold" style="font-size:14px;">{{ item.description }}</div>
                  <div style="font-size:12px;color:var(--an-text-muted);">{{ item.user }} · {{ fmtDate(item.createdAt) }}</div>
                </div>
              </div>
              <Tag :value="item.action" :severity="activitySeverity(item.action)" />
            </div>
          </div>
          <div v-else class="text-center" style="padding:40px;color:var(--an-text-muted);">{{ $t('reports.noData') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>


.activity-list { padding: 0; }
.activity-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--an-border-dark); }
.activity-item:last-child { border-bottom: none; }
</style>
