<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Navbar from './components/Layout/Navbar.vue'
import ChatWidget from './components/ChatWidget/ChatWidget.vue'
import GetStartedWizard from './components/GetStartedWizard.vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from './stores/theme'
import { useErrorHandler } from './composables/useErrorHandler'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const isPublicRoute = () => !route.meta.requiresAuth

const themeStore = useThemeStore()
themeStore.applyTheme()

const sidebarMini = ref(false)
const mobileMenuOpen = ref(false)
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileMenuOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => window.removeEventListener('resize', checkMobile))

const { errors, removeError } = useErrorHandler()
const toast = useToast()

watch(errors, (errs) => {
  for (const err of errs) {
    toast.add({
      severity: err.severity === 'warn' ? 'warn' : 'error',
      summary: err.severity === 'warn' ? 'Warning' : 'Error',
      detail: err.message,
      life: 6000
    })
    removeError(err.id)
  }
}, { deep: true })
</script>

<template>
  <div class="app-root">
    <Toast />

    <header v-if="!isPublicRoute() && isMobile" class="mobile-topbar">
      <button class="mobile-topbar-btn" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Menu">
        <i :class="mobileMenuOpen ? 'pi pi-times' : 'pi pi-bars'" />
      </button>
      <span class="mobile-topbar-title">AssetNode</span>
    </header>

    <Transition name="fade">
      <div
        v-if="mobileMenuOpen && isMobile"
        class="sidebar-overlay"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <Navbar
      v-if="!isPublicRoute()"
      :mobile-open="mobileMenuOpen"
      @update:mini="sidebarMini = $event"
      @close-mobile="mobileMenuOpen = false"
    />

    <main
      :class="{
        'main-with-sidebar': !isPublicRoute() && !isMobile,
        'main-with-sidebar--mini': !isPublicRoute() && !isMobile && sidebarMini,
        'main-mobile': !isPublicRoute() && isMobile
      }"
    >
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <ChatWidget />

    <GetStartedWizard v-if="!isPublicRoute()" mode="dialog" />
  </div>
</template>

<style>
.app-root {
  min-height: 100vh;
}

.main-with-sidebar {
  background: var(--an-bg-dark);
  margin-left: 256px;
  min-height: 100vh;
  transition: margin-left var(--transition-normal);
  width: calc(100vw - 256px);
  max-width: calc(100vw - 256px);
}

.main-with-sidebar--mini {
  margin-left: 72px;
  width: calc(100vw - 72px);
  max-width: calc(100vw - 72px);
}

.main-mobile {
  background: var(--an-bg-dark);
  min-height: 100vh;
  padding-top: 56px;
}

.mobile-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--an-surface-dark);
  border-bottom: 1px solid var(--an-border-dark);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  z-index: 1001;
}

.mobile-topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  color: var(--an-text-primary);
  font-size: 1.2rem;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.mobile-topbar-btn:hover {
  background: var(--an-surface-elevated);
}

.mobile-topbar-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--an-text-primary);
  letter-spacing: -0.01em;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
