<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { GuideProgress, GuideSession, PortalId } from '../lib/types'
import { PORTALS, getCategoryLabel } from '../lib/portals'
import { getAuth, clearAuth } from '../lib/storage'


const isAuthenticated = ref(false)
const userEmail = ref('')
const session = ref<GuideSession | null>(null)
const progress = ref<GuideProgress[]>([])
const resumeStep = ref<number | null>(null)
const loading = ref(true)


interface GuideItem {
  id: PortalId
  name: string
  category: string
  categoryLabel: string
  icon: string
  status: 'completed' | 'in-progress' | 'not-started'
  currentStep: number
  totalSteps: number
}

const categories = computed(() => {
  const cats = new Map<string, GuideItem[]>()

  for (const [id, portal] of Object.entries(PORTALS)) {
    const prog = progress.value.find(p => p.slug === id)
    const item: GuideItem = {
      id: id as PortalId,
      name: portal.name,
      category: portal.category,
      categoryLabel: getCategoryLabel(portal.category),
      icon: portal.icon,
      status: prog?.completed ? 'completed' : prog?.currentStep ? 'in-progress' : 'not-started',
      currentStep: prog?.currentStep || 0,
      totalSteps: prog?.totalSteps || 0,
    }

    const label = getCategoryLabel(portal.category)
    if (!cats.has(label)) cats.set(label, [])
    cats.get(label)!.push(item)
  }

  return cats
})


async function startGuide(slug: PortalId, autopilot = false, startAt?: number) {
  try {
    await chrome.runtime.sendMessage({ type: 'START_GUIDE', slug, autopilot, startAt })
    await refreshState()
  } catch (err) {
    console.error('Failed to start guide:', err)
  }
}

async function stopGuide() {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_GUIDE' })
    session.value = null
  } catch (err) {
    console.error('Failed to stop guide:', err)
  }
}

function openSettings() {
  chrome.tabs.create({ url: 'https://app.asset-node.com/settings' })
}

function openAssetNode() {
  chrome.tabs.create({ url: 'https://app.asset-node.com' })
}

async function logout() {
  await clearAuth()
  isAuthenticated.value = false
  userEmail.value = ''
}


async function refreshState() {
  try {
    const sessionRes = await chrome.runtime.sendMessage({ type: 'GET_SESSION' })
    session.value = sessionRes?.session || null

    const progressRes = await chrome.runtime.sendMessage({ type: 'GET_ALL_PROGRESS' })
    progress.value = progressRes?.progress || []
  } catch {
  }
}

onMounted(async () => {
  const auth = await getAuth()
  if (auth) {
    isAuthenticated.value = true
    userEmail.value = auth.email || 'Connected'
  }

  if (!isAuthenticated.value) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tab?.url || ''
      const supportedDomains = [
        'asset-node.com',
        'localhost:5173',
        'localhost:3001',
        'portal.azure.com',
        'jamfcloud.com',
        'kandji.io',
        'personio.de',
        'bamboohr.com',
        'hibob.com',
        'console.cloud.google.com',
        'admin.google.com',
        'mosyle.com',
        'onelogin.com',
        'okta.com',
        'jumpcloud.com',
      ]
      const isSupported = supportedDomains.some(d => url.includes(d))
      if (isSupported) {
        isAuthenticated.value = true
        userEmail.value = 'Connected via page'
      }
    } catch {
    }
  }

  await refreshState()

  if (session.value && !isAuthenticated.value) {
    isAuthenticated.value = true
    userEmail.value = 'Guide active'
  }

  loading.value = false
})

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅'
    case 'in-progress': return '⏳'
    default: return '○'
  }
}
</script>

