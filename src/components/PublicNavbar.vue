<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import AssetNodeLogo from './illustrations/AssetNodeLogo.vue'
import AnimatedBrand from './illustrations/AnimatedBrand.vue'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const mobileMenuOpen = ref(false)

const navVisible = ref(true)
const navScrolled = ref(false)
let lastScrollY = 0
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const currentY = window.scrollY
    navScrolled.value = currentY > 20
    if (currentY > 80) {
      navVisible.value = currentY < lastScrollY
    } else {
      navVisible.value = true
    }
    lastScrollY = currentY
    ticking = false
  })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const navLinks = [
  { label: 'Product', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Integrations', to: '/integrations', highlight: true },
  { label: 'Blog', to: '/blog' },
  { label: 'FAQ', to: '/faq' },
  { label: 'About', to: '/about' },
]

function isActive(to: string): boolean {
  if (to.startsWith('/#')) return route.path === '/'
  return route.path === to
}

function navigate(to: string) {
  mobileMenuOpen.value = false
  if (to.startsWith('/#')) {
    const anchor = to.substring(1)
    if (route.path === '/') {
      const el = document.querySelector(anchor)
      el?.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/').then(() => {
        setTimeout(() => {
          const el = document.querySelector(anchor)
          el?.scrollIntoView({ behavior: 'smooth' })
        }, 300)
      })
    }
  } else {
    router.push(to)
  }
}
</script>

<template>
  <nav
    class="pub-nav"
    :class="{
      'pub-nav--light': !themeStore.isDark,
      'pub-nav--hidden': !navVisible,
      'pub-nav--scrolled': navScrolled,
    }"
  >
    <div class="pub-nav-inner">
      <router-link to="/" class="pub-nav-brand">
        <AssetNodeLogo :size="28" />
        <span class="pub-nav-brand-text font-mono font-bold tracking-tight"><AnimatedBrand /></span>
      </router-link>

      <div class="pub-nav-links">
        <a
          v-for="link in navLinks"
          :key="link.to"
          class="pub-nav-link"
          :class="{
            'pub-nav-link--active': isActive(link.to),
            'pub-nav-link--highlight': link.highlight
          }"
          @click.prevent="navigate(link.to)"
        >
          {{ link.label }}
        </a>
      </div>

      <div class="pub-nav-actions">
        <a class="pub-nav-signin" @click="router.push('/sign-in')">Sign In</a>
        <Button
          label="Get Started"
          size="small"
          class="pub-nav-cta"
          @click="router.push('/sign-up')"
        />

        <button class="pub-nav-hamburger" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Menu">
          <i :class="mobileMenuOpen ? 'pi pi-times' : 'pi pi-bars'" />
        </button>
      </div>
    </div>

    <Transition name="pub-nav-mobile">
      <div v-if="mobileMenuOpen" class="pub-nav-mobile-menu">
        <a
          v-for="link in navLinks"
          :key="link.to"
          class="pub-nav-mobile-link"
          :class="{ 'pub-nav-mobile-link--active': isActive(link.to) }"
          @click.prevent="navigate(link.to)"
        >
          {{ link.label }}
        </a>
        <div class="pub-nav-mobile-divider" />
        <a class="pub-nav-mobile-link" @click="router.push('/sign-in'); mobileMenuOpen = false">Sign In</a>
        <a class="pub-nav-mobile-link pub-nav-mobile-link--cta" @click="router.push('/sign-up'); mobileMenuOpen = false">Get Started</a>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>

.pub-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  background: transparent;
  transition: transform 0.35s cubic-bezier(0.16,1,0.3,1),
              background 0.3s,
              border-color 0.3s,
              backdrop-filter 0.3s,
              box-shadow 0.3s;
  border-bottom: 1px solid transparent;
}

