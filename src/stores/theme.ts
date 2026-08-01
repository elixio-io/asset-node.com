import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'hw-manager-theme'

/**
 * Dark is pinned on.
 *
 * The light theme is NOT removed — every `--light` class and stylesheet is
 * still in place — it is simply unfinished, so shipping a switch that lands
 * users on a half-styled UI is worse than offering no switch at all. Flip this
 * to false once the light pass is done and the store starts resolving the
 * stored mode again; the toggle buttons are the only thing that needs adding
 * back (see PublicNavbar.vue / Layout/Navbar.vue).
 */
const FORCE_DARK = true

export const useThemeStore = defineStore('theme', () => {
  const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'dark'
  const mode = ref<ThemeMode>(FORCE_DARK ? 'dark' : stored)
  const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches
  })

  const isDark = computed(() => {
    if (FORCE_DARK) return true
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
    if (FORCE_DARK) return
    mode.value = newMode
    localStorage.setItem(STORAGE_KEY, newMode)
  }

  function toggle() {
    if (FORCE_DARK) return
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
