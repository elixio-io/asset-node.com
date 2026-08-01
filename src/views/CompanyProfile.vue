<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Slider from 'primevue/slider'
import MultiSelect from 'primevue/multiselect'
import Message from 'primevue/message'

const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

interface CompanyProfileType {
  companySize: string
  industry: string
  locations: number
  currentDevices: { macbookPro: number; macbookAir: number; desktops: number; otherLaptops: number }
  plannedDevices: number
  refreshCycle: string
  primaryUse: string[]
  specialRequirements: string[]
  currentSuppliers: string[]
  purchaseProcess: string
  budgetPerDevice: string
  itTeamSize: number
  managementTools: string[]
  challenges: string[]
  securityRequirements: string[]
  sustainabilityImportance: number
  comments: string
}

const profile = ref<CompanyProfileType>({
  companySize: '', industry: '', locations: 1,
  currentDevices: { macbookPro: 0, macbookAir: 0, desktops: 0, otherLaptops: 0 },
  plannedDevices: 0, refreshCycle: '',
  primaryUse: [], specialRequirements: [],
  currentSuppliers: [], purchaseProcess: '', budgetPerDevice: '',
  itTeamSize: 0, managementTools: [], challenges: [],
  securityRequirements: [], sustainabilityImportance: 1, comments: ''
})

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/org-settings')
    if (data?.settings?.companyProfile) {
      profile.value = { ...profile.value, ...data.settings.companyProfile }
    }
  } catch {  }
  finally { loading.value = false }
})

const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Media', 'Consulting', 'Non-Profit', 'Other']
const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const refreshCycles = ['Every 2 years', 'Every 3 years', 'Every 4 years', 'As needed', 'No fixed cycle']
const useCases = ['Software Development', 'Design & Creative Work', 'Business Applications', 'Data Analysis', 'Customer Service', 'Sales', 'Administration', 'Engineering', 'Education & Training']
const requirements = ['High Performance', 'Long Battery Life', 'Large Screen', 'Portability', 'External Display Support', 'Specific Software Compatibility', 'Enhanced Security Features']
const managementToolOptions = ['MDM Solution', 'Asset Management Software', 'Help Desk System', 'Remote Management Tools', 'Security Software', 'None']
const commonChallenges = ['Device Provisioning Time', 'Maintenance Costs', 'Security Compliance', 'User Support', 'Asset Tracking', 'Budget Constraints', 'Software Compatibility', 'Hardware Reliability']
const securityRequirementOptions = ['Disk Encryption', 'Biometric Authentication', 'Remote Wipe', 'Device Tracking', 'Application Control', 'Network Security', 'Data Loss Prevention']
const budgetRanges = ['Under 1000€', '1000€ - 1500€', '1500€ - 2000€', '2000€ - 2500€', 'Over 2500€']
const purchaseProcesses = ['Direct Purchase', 'Leasing', 'Mixed']

