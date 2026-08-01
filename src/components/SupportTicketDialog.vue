<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import api from '../lib/api'
import { snapshotLog } from '../composables/useClientLogBuffer'


const route = useRoute()
const { t } = useI18n()
const toast = useToast()

const open = ref(false)
const submitting = ref(false)

const subject = ref('')
const description = ref('')
const category = ref<'bug' | 'feature' | 'question' | 'billing' | 'other'>('bug')
const priority = ref<'low' | 'medium' | 'high' | 'critical'>('medium')

const categories = computed(() => [
  { value: 'bug', label: t('support.category.bug') },
  { value: 'feature', label: t('support.category.feature') },
  { value: 'question', label: t('support.category.question') },
  { value: 'billing', label: t('support.category.billing') },
  { value: 'other', label: t('support.category.other') },
])

const priorities = computed(() => [
  { value: 'low', label: t('support.priority.low') },
  { value: 'medium', label: t('support.priority.medium') },
  { value: 'high', label: t('support.priority.high') },
  { value: 'critical', label: t('support.priority.critical') },
])

function reset() {
  subject.value = ''
  description.value = ''
  category.value = 'bug'
  priority.value = 'medium'
}

function collectMetadata() {
  return {


    url: route.path.slice(0, 500),
    userAgent: navigator.userAgent.slice(0, 500),
    appVersion: String((import.meta as any).env?.VITE_APP_VERSION || 'dev').slice(0, 50),
    screenSize: `${window.innerWidth}x${window.innerHeight}`,



    clientLog: snapshotLog(),
  }
}

async function submit() {
  if (subject.value.trim().length < 3) {
    toast.add({ severity: 'warn', summary: t('support.toast.invalid'), detail: t('support.validation.subjectShort'), life: 4000 })
    return
  }
  if (description.value.trim().length < 10) {
    toast.add({ severity: 'warn', summary: t('support.toast.invalid'), detail: t('support.validation.descriptionShort'), life: 4000 })
    return
  }

  submitting.value = true
  try {
    const res = await api.post('/support/tickets', {
      subject: subject.value.trim(),
      description: description.value.trim(),
      category: category.value,
      priority: priority.value,
      metadata: collectMetadata(),
    })
    const ref = res.data?.ticketRef || ''
    toast.add({
      severity: 'success',
      summary: t('support.toast.sent'),
      detail: t('support.toast.sentDetail', { ref }),
      life: 6000,
    })
    reset()
    open.value = false
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('support.toast.failed'),
      detail: err?.response?.data?.error || t('support.toast.failedDetail'),
      life: 6000,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <button
    class="support-fab"
    :title="t('support.button.title')"
    :aria-label="t('support.button.title')"
    @click="open = true"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
    <span class="support-fab-label">{{ t('support.button.label') }}</span>
  </button>

  <Transition name="support-fade">
    <div v-if="open" class="support-overlay" @click.self="open = false">
      <div class="support-panel" role="dialog" :aria-label="t('support.dialog.title')">
        <header class="support-panel-header">
          <h2>{{ t('support.dialog.title') }}</h2>
          <button class="support-close" :aria-label="t('common.close')" @click="open = false">×</button>
        </header>

        <form class="support-form" @submit.prevent="submit">
          <label class="support-label">
            <span>{{ t('support.field.subject') }}</span>
            <input
              v-model="subject"
              type="text"
              maxlength="200"
              :placeholder="t('support.field.subjectPlaceholder')"
              required
            />
          </label>

          <div class="support-row">
            <label class="support-label">
              <span>{{ t('support.field.category') }}</span>
              <select v-model="category">
                <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </label>

            <label class="support-label">
              <span>{{ t('support.field.priority') }}</span>
              <select v-model="priority">
                <option v-for="p in priorities" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </label>
          </div>

          <label class="support-label">
            <span>{{ t('support.field.description') }}</span>
            <textarea
              v-model="description"
              rows="6"
              maxlength="5000"
              :placeholder="t('support.field.descriptionPlaceholder')"
              required
            />
          </label>

          <p class="support-hint">{{ t('support.hint') }}</p>

          <div class="support-actions">
            <button type="button" class="support-btn-ghost" :disabled="submitting" @click="open = false">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="support-btn-primary" :disabled="submitting">
              {{ submitting ? t('support.submitting') : t('support.submit') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.support-fab {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 9998;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--an-border-dark, #30363d);
  background: var(--an-bg-card, #161b22);
  color: var(--an-text, #c9d1d9);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s ease, background 0.15s ease;
}
.support-fab:hover { background: #1c2230; transform: translateY(-1px); }
.support-fab-label { white-space: nowrap; }

.support-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(6, 8, 14, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.support-panel {
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--an-bg-card, #161b22);
  border: 1px solid var(--an-border-dark, #30363d);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
}

.support-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--an-border-dark, #30363d);
}
.support-panel-header h2 {
  margin: 0;
  color: var(--an-text-strong, #e6edf3);
  font-size: 16px;
  font-weight: 700;
}
.support-close {
  background: transparent;
  border: none;
  color: var(--an-text-muted, #8b949e);
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  padding: 0 6px;
}
.support-close:hover { color: #fff; }

.support-form { padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
.support-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.support-label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--an-text-muted, #8b949e); }
.support-label input,
.support-label select,
.support-label textarea {
  width: 100%;
  background: var(--an-bg-dark, #0d1117);
  border: 1px solid var(--an-border-dark, #30363d);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--an-text, #c9d1d9);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
.support-label input:focus,
.support-label select:focus,
.support-label textarea:focus {
  outline: none;
  border-color: #34d399;
}

.support-hint { margin: 0; color: var(--an-text-muted, #8b949e); font-size: 12px; }

.support-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
.support-btn-ghost, .support-btn-primary {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--an-border-dark, #30363d);
}
.support-btn-ghost { background: transparent; color: var(--an-text, #c9d1d9); }
.support-btn-ghost:hover { background: #1c2230; }
.support-btn-primary { background: #34d399; color: #0d1117; border-color: #34d399; }
.support-btn-primary:hover { background: #10b981; border-color: #10b981; }
.support-btn-primary:disabled,
.support-btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }

.support-fade-enter-active, .support-fade-leave-active { transition: opacity 0.15s ease; }
.support-fade-enter-from, .support-fade-leave-to { opacity: 0; }

@media (max-width: 520px) {
  .support-fab-label { display: none; }
  .support-row { grid-template-columns: 1fr; }
}
</style>
