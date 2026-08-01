<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import api from '../lib/api'

const { t } = useI18n()

interface Props {
  modelValue: string | null
  options: { _id: string; name: string }[]
  createEndpoint: string
  entityLabel: string
  extraFields?: Record<string, string>
  placeholder?: string
  showClear?: boolean
  size?: 'small' | 'large'
  filter?: boolean
  canCreate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  showClear: false,
  size: 'small',
  filter: false,
  canCreate: true,
  extraFields: () => ({})
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'created': [item: { _id: string; name: string }]
}>()

const dialogVisible = ref(false)
const newName = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

const selectedValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function openCreateDialog() {
  newName.value = ''
  createError.value = null
  dialogVisible.value = true
}

async function createItem() {
  if (!newName.value.trim()) return
  creating.value = true
  createError.value = null

  try {
    const payload: Record<string, string> = {
      name: newName.value.trim(),
      ...props.extraFields
    }
    const response = await api.post(props.createEndpoint, payload)
    const newItem = response.data

    emit('created', newItem)

    emit('update:modelValue', newItem._id)

    dialogVisible.value = false
  } catch (err: any) {
    if (err.response?.status === 409) {
      createError.value = t('common.alreadyExists', { name: props.entityLabel })
    } else {
      createError.value = err.response?.data?.error || t('common.createFailed')
    }
  } finally {
    creating.value = false
  }
}

const nameInput = ref<HTMLInputElement | null>(null)
watch(dialogVisible, (visible) => {
  if (visible) {
    setTimeout(() => nameInput.value?.focus(), 100)
  }
})
</script>

<template>
  <div class="quick-create-select">
    <Select
      :modelValue="selectedValue"
      @update:modelValue="selectedValue = $event"
      :options="options"
      optionLabel="name"
      optionValue="_id"
      :placeholder="placeholder"
      :showClear="showClear"
      :filter="filter"
      :size="size"
      class="quick-create-dropdown"
    />
    <Button
      v-if="canCreate"
      icon="pi pi-plus"
      severity="secondary"
      :size="size"
      text
      rounded
      class="quick-create-btn"
      v-tooltip.top="$t('common.createNew', { entity: entityLabel })"
      @click="openCreateDialog"
    />

    <Dialog
      v-model:visible="dialogVisible"
      :header="$t('common.createNew', { entity: entityLabel })"
      :style="{ width: '400px' }"
      modal
      :closable="!creating"
    >
      <Message v-if="createError" severity="error" closable @close="createError = null" class="mb-3">
        {{ createError }}
      </Message>

      <div class="flex flex-column gap-2">
        <label class="font-semibold" style="font-size: 13px;">{{ $t('common.name') }}</label>
        <InputText
          ref="nameInput"
          v-model="newName"
          :placeholder="`${entityLabel} ${$t('common.name')}...`"
          class="w-full"
          @keydown.enter="createItem"
          autofocus
        />
      </div>

      <template #footer>
        <Button :label="$t('common.cancel')" text @click="dialogVisible = false" :disabled="creating" />
        <Button
          :label="$t('common.create')"
          severity="primary"
          icon="pi pi-check"
          :loading="creating"
          :disabled="!newName.trim()"
          @click="createItem"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.quick-create-select {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.quick-create-dropdown {
  flex: 1;
  min-width: 0;
}

.quick-create-btn {
  flex-shrink: 0;
  width: 28px !important;
  height: 28px !important;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.quick-create-btn:hover {
  opacity: 1;
}
</style>
