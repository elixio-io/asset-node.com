<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../../stores/auth'
import api from '../../lib/api'
import { snapshotLog } from '../../composables/useClientLogBuffer'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: any
  confidence?: number
  suggestions?: string[]
  processing_time_ms?: number
  timestamp: Date
}

type AgentMode = 'general' | 'procurement' | 'inventory'
type PanelView = 'chat' | 'report'

const isOpen = ref(false)
const panelView = ref<PanelView>('chat')
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const chatBody = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const activeMode = ref<AgentMode>('general')
const hasNewMessage = ref(false)

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

const ticketSubject = ref('')
const ticketDescription = ref('')
const ticketCategory = ref<'bug' | 'feature' | 'question' | 'billing' | 'other'>('bug')
const ticketPriority = ref<'low' | 'medium' | 'high' | 'critical'>('medium')
const ticketSubmitting = ref(false)

const ticketCategories = computed(() => [
  { value: 'bug', label: t('support.category.bug') },
  { value: 'feature', label: t('support.category.feature') },
  { value: 'question', label: t('support.category.question') },
  { value: 'billing', label: t('support.category.billing') },
  { value: 'other', label: t('support.category.other') },
])

const ticketPriorities = computed(() => [
  { value: 'low', label: t('support.priority.low') },
  { value: 'medium', label: t('support.priority.medium') },
  { value: 'high', label: t('support.priority.high') },
  { value: 'critical', label: t('support.priority.critical') },
])

function resetTicket() {
  ticketSubject.value = ''
  ticketDescription.value = ''
  ticketCategory.value = 'bug'
  ticketPriority.value = 'medium'
}

async function submitTicket() {
  if (ticketSubject.value.trim().length < 3) {
    toast.add({ severity: 'warn', summary: t('support.toast.invalid'), detail: t('support.validation.subjectShort'), life: 4000 })
    return
  }
  if (ticketDescription.value.trim().length < 10) {
    toast.add({ severity: 'warn', summary: t('support.toast.invalid'), detail: t('support.validation.descriptionShort'), life: 4000 })
    return
  }
  ticketSubmitting.value = true
  try {
    const res = await api.post('/support/tickets', {
      subject: ticketSubject.value.trim(),
      description: ticketDescription.value.trim(),
      category: ticketCategory.value,
      priority: ticketPriority.value,
      metadata: {
        url: route.path.slice(0, 500),
        userAgent: navigator.userAgent.slice(0, 500),
        appVersion: String((import.meta as any).env?.VITE_APP_VERSION || 'dev').slice(0, 50),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        clientLog: snapshotLog(),
      },
    })
    const ref = res.data?.ticketRef || ''
    toast.add({ severity: 'success', summary: t('support.toast.sent'), detail: t('support.toast.sentDetail', { ref }), life: 6000 })
    resetTicket()
    panelView.value = 'chat'
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('support.toast.failed'), detail: err?.response?.data?.error || t('support.toast.failedDetail'), life: 6000 })
  } finally {
    ticketSubmitting.value = false
  }
}

const apiHistory = computed(() =>
  messages.value
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))
)

const modes: { key: AgentMode; label: string; icon: string }[] = [
  { key: 'general', label: 'Help', icon: 'pi pi-question-circle' },
  { key: 'procurement', label: 'Sourcing', icon: 'pi pi-shopping-cart' },
  { key: 'inventory', label: 'Inventory', icon: 'pi pi-box' },
]


function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function scrollToBottom() {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight
    }
  })
}

function toggleChat() {
  isOpen.value = !isOpen.value
  hasNewMessage.value = false
  if (isOpen.value) {
    if (messages.value.length === 0) {
      addWelcomeMessage()
    }
    nextTick(() => inputRef.value?.focus())
  }
}

function handleOpenReportIssue() {
  isOpen.value = true
  panelView.value = 'report'
  hasNewMessage.value = false
}

onMounted(() => {
  window.addEventListener('open-report-issue', handleOpenReportIssue)
})

onBeforeUnmount(() => {
  window.removeEventListener('open-report-issue', handleOpenReportIssue)
})

