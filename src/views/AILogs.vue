<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAILogsStore } from '../stores/aiLogs'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Message from 'primevue/message'

const { t } = useI18n()
const aiLogsStore = useAILogsStore()
const { logs, loading, error } = storeToRefs(aiLogsStore)

onMounted(() => {
  aiLogsStore.fetchLogs()
})
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-xl font-bold">{{ $t('aiLogs.title') }}</h1>
          <p style="font-size: 14px; color: var(--an-text-subtle);" class="mt-1">{{ $t('aiLogs.subtitle', 'AI price-check interaction history') }}</p>
        </div>
      </div>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <div v-else-if="logs.length === 0" class="text-center my-5">
        <i class="pi pi-comments" style="font-size: 3rem; color: var(--an-text-muted); display: block; margin-bottom: 12px;"></i>
        <div class="text-lg" style="color: var(--an-text-subtle);">{{ $t('aiLogs.noInteractions') }}</div>
        <div style="color: var(--an-text-muted);">{{ $t('aiLogs.noInteractionsHint') }}</div>
      </div>

      <Accordion v-if="logs.length > 0" multiple>
        <AccordionPanel v-for="log in logs" :key="log.id || log._id" :value="log.id || log._id">
          <AccordionHeader>
            <div class="flex align-items-center gap-3">
              <i class="pi pi-comment" style="font-size: 1.25rem;"></i>
              <div>
                <div class="font-bold">{{ log.hardware?.manufacturer }} {{ log.hardware?.model }}</div>
                <div style="font-size: 12px; color: var(--an-text-muted);">
                  {{ new Date(log.timestamp).toLocaleString() }}
                </div>
              </div>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="an-card mb-3" style="border: 1px solid var(--an-border-dark); border-radius: var(--radius-md); padding: 16px;">
              <div class="font-bold mb-2">{{ $t('aiLogs.rawResponse') }}</div>
              <pre class="response-text">{{ log.rawResponse }}</pre>
            </div>

            <div class="an-card" style="border: 1px solid var(--an-border-dark); border-radius: var(--radius-md); padding: 16px;">
              <div class="font-bold mb-2">{{ $t('aiLogs.parsedPrices') }}</div>
              <div v-if="log.parsedResponse?.length">
                <div
                  v-for="(price, index) in log.parsedResponse"
                  :key="index"
                  class="flex align-items-center gap-3 p-2"
                  style="border-bottom: 1px solid var(--an-border-dark);"
                >
                  <i :class="index === 0 ? 'pi pi-star' : 'pi pi-shopping-bag'" style="font-size: 1rem;"></i>
                  <div class="flex-1">
                    <a :href="price.url" target="_blank" class="font-bold">{{ price.source }}</a>
                  </div>
                  <span class="font-bold">{{ price.price }}€</span>
                </div>
              </div>
              <div v-else style="color: var(--an-text-muted);">
                {{ $t('aiLogs.noValidPrices') }}
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </div>
</template>

<style scoped>
.response-text {
  white-space: pre-wrap;
  font-family: monospace;
  background: var(--an-surface-elevated);
  padding: 1rem;
  border-radius: 4px;
  margin: 0;
}
</style>
