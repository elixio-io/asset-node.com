<template>
  <div class="csv-uploader an-card" style="padding:16px;">
    <div class="csv-uploader__header">
      <i class="pi pi-file" style="margin-right:8px;"></i>
      <span class="font-bold" style="font-size:14px;">CSV Upload</span>
    </div>

    <div class="csv-uploader__body">
      <div class="mb-3">
        <input
          type="file"
          accept=".csv"
          class="w-full"
          style="padding:8px;border:1px solid var(--an-border-dark);border-radius:6px;background:transparent;color:inherit;"
          @change="onFileChange"
        />
      </div>

      <Button
        severity="primary"
        :disabled="!file"
        icon="pi pi-upload"
        label="Upload CSV"
        class="w-full"
        @click="uploadFile"
      />

      <Message v-if="message" :severity="isSuccess ? 'success' : 'error'" :closable="true" class="mt-3" @close="message = ''">{{ message }}</Message>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import api from '../lib/api'
import Button from 'primevue/button'
import Message from 'primevue/message'

const file = ref<File | null>(null)
const message = ref<string>('')
const isSuccess = ref<boolean>(false)

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  file.value = target.files?.[0] || null
  message.value = ''
}

const uploadFile = async () => {
  if (!file.value) return

  const formData = new FormData()
  formData.append('csv', file.value)

  try {
    const response = await api.post('/hardware/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    message.value = `Successfully uploaded: ${response.data.message}`
    isSuccess.value = true
  } catch (error: any) {
    message.value = `Error: ${error.response?.data?.message || error.message}`
    isSuccess.value = false
  }
}
</script>

<style scoped>
.csv-uploader__header {
  display: flex;
  align-items: center;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--an-border-dark);
}
</style>
