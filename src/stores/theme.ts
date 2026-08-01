import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'hw-manager-theme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'dark')
  const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches
  })

  const isDark = computed(() => {
    if (mode.value === 'system') return systemPrefersDark.value
    return mode.value === 'dark'
  })

  const icon = computed(() => {
    if (mode.value === 'light') return 'pi pi-sun'
    if (mode.value === 'dark') return 'pi pi-moon'
    return 'pi pi-desktop'
  })

  const label = computed(() => {
    if (mode.value === 'light') return 'Light'
    if (mode.value === 'dark') return 'Dark'
    return 'System'
  })

  function setMode(newMode: ThemeMode) {
    mode.value = newMode
    localStorage.setItem(STORAGE_KEY, newMode)
  }

  function toggle() {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(mode.value)
    setMode(order[(idx + 1) % order.length])
  }

  function applyTheme() {
    watch(isDark, (dark) => {
      if (dark) {
        document.documentElement.classList.add('p-dark')
      } else {
        document.documentElement.classList.remove('p-dark')
      }
    }, { immediate: true })
  }

  return {
    mode,
    isDark,
    icon,
    label,
    setMode,
    toggle,
    applyTheme
  }
})