.pub-nav--scrolled {
  background: rgba(9, 9, 11, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom-color: rgba(255,255,255,0.06);
  box-shadow: 0 1px 32px rgba(0,0,0,0.2);
}

.pub-nav--hidden {
  background: transparent !important;
  border-bottom-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: blur(0px) !important;
  -webkit-backdrop-filter: blur(0px) !important;
  pointer-events: none;
}

.pub-nav-brand, .pub-nav-links, .pub-nav-actions {
  transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease;
}

.pub-nav--hidden .pub-nav-brand {
  transform: translateX(-60px) translateY(-10px) scale(0.9);
  opacity: 0;
}
.pub-nav--hidden .pub-nav-links {
  transform: translateY(-40px) scale(0.95);
  opacity: 0;
}
.pub-nav--hidden .pub-nav-actions {
  transform: translateX(60px) translateY(-10px) scale(0.9);
  opacity: 0;
}

.pub-nav--light.pub-nav--scrolled {
  background: rgba(255, 255, 255, 0.8);
  border-bottom-color: #e5e7eb;
  box-shadow: 0 1px 24px rgba(0,0,0,0.06);
}

.pub-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  position: relative;
}

.pub-nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.pub-nav-brand-text {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.pub-nav-links {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
}

.pub-nav-link {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--an-text-subtle);
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  text-decoration: none;
  white-space: nowrap;
}

.pub-nav-link:hover {
  color: var(--an-text-primary);
  background: rgba(255,255,255,0.06);
}
.pub-nav--light .pub-nav-link:hover {
  background: rgba(0,0,0,0.04);
}

.pub-nav-link--active {
  color: var(--an-text-primary);
  font-weight: 600;
}

.pub-nav-link--highlight {
  position: relative;
  color: var(--an-text-primary);
}

.pub-nav-link--highlight::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  animation: pub-nav-ring 2.5s ease-in-out infinite;
  pointer-events: none;
}

.pub-nav--light .pub-nav-link--highlight::after {
  border-color: rgba(59, 130, 246, 0.5);
}

.pub-nav-link--highlight:hover::after {
  animation: none;
  border-color: var(--an-cobalt);
  opacity: 1;
}

@keyframes pub-nav-ring {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.03); }
}

.pub-nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pub-nav-signin {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--an-text-subtle);
  cursor: pointer;
  padding: 7px 14px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}

.pub-nav-signin:hover {
  color: var(--an-text-primary);
  background: rgba(255,255,255,0.06);
}
.pub-nav--light .pub-nav-signin:hover {
  background: rgba(0,0,0,0.04);
}

.pub-nav-cta {
  font-weight: 700 !important;
  font-size: 12px !important;
}

.pub-nav-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: var(--an-text-primary);
  font-size: 1.1rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.pub-nav-hamburger:hover {
  background: var(--an-surface-elevated);
}

.pub-nav-mobile-menu {
  display: none;
  flex-direction: column;
  padding: 8px 16px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(9,9,11,0.95);
  backdrop-filter: blur(20px);
}

.pub-nav--light .pub-nav-mobile-menu {
  background: rgba(255,255,255,0.95);
  border-top-color: #e5e7eb;
}

.pub-nav-mobile-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--an-text-subtle);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  text-decoration: none;
}

.pub-nav-mobile-link:hover {
  color: var(--an-text-primary);
  background: var(--an-surface-elevated);
}

.pub-nav-mobile-link--active {
  color: var(--an-text-primary);
  font-weight: 600;
}

.pub-nav-mobile-link--cta {
  color: var(--an-emerald);
  font-weight: 700;
}

.pub-nav-mobile-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 4px 12px;
}

.pub-nav--light .pub-nav-mobile-divider {
  background: #e5e7eb;
}

.pub-nav-mobile-enter-active,
.pub-nav-mobile-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pub-nav-mobile-enter-from,
.pub-nav-mobile-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .pub-nav-links { display: none; }
  .pub-nav-signin { display: none; }
  .pub-nav-cta { display: none !important; }
  .pub-nav-theme-btn { display: inline-flex !important; }
  .pub-nav-hamburger { display: flex; }
  .pub-nav-mobile-menu { display: flex; }
}

@media (min-width: 769px) {
  .pub-nav-mobile-menu { display: none !important; }
}
</style>