async function handleSubmit() {
  saving.value = true; error.value = null; success.value = null
  try {
    await api.patch('/org-settings', { settings: { companyProfile: profile.value } })
    success.value = t('companyProfile.savedSuccess')
    setTimeout(() => router.push('/profile'), 1500)
  } catch (err: any) { error.value = err.response?.data?.error || t('companyProfile.saveError') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner" style="max-width: 1000px">
      <div class="view-header">
        <div>
          <h1 class="text-xl font-bold">{{ $t('companyProfile.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('companyProfile.subtitle') }}</p>
        </div>
      </div>

      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      <Message v-if="success" severity="success" closable @close="success = null" class="mb-4">{{ success }}</Message>

      <form @submit.prevent="handleSubmit">
        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-building mr-2"></i>{{ $t('companyProfile.companyInfo') }}</h2>
          <div class="grid">
            <div class="col-12 md:col-6">
              <label>{{ $t('companyProfile.companySize') }}</label>
              <Select v-model="profile.companySize" :options="companySizes" class="w-full mt-2" />
            </div>
            <div class="col-12 md:col-6">
              <label>{{ $t('companyProfile.industry') }}</label>
              <Select v-model="profile.industry" :options="industries" class="w-full mt-2" />
            </div>
            <div class="col-12 md:col-6">
              <label>{{ $t('companyProfile.numberOfLocations') }}</label>
              <InputNumber v-model="profile.locations" :min="1" class="w-full mt-2" />
            </div>
          </div>
        </div>

        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-desktop mr-2"></i>{{ $t('companyProfile.currentHardware') }}</h2>
          <div class="grid">
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.macbookProDevices') }}</label><InputNumber v-model="profile.currentDevices.macbookPro" :min="0" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.macbookAirDevices') }}</label><InputNumber v-model="profile.currentDevices.macbookAir" :min="0" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.desktopComputers') }}</label><InputNumber v-model="profile.currentDevices.desktops" :min="0" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.otherLaptops') }}</label><InputNumber v-model="profile.currentDevices.otherLaptops" :min="0" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.plannedDevices') }}</label><InputNumber v-model="profile.plannedDevices" :min="0" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.refreshCycle') }}</label><Select v-model="profile.refreshCycle" :options="refreshCycles" class="w-full mt-2" /></div>
          </div>
        </div>

        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-chart-bar mr-2"></i>{{ $t('companyProfile.usageInfo') }}</h2>
          <div class="grid">
            <div class="col-12"><label>{{ $t('companyProfile.primaryUseCases') }}</label><MultiSelect v-model="profile.primaryUse" :options="useCases" class="w-full mt-2" /></div>
            <div class="col-12"><label>{{ $t('companyProfile.specialRequirements') }}</label><MultiSelect v-model="profile.specialRequirements" :options="requirements" class="w-full mt-2" /></div>
          </div>
        </div>

        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-shopping-cart mr-2"></i>{{ $t('companyProfile.procurementInfo') }}</h2>
          <div class="grid">
            <div class="col-12"><label>{{ $t('companyProfile.currentSuppliers') }}</label><InputText v-model="profile.currentSuppliers" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.budgetPerDevice') }}</label><Select v-model="profile.budgetPerDevice" :options="budgetRanges" class="w-full mt-2" /></div>
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.purchaseProcess') }}</label><Select v-model="profile.purchaseProcess" :options="purchaseProcesses" class="w-full mt-2" /></div>
          </div>
        </div>

        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-cog mr-2"></i>{{ $t('companyProfile.itManagement') }}</h2>
          <div class="grid">
            <div class="col-12 md:col-6"><label>{{ $t('companyProfile.itTeamSize') }}</label><InputNumber v-model="profile.itTeamSize" :min="0" class="w-full mt-2" /></div>
            <div class="col-12"><label>{{ $t('companyProfile.managementTools') }}</label><MultiSelect v-model="profile.managementTools" :options="managementToolOptions" class="w-full mt-2" /></div>
            <div class="col-12"><label>{{ $t('companyProfile.currentChallenges') }}</label><MultiSelect v-model="profile.challenges" :options="commonChallenges" class="w-full mt-2" /></div>
          </div>
        </div>

        <div class="section-card mb-4">
          <h2 class="section-title"><i class="pi pi-info-circle mr-2"></i>{{ $t('companyProfile.additionalInfo') }}</h2>
          <div class="grid">
            <div class="col-12"><label>{{ $t('companyProfile.securityRequirements') }}</label><MultiSelect v-model="profile.securityRequirements" :options="securityRequirementOptions" class="w-full mt-2" /></div>
            <div class="col-12">
              <label>{{ $t('companyProfile.sustainability') }}: {{ profile.sustainabilityImportance }}</label>
              <div class="flex align-items-center gap-3 mt-2">
                <span>1</span>
                <Slider v-model="profile.sustainabilityImportance" :min="1" :max="5" class="flex-1" />
                <span>5</span>
                <i class="pi pi-sun" :style="{ color: profile.sustainabilityImportance >= 4 ? 'var(--an-emerald)' : 'var(--an-text-muted)' }"></i>
              </div>
            </div>
            <div class="col-12"><label>{{ $t('companyProfile.additionalComments') }}</label><Textarea v-model="profile.comments" rows="3" class="w-full mt-2" /></div>
          </div>
        </div>

        <div class="flex justify-content-end gap-3">
          <Button severity="secondary" size="large" outlined :label="$t('companyProfile.skipForNow')" @click="router.push('/dashboard')" />
          <Button type="submit" severity="primary" size="large" :label="$t('companyProfile.saveProfile')" :loading="saving" />
        </div>
      </form>
    </div>
  </div>
</template>