function addWelcomeMessage() {
  messages.value.push({
    id: generateId(),
    role: 'assistant',
    content: `Hi! 👋 I'm your **AssetNode AI assistant**.\n\nI can help with:\n📋 **Finding assets** — "Show me all MacBooks"\n📊 **Procurement sourcing** — Paste a purchase request\n🔧 **Inventory questions** — "How many licenses expire this month?"\n\nSwitch modes above or just ask me anything!`,
    suggestions: ['What can you do?', 'Help me find a device', 'Start a purchase request'],
    timestamp: new Date()
  })
}

function switchMode(mode: AgentMode) {
  activeMode.value = mode
}

function getSystemContext(): string {
  const page = route.name as string || 'unknown'
  return `User is currently on the "${page}" page. Mode: ${activeMode.value}. `
}

async function sendMessage(text?: string) {
  const msg = (text || inputText.value).trim()
  if (!msg || isLoading.value) return

  messages.value.push({
    id: generateId(),
    role: 'user',
    content: msg,
    timestamp: new Date()
  })

  inputText.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    const res = await api.post('/procurement/agent/chat', {
      message: msg,
      history: apiHistory.value.slice(-20),
      context: {
        mode: activeMode.value,
        current_page: route.name,
        system_hint: getSystemContext()
      }
    })

    const data = res.data?.data || res.data

    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: data.reply || 'I processed your request.',
      data: data.data || null,
      confidence: data.confidence,
      suggestions: data.suggestions || [],
      processing_time_ms: data.processing_time_ms,
      timestamp: new Date()
    })
  } catch {
    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: '⚠️ I\'m having trouble connecting. The AI backend might be starting up — please try again in a moment.',
      suggestions: ['Try again'],
      timestamp: new Date()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
    if (!isOpen.value) {
      hasNewMessage.value = true
    }
  }
}

function handleSuggestion(suggestion: string) {
  sendMessage(suggestion)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function formatMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'var(--an-emerald)'
  if (c >= 0.5) return 'var(--an-orange)'
  return 'var(--an-red)'
}

