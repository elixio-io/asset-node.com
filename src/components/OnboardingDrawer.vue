<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import QuickCreateSelect from './QuickCreateSelect.vue'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  mode: 'onboard' | 'offboard'
  employees?: { _id: string; firstName: string; lastName: string; departmentId?: { _id: string; name: string } | null }[]
}>()

interface NamedRef { _id: string; name: string }
const departments = ref<NamedRef[]>([])

async function fetchDepartments() {
  try { departments.value = (await api.get('/departments')).data } catch {  }
}

onMounted(fetchDepartments)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'completed'): void
}>()

const drawerVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const step = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)

watch(() => props.modelValue, (open) => {
  if (open) {
    step.value = 1
    error.value = null
    successMsg.value = null
    onboardForm.value = { firstName: '', lastName: '', email: '', departmentId: '', jobTitle: '', managerId: '', startDate: null as Date | null, notes: '' }
    selectedHardware.value = []
    selectedPeripherals.value = []
    offboardForm.value = { employeeId: '', endDate: null as Date | null, returnCondition: 'good', notes: '' }
    kitData.value = null
  }
})

const onboardForm = ref({
  firstName: '', lastName: '', email: '',
  departmentId: '' as string, jobTitle: '', managerId: '',
  startDate: null as Date | null, notes: ''
})

interface KitData {
  department: string
  suggestedCategories: { _id: string; count: number; models: string[] }[]
  availableHardware: { _id: string; serialNumber: string; model: string; category: string; manufacturer: string }[]
  availablePeripherals: { _id: string; serialNumber: string; model: string; type: string; manufacturer: string }[]
}

const kitData = ref<KitData | null>(null)
const selectedHardware = ref<string[]>([])
const selectedPeripherals = ref<string[]>([])

async function fetchKit() {
  if (!onboardForm.value.departmentId) return
  loading.value = true
  try {
    const dept = departments.value.find(d => d._id === onboardForm.value.departmentId)
    if (!dept) { loading.value = false; return }
    const res = await api.get(`/onboarding/kit/${encodeURIComponent(dept.name)}`)
    kitData.value = res.data
  } catch { kitData.value = null }
  finally { loading.value = false }
}

async function submitOnboard() {
  loading.value = true
  error.value = null
  try {
    const payload: Record<string, unknown> = {
      firstName: onboardForm.value.firstName,
      lastName: onboardForm.value.lastName,
      email: onboardForm.value.email,
      departmentId: onboardForm.value.departmentId || undefined,
      jobTitle: onboardForm.value.jobTitle || undefined,
      managerId: onboardForm.value.managerId || undefined,
      startDate: onboardForm.value.startDate ? (onboardForm.value.startDate as Date).toISOString() : undefined,
      notes: onboardForm.value.notes || undefined,
      hardware: selectedHardware.value,
      peripherals: selectedPeripherals.value
    }
    await api.post('/onboarding/onboard', payload)
    successMsg.value = t('onboarding.onboardSuccess', { name: `${onboardForm.value.firstName} ${onboardForm.value.lastName}` })
    step.value = 4
    emit('completed')
  } catch (err: any) {
    error.value = err.response?.data?.error || t('onboarding.onboardError')
  } finally { loading.value = false }
}

const offboardForm = ref({
  employeeId: '',
  endDate: null as Date | null,
  returnCondition: 'good' as 'good' | 'fair' | 'damaged',
  notes: ''
})

const selectedEmployee = computed(() =>
  props.employees?.find(e => e._id === offboardForm.value.employeeId)
)

const employeeOptions = computed(() =>
  (props.employees || []).map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e._id }))
)

async function submitOffboard() {
  if (!offboardForm.value.employeeId) return
  loading.value = true
  error.value = null
  try {
    await api.post(`/onboarding/offboard/${offboardForm.value.employeeId}`, {
      endDate: offboardForm.value.endDate ? (offboardForm.value.endDate as Date).toISOString() : undefined,
      returnCondition: offboardForm.value.returnCondition,
      notes: offboardForm.value.notes || undefined
    })
    const emp = selectedEmployee.value
    successMsg.value = t('onboarding.offboardSuccess', { name: emp ? `${emp.firstName} ${emp.lastName}` : '' })
    step.value = 4
    emit('completed')
  } catch (err: any) {
    error.value = err.response?.data?.error || t('onboarding.offboardError')
  } finally { loading.value = false }
}

const RETURN_CONDITIONS = [
  { label: t('onboarding.conditionGood'), value: 'good' },
  { label: t('onboarding.conditionFair'), value: 'fair' },
  { label: t('onboarding.conditionDamaged'), value: 'damaged' }
]

