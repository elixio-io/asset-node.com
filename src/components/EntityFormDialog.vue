<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="header"
    :style="{ width: width || '600px' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    modal
    @hide="onHide"
  >
    <div class="flex flex-column gap-3 pt-2">
      <slot></slot>
    </div>
    <template #footer>
      <Button :label="cancelLabel || $t('common.cancel')" text @click="onCancel" />
      <Button
        :label="saveLabel || $t('common.save')"
        :severity="saveSeverity || 'primary'"
        :icon="saveIcon"
        :loading="loading"
        :disabled="disabled"
        @click="onSave"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = defineProps({
  visible: Boolean,
  header: String,
  width: String,
  loading: Boolean,
  disabled: Boolean,
  saveLabel: String,
  saveIcon: String,
  saveSeverity: String,
  cancelLabel: String
})

const emit = defineEmits(['update:visible', 'save', 'cancel', 'hide'])

function onHide() {
  emit('hide')
}

function onCancel() {
  emit('update:visible', false)
  emit('cancel')
}

function onSave() {
  emit('save')
}
</script>