function clearChat() {
  messages.value = []
  addWelcomeMessage()
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

import { onMounted, onUnmounted } from 'vue'
onMounted(() => document.addEventListener('keydown', handleGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown))
</script>

<template>
  <div v-if="isAuthenticated" class="chat-widget">
    <button
      class="chat-fab"
      :class="{ 'chat-fab--open': isOpen }"
      @click="toggleChat"
      :aria-label="isOpen ? 'Close assistant' : 'Open assistant'"
    >
      <span class="chat-fab-glow" />
      <i :class="isOpen ? 'pi pi-times' : 'pi pi-comment'" class="chat-fab-icon" />
      <span v-if="hasNewMessage && !isOpen" class="chat-fab-badge" />
    </button>

    <Transition name="chat-panel">
      <div v-if="isOpen" class="chat-panel">
        <div class="chat-panel-header">
          <div class="chat-panel-header-left">
            <div class="chat-avatar">
              <i class="pi pi-sparkles" />
            </div>
            <div>
              <div class="chat-panel-title">AssetNode AI</div>
              <div class="chat-panel-status">
                <span :class="['status-dot', isLoading ? 'status-dot--thinking' : 'status-dot--online']" />
                {{ isLoading ? t('chat.thinking') : t('chat.online') }}
              </div>
            </div>
          </div>
          <div class="chat-panel-actions">
            <button class="chat-action-btn" @click="clearChat" title="Clear chat">
              <i class="pi pi-trash" />
            </button>
            <button class="chat-action-btn" @click="isOpen = false" title="Close">
              <i class="pi pi-minus" />
            </button>
          </div>
        </div>

        <div class="chat-view-tabs">
          <button :class="['chat-view-tab', { 'chat-view-tab--active': panelView === 'chat' }]" @click="panelView = 'chat'">
            <i class="pi pi-comments" /> {{ t('chat.tab') }}
          </button>
          <button :class="['chat-view-tab', { 'chat-view-tab--active': panelView === 'report' }]" @click="panelView = 'report'">
            <i class="pi pi-flag" /> {{ t('support.button.label') }}
          </button>
        </div>

        <template v-if="panelView === 'chat'">
          <div class="chat-modes">
            <button
              v-for="mode in modes"
              :key="mode.key"
              :class="['chat-mode-btn', { 'chat-mode-btn--active': activeMode === mode.key }]"
              @click="switchMode(mode.key)"
            >
              <i :class="mode.icon" />
              {{ mode.label }}
            </button>
          </div>

          <div ref="chatBody" class="chat-panel-body">
            <div
              v-for="msg in messages"
              :key="msg.id"
              :class="['chat-msg', `chat-msg--${msg.role}`]"
            >
              <div v-if="msg.role === 'assistant'" class="chat-msg-avatar">
                <i class="pi pi-sparkles" />
              </div>

              <div :class="['chat-msg-bubble', `chat-msg-bubble--${msg.role}`]">
                <div class="chat-msg-text" v-html="formatMarkdown(msg.content)" />

                <div v-if="msg.confidence != null && msg.confidence > 0" class="chat-confidence">
                  <div class="chat-confidence-bar">
                    <div class="chat-confidence-fill" :style="{ width: `${msg.confidence * 100}%`, background: confidenceColor(msg.confidence) }" />
                  </div>
                  <span class="chat-confidence-label">{{ Math.round(msg.confidence * 100) }}%</span>
                </div>

                <div v-if="msg.data?.type === 'pipeline_result'" class="chat-data-card">
                  <div class="chat-data-row">
                    <span class="chat-data-label">Supplier</span>
                    <span class="chat-data-value">{{ msg.data.payload?.recommendation?.recommended_supplier_name || '—' }}</span>
                  </div>
                  <div class="chat-data-row">
                    <span class="chat-data-label">Score</span>
                    <span class="chat-data-value">{{ msg.data.payload?.recommendation?.composite_score || '—' }}</span>
                  </div>
                  <div class="chat-data-row">
                    <span class="chat-data-label">Budget</span>
                    <span :class="['chat-data-value', msg.data.payload?.recommendation?.within_budget ? 'text-ok' : 'text-warn']">
                      {{ msg.data.payload?.recommendation?.within_budget ? '✅ Within' : '⚠️ Over' }}
                    </span>
                  </div>
                </div>

                <div v-if="msg.suggestions?.length" class="chat-suggestions">
                  <button v-for="(s, idx) in msg.suggestions" :key="idx" class="chat-suggestion-btn" @click="handleSuggestion(s)" :disabled="isLoading">
                    {{ s }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isLoading" class="chat-msg chat-msg--assistant">
              <div class="chat-msg-avatar"><i class="pi pi-sparkles" /></div>
              <div class="chat-msg-bubble chat-msg-bubble--assistant">
                <div class="chat-typing"><span /><span /><span /></div>
              </div>
            </div>
          </div>

          <div class="chat-panel-footer">
            <input ref="inputRef" v-model="inputText" @keydown="handleKeydown" placeholder="Ask anything..." :disabled="isLoading" class="chat-input" />
            <button class="chat-send-btn" @click="sendMessage()" :disabled="!inputText.trim() || isLoading">
              <i :class="isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-send'" />
            </button>
          </div>
        </template>

        <template v-if="panelView === 'report'">
          <div class="chat-panel-body report-body">
            <div class="report-form">
              <div class="report-field">
                <label>{{ t('support.field.subject') }}</label>
                <input v-model="ticketSubject" :placeholder="t('support.field.subjectPlaceholder')" class="report-input" />
              </div>

              <div class="report-row">
                <div class="report-field">
                  <label>{{ t('support.field.category') }}</label>
                  <select v-model="ticketCategory" class="report-select">
                    <option v-for="c in ticketCategories" :key="c.value" :value="c.value">{{ c.label }}</option>
                  </select>
                </div>
                <div class="report-field">
                  <label>{{ t('support.field.priority') }}</label>
                  <select v-model="ticketPriority" class="report-select">
                    <option v-for="p in ticketPriorities" :key="p.value" :value="p.value">{{ p.label }}</option>
                  </select>
                </div>
              </div>

              <div class="report-field">
                <label>{{ t('support.field.description') }}</label>
                <textarea v-model="ticketDescription" :placeholder="t('support.field.descriptionPlaceholder')" rows="6" class="report-textarea" />
              </div>

              <div class="report-hint">
                <i class="pi pi-info-circle" />
                {{ t('support.hint') }}
              </div>

              <button class="report-submit" :disabled="ticketSubmitting" @click="submitTicket">
                <i :class="ticketSubmitting ? 'pi pi-spin pi-spinner' : 'pi pi-send'" />
                {{ ticketSubmitting ? t('support.submitting') : t('support.submit') }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: var(--font-family, 'Inter', sans-serif);
}

.chat-fab {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #4f6ef7, #7c3aed);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 24px rgba(79, 110, 247, 0.35), 0 1px 3px rgba(0,0,0,0.2);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.chat-fab-icon {
  font-size: 20px;
  position: relative;
  z-index: 2;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-fab-glow {
  position: absolute;
  inset: -8px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(79,110,247,0.4), rgba(124,58,237,0.4));
  filter: blur(16px);
  opacity: 0;
  transition: opacity 0.4s;
  z-index: 0;
}

.chat-fab:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 8px 32px rgba(79, 110, 247, 0.45), 0 2px 8px rgba(0,0,0,0.25);
}

.chat-fab:hover .chat-fab-glow { opacity: 1; }
.chat-fab:hover .chat-fab-icon { transform: scale(1.1); }

.chat-fab--open {
  background: var(--an-surface-elevated, #1e2030);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  border-radius: 14px;
}

.chat-fab--open .chat-fab-glow { display: none; }

.chat-fab--open:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.chat-fab-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--an-red, #ef4444);
  border: 2px solid var(--an-bg-dark, #0f1117);
  animation: pulse-badge 2s infinite;
  z-index: 3;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

.chat-view-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  background: var(--an-surface-dark, #161824);
  border-bottom: 1px solid var(--an-border-dark, #1e2030);
  flex-shrink: 0;
}

.chat-view-tab {
  flex: 1;
  padding: 7px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--an-text-subtle, #7c819b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.chat-view-tab:hover { background: rgba(255,255,255,0.04); color: var(--an-text-primary, #e8eaf0); }
.chat-view-tab--active { background: rgba(79,110,247,0.15); color: var(--an-cobalt, #4f6ef7); }
.chat-view-tab i { font-size: 13px; }

.report-body { padding: 16px 14px; }
.report-form { display: flex; flex-direction: column; gap: 14px; }
.report-field { display: flex; flex-direction: column; gap: 5px; }
.report-field label {
  font-size: 11px; font-weight: 700; color: var(--an-text-subtle, #7c819b);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.report-input, .report-select, .report-textarea {
  padding: 9px 12px; border-radius: 10px;
  border: 1px solid var(--an-border-dark, #1e2030);
  background: var(--an-bg-dark, #0f1117);
  color: var(--an-text-primary, #e8eaf0);
  font-size: 13px; font-family: inherit;
  outline: none; transition: border-color 0.2s;
}
.report-input:focus, .report-select:focus, .report-textarea:focus { border-color: var(--an-cobalt, #4f6ef7); }
.report-textarea { resize: vertical; min-height: 100px; }
.report-select { appearance: auto; cursor: pointer; }
.report-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.report-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--an-text-muted, #4a4e6a);
  padding: 8px 10px; border-radius: 8px;
  background: rgba(79,110,247,0.06); border: 1px solid rgba(79,110,247,0.1);
}
.report-hint i { font-size: 12px; color: var(--an-cobalt, #4f6ef7); flex-shrink: 0; }

.report-submit {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 16px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, var(--an-cobalt, #4f6ef7), #3b82f6);
  color: white; font-size: 13px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: all 0.2s;
}
.report-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,110,247,0.35); }
.report-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-panel {
  position: absolute;
  bottom: 68px;
  right: 0;
  width: 380px;
  height: 560px;
  background: var(--an-bg-dark, #0f1117);
  border: 1px solid var(--an-border-dark, #1e2030);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
}

.chat-panel-enter-active {
  animation: panelIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.chat-panel-leave-active {
  animation: panelIn 0.2s ease-in reverse;
}

@keyframes panelIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.chat-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--an-surface-dark, #161824);
  border-bottom: 1px solid var(--an-border-dark, #1e2030);
  flex-shrink: 0;
}

.chat-panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--an-cobalt, #4f6ef7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: white;
}

.chat-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--an-text-primary, #e8eaf0);
}

.chat-panel-status {
  font-size: 11px;
  color: var(--an-text-subtle, #7c819b);
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot--online {
  background: var(--an-emerald, #34d399);
}

.status-dot--thinking {
  background: var(--an-orange, #f59e0b);
  animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.chat-panel-actions {
  display: flex;
  gap: 4px;
}

.chat-action-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--an-text-subtle, #7c819b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s;
}

.chat-action-btn:hover {
  background: var(--an-surface-elevated, #1e2030);
  color: var(--an-text-primary, #e8eaf0);
}

.chat-modes {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: var(--an-surface-dark, #161824);
  border-bottom: 1px solid var(--an-border-dark, #1e2030);
  flex-shrink: 0;
}

.chat-mode-btn {
  flex: 1;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--an-text-subtle, #7c819b);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: all 0.15s;
}

.chat-mode-btn:hover {
  background: var(--an-surface-elevated, #1e2030);
  color: var(--an-text-primary, #e8eaf0);
}

.chat-mode-btn--active {
  background: var(--an-cobalt, #4f6ef7);
  color: white;
  border-color: var(--an-cobalt, #4f6ef7);
}

.chat-mode-btn i {
  font-size: 12px;
}

.chat-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-panel-body::-webkit-scrollbar { width: 4px; }
.chat-panel-body::-webkit-scrollbar-track { background: transparent; }
.chat-panel-body::-webkit-scrollbar-thumb { background: var(--an-border-dark, #1e2030); border-radius: 2px; }

.chat-msg {
  display: flex;
  gap: 8px;
  max-width: 92%;
  animation: msgIn 0.25s ease-out;
}

.chat-msg--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.chat-msg--assistant {
  align-self: flex-start;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--an-surface-elevated, #1e2030);
  border: 1px solid var(--an-border-subtle, #2a2d3e);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--an-cobalt, #4f6ef7);
  flex-shrink: 0;
  margin-top: 2px;
}

.chat-msg-bubble {
  border-radius: 14px;
  padding: 10px 14px;
  line-height: 1.5;
  font-size: 13px;
}

.chat-msg-bubble--assistant {
  background: var(--an-surface-elevated, #1e2030);
  border: 1px solid var(--an-border-dark, #1e2030);
  border-top-left-radius: 4px;
  color: var(--an-text-primary, #e8eaf0);
}

.chat-msg-bubble--user {
  background: var(--an-cobalt, #4f6ef7);
  color: white;
  border-top-right-radius: 4px;
}

.chat-msg-text :deep(strong) {
  font-weight: 600;
}

.chat-msg-text :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

.chat-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.chat-confidence-bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--an-surface-dark, #161824);
  overflow: hidden;
}

.chat-confidence-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}

.chat-confidence-label {
  font-size: 10px;
  color: var(--an-text-subtle, #7c819b);
  font-weight: 500;
}

.chat-data-card {
  margin-top: 10px;
  padding: 10px;
  background: var(--an-surface-dark, #161824);
  border-radius: 10px;
  border: 1px solid var(--an-border-subtle, #2a2d3e);
}

.chat-data-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
}

.chat-data-row + .chat-data-row {
  border-top: 1px solid var(--an-border-dark, #1e2030);
}

.chat-data-label {
  color: var(--an-text-subtle, #7c819b);
}

.chat-data-value {
  font-weight: 600;
  color: var(--an-text-primary, #e8eaf0);
}

.text-ok { color: var(--an-emerald, #34d399); }
.text-warn { color: var(--an-orange, #f59e0b); }

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.chat-suggestion-btn {
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid var(--an-border-subtle, #2a2d3e);
  background: var(--an-surface-dark, #161824);
  color: var(--an-text-primary, #e8eaf0);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.chat-suggestion-btn:hover:not(:disabled) {
  background: var(--an-cobalt, #4f6ef7);
  border-color: var(--an-cobalt, #4f6ef7);
  color: white;
}

.chat-suggestion-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--an-text-subtle, #7c819b);
  animation: typing 1.4s infinite both;
}

.chat-typing span:nth-child(2) { animation-delay: 0.2s; }
.chat-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.chat-panel-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--an-surface-dark, #161824);
  border-top: 1px solid var(--an-border-dark, #1e2030);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--an-border-dark, #1e2030);
  background: var(--an-bg-dark, #0f1117);
  color: var(--an-text-primary, #e8eaf0);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input::placeholder {
  color: var(--an-text-muted, #4a4e6a);
}

.chat-input:focus {
  border-color: var(--an-cobalt, #4f6ef7);
}

.chat-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: none;
  background: var(--an-cobalt, #4f6ef7);
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.chat-send-btn:hover:not(:disabled) {
  background: #3d5ce5;
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .chat-panel {
    width: calc(100vw - 32px);
    height: calc(100vh - 120px);
    right: -8px;
    bottom: 64px;
    border-radius: 12px;
  }
}
</style>