function isHardwareSelected(id: string) { return selectedHardware.value.includes(id) }
function toggleHardware(id: string) {
  const idx = selectedHardware.value.indexOf(id)
  if (idx >= 0) selectedHardware.value.splice(idx, 1)
  else selectedHardware.value.push(id)
}
function isPeripheralSelected(id: string) { return selectedPeripherals.value.includes(id) }
function togglePeripheral(id: string) {
  const idx = selectedPeripherals.value.indexOf(id)
  if (idx >= 0) selectedPeripherals.value.splice(idx, 1)
  else selectedPeripherals.value.push(id)
}

function goNext() {
  if (step.value === 1 && onboardForm.value.departmentId) fetchKit()
  if (step.value < 3) step.value++
}
</script>

<template>
  <Dialog
    v-model:visible="drawerVisible"
    :style="{width:'560px',height:'100vh',margin:0,borderRadius:0}"
    position="right"
    modal
    :header="mode === 'onboard' ? $t('onboarding.title') : $t('onboarding.offboarding')"
  >
    <Message v-if="error" severity="error" :closable="true" @close="error = null" class="mb-3">{{ error }}</Message>

    <template v-if="mode === 'onboard' && step < 4">
      <div class="stepper-header mb-4">
        <div v-for="(label, i) in [$t('onboarding.employeeDetails'), $t('onboarding.selectAssets'), $t('onboarding.reviewConfirm')]" :key="i" class="stepper-step" :class="{ active: step === i + 1, completed: step > i + 1 }">
          <div class="step-num">
            <i v-if="step > i + 1" class="pi pi-check" style="font-size:11px;"></i>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="step-text">{{ label }}</span>
        </div>
      </div>

      <div v-if="step === 1">
        <div class="grid mb-3" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.firstName') }}</label>
            <InputText v-model="onboardForm.firstName" class="w-full" />
          </div>
          <div>
            <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.lastName') }}</label>
            <InputText v-model="onboardForm.lastName" class="w-full" />
          </div>
        </div>
        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.email') }}</label>
          <InputText v-model="onboardForm.email" type="email" class="w-full" />
        </div>
        <div class="grid mb-3" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.department') }}</label>
            <QuickCreateSelect v-model="onboardForm.departmentId" :options="departments" createEndpoint="/departments" :entityLabel="$t('common.department')" class="w-full" showClear @created="fetchDepartments" />
          </div>
          <div>
            <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.jobTitle') }}</label>
            <InputText v-model="onboardForm.jobTitle" class="w-full" />
          </div>
        </div>
        <div class="mb-3" style="max-width:50%;">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.startDate') }}</label>
          <DatePicker v-model="onboardForm.startDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
        </div>
      </div>

      <div v-if="step === 2">
        <Button v-if="onboardForm.departmentId && !kitData" severity="primary" size="small" class="mb-4" :loading="loading" :label="$t('onboarding.suggestedKit', { dept: departments.find(d => d._id === onboardForm.departmentId)?.name || '' })" @click="fetchKit" />

        <div v-if="kitData?.suggestedCategories?.length" class="mb-4">
          <div class="font-bold mb-2" style="font-size:13px;">{{ $t('onboarding.suggestedKit', { dept: kitData.department }) }}</div>
          <Tag v-for="cat in kitData.suggestedCategories" :key="cat._id" severity="info" class="mr-2 mb-2">{{ cat.name || '—' }} ({{ cat.count }})</Tag>
        </div>

        <div class="font-bold mb-2" style="font-size:13px;">{{ $t('onboarding.availableHardware') }}</div>
        <div v-if="kitData?.availableHardware?.length" class="mb-4" style="max-height:200px;overflow-y:auto;">
          <div v-for="hw in kitData.availableHardware" :key="hw._id" class="flex align-items-center gap-2 mb-1">
            <Checkbox :modelValue="isHardwareSelected(hw._id)" :binary="true" @update:modelValue="toggleHardware(hw._id)" />
            <span style="font-size:13px;">{{ hw.manufacturer }} {{ hw.model }} — {{ hw.category }} ({{ hw.serialNumber }})</span>
          </div>
        </div>
        <div v-else style="color:var(--an-text-muted);font-size:14px;" class="mb-4">
          {{ onboardForm.departmentId ? t('onboarding.noAvailableHardware') : t('onboarding.enterDepartmentFirst') }}
        </div>

        <div class="font-bold mb-2" style="font-size:13px;">{{ $t('onboarding.availablePeripherals') }}</div>
        <div v-if="kitData?.availablePeripherals?.length" style="max-height:200px;overflow-y:auto;">
          <div v-for="p in kitData.availablePeripherals" :key="p._id" class="flex align-items-center gap-2 mb-1">
            <Checkbox :modelValue="isPeripheralSelected(p._id)" :binary="true" @update:modelValue="togglePeripheral(p._id)" />
            <span style="font-size:13px;">{{ p.manufacturer }} {{ p.model }} — {{ p.type }} ({{ p.serialNumber }})</span>
          </div>
        </div>
      </div>

      <div v-if="step === 3">
        <div class="an-card mb-3" style="padding:16px;">
          <div class="flex align-items-center gap-2 mb-2">
            <i class="pi pi-user" style="font-size:20px;"></i>
            <div>
              <div class="font-bold">{{ onboardForm.firstName }} {{ onboardForm.lastName }}</div>
              <div style="color:var(--an-text-muted);font-size:13px;">{{ onboardForm.email }} · {{ departments.find(d => d._id === onboardForm.departmentId)?.name || '—' }} · {{ onboardForm.jobTitle }}</div>
            </div>
          </div>
        </div>

        <div class="font-bold mb-2" style="font-size:13px;">{{ $t('onboarding.selectedAssets') }}</div>
        <div class="mb-3">
          <Tag v-for="id in selectedHardware" :key="id" severity="info" class="mr-2 mb-2">{{ kitData?.availableHardware.find(h => h._id === id)?.model || '—' }}</Tag>
          <Tag v-for="id in selectedPeripherals" :key="id" severity="success" class="mr-2 mb-2">{{ kitData?.availablePeripherals.find(p => p._id === id)?.model || '—' }}</Tag>
          <div v-if="!selectedHardware.length && !selectedPeripherals.length" style="color:var(--an-text-muted);font-size:14px;">
            {{ t('onboarding.noAssetsSelected') }}
          </div>
        </div>

        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.notes') }}</label>
          <Textarea v-model="onboardForm.notes" rows="2" class="w-full" />
        </div>
      </div>
    </template>

    <div v-if="mode === 'onboard' && step === 4" class="flex flex-column align-items-center justify-content-center" style="padding:48px 0;">
      <i class="pi pi-check-circle" style="font-size:48px;color:var(--p-green-500);"></i>
      <div class="font-bold mt-3 mb-2" style="color:var(--p-green-500);">{{ successMsg }}</div>
      <Button severity="primary" :label="$t('common.done')" class="mt-4" @click="drawerVisible = false" />
    </div>

    <template v-if="mode === 'offboard'">
      <div v-if="step < 4">
        <div class="font-bold mb-3" style="font-size:13px;">{{ $t('onboarding.offboardEmployee') }}</div>

        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('common.employee') }}</label>
          <Select v-model="offboardForm.employeeId" :options="employeeOptions" optionLabel="label" optionValue="value" placeholder="Select employee..." class="w-full" filter />
        </div>

        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.endDate') }}</label>
          <DatePicker v-model="offboardForm.endDate" dateFormat="dd.mm.yy" class="w-full" showIcon />
        </div>

        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.returnCondition') }}</label>
          <Select v-model="offboardForm.returnCondition" :options="RETURN_CONDITIONS" optionLabel="label" optionValue="value" class="w-full" />
        </div>

        <div class="mb-3">
          <label class="block mb-1 font-bold" style="font-size:13px;">{{ $t('onboarding.notes') }}</label>
          <Textarea v-model="offboardForm.notes" rows="2" class="w-full" />
        </div>

        <Message severity="warn" :closable="false">{{ $t('onboarding.offboardConfirm') }}</Message>
      </div>

      <div v-if="step === 4" class="flex flex-column align-items-center justify-content-center" style="padding:48px 0;">
        <i class="pi pi-check-circle" style="font-size:48px;color:var(--p-green-500);"></i>
        <div class="font-bold mt-3 mb-2" style="color:var(--p-green-500);">{{ successMsg }}</div>
        <Button severity="primary" :label="$t('common.done')" class="mt-4" @click="drawerVisible = false" />
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-content-end">
        <template v-if="mode === 'onboard' && step < 4">
          <Button v-if="step > 1" text :label="$t('common.back')" @click="step--" />
          <Button v-if="step < 3" severity="primary" :disabled="step === 1 && (!onboardForm.firstName || !onboardForm.lastName || !onboardForm.email)" :label="$t('common.next')" @click="goNext" />
          <Button v-if="step === 3" severity="primary" :loading="loading" icon="pi pi-check" :label="$t('onboarding.title')" @click="submitOnboard" />
        </template>
        <template v-if="mode === 'offboard' && step < 4">
          <Button severity="danger" :loading="loading" :disabled="!offboardForm.employeeId" icon="pi pi-user-minus" :label="$t('onboarding.offboarding')" @click="submitOffboard" />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.stepper-header { display: flex; gap: 8px; align-items: center; }
.stepper-step {
  display: flex; align-items: center; gap: 6px;
  opacity: 0.5; transition: opacity 0.2s;
}
.stepper-step.active, .stepper-step.completed { opacity: 1; }
.step-num {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
  background: rgba(255,255,255,0.1); color: var(--an-text-muted);
}
.stepper-step.active .step-num { background: var(--p-primary-color); color: #fff; }
.stepper-step.completed .step-num { background: var(--p-green-500); color: #fff; }
.step-text { font-size: 13px; font-weight: 500; white-space: nowrap; }
</style>