<template>
  <div class="popup">
    <div class="header">
      <div class="header-brand">
        <span class="nerd-emoji">🤓</span>
        <div>
          <div class="header-title">AssetNode Setup Guide</div>
          <div class="header-subtitle" v-if="isAuthenticated">{{ userEmail }}</div>
          <div class="header-subtitle" v-else>Not connected</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <span>Loading...</span>
    </div>

    <div v-else-if="!isAuthenticated" class="auth-prompt">
      <p>Open AssetNode to connect the extension.</p>
      <button class="btn btn-primary" @click="openAssetNode">
        Open AssetNode
      </button>
    </div>

    <div v-else-if="session" class="active-session">
      <div class="session-card">
        <div class="session-info">
          <span class="session-icon">🔄</span>
          <div>
            <div class="session-title">Guide in progress</div>
            <div class="session-detail">
              {{ PORTALS[session.slug]?.name || session.slug }}
              — Step {{ session.currentStep + 1 }} of {{ session.totalSteps }}
            </div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" @click="stopGuide">Stop</button>
      </div>
    </div>

    <div v-else class="guide-list">
      <div v-for="[category, items] in categories" :key="category" class="category-group">
        <div class="category-header">{{ category }}</div>
        <div
          v-for="item in items"
          :key="item.id"
          class="guide-item"
          :class="{ completed: item.status === 'completed' }"
        >
          <span class="guide-status">{{ statusIcon(item.status) }}</span>
          <span class="guide-name">{{ item.name }}</span>
          <span v-if="item.status === 'in-progress'" class="guide-progress">
            {{ item.currentStep }}/{{ item.totalSteps }}
          </span>
        </div>
      </div>
    </div>

    <div class="footer">
      <button class="btn btn-ghost" @click="openSettings">
        ⚙️ Settings
      </button>
      <button v-if="isAuthenticated" class="btn btn-ghost" @click="logout">
        Disconnect
      </button>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.popup {
  width: 340px;
  max-height: 500px;
  background: #111318;
  color: #e0e0e0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  overflow-y: auto;
}

.header {
  padding: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nerd-emoji {
  font-size: 28px;
}

.header-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.header-subtitle {
  font-size: 12px;
  color: #8b8d93;
  margin-top: 2px;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #8b8d93;
}

.auth-prompt {
  padding: 24px 16px;
  text-align: center;
}

.auth-prompt p {
  color: #8b8d93;
  margin-bottom: 16px;
}

.active-session {
  padding: 12px;
}

.session-card {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-card.session-autopilot {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.session-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.session-icon {
  font-size: 20px;
}

.session-title {
  font-weight: 600;
  font-size: 13px;
  color: #a5b4fc;
}

.session-detail {
  font-size: 11px;
  color: #8b8d93;
  margin-top: 2px;
}

.guide-list {
  padding: 8px;
}

.category-group {
  margin-bottom: 4px;
}

.category-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6366f1;
  padding: 8px 8px 4px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.guide-item:hover:not(.completed) {
  background: rgba(255, 255, 255, 0.06);
}

.guide-item.completed {
  opacity: 0.6;
  cursor: default;
}

.guide-status {
  font-size: 14px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.guide-name {
  flex: 1;
  font-weight: 500;
}

.guide-progress {
  font-size: 11px;
  color: #8b8d93;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.guide-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}

.btn-xs {
  font-size: 14px;
  padding: 4px 6px;
  border-radius: 6px;
  line-height: 1;
  background: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-guide:hover {
  background: rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
}

.btn-autopilot:hover {
  background: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.footer {
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
}

.btn {
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  padding: 10px 20px;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  padding: 6px 12px;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.25);
}

.btn-sm {
  font-size: 12px;
  padding: 6px 10px;
}

.btn-ghost {
  background: none;
  color: #8b8d93;
  padding: 6px 10px;
  font-size: 12px;
}

.btn-ghost:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.06);
}

.session-resume {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0 0 10px 10px;
  margin-top: -4px;
}

.resume-label {
  font-size: 11px;
  color: #8b8d93;
  white-space: nowrap;
}

.resume-input {
  width: 48px;
  padding: 3px 6px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #e0e0e0;
  text-align: center;
}

.resume-input:focus {
  outline: none;
  border-color: #6366f1;
}
</style>
