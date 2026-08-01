import { describe, it, expect } from 'vitest'


type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'hw-manager-theme'

function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'system') return systemPrefersDark
  return mode === 'dark'
}

function getIcon(mode: ThemeMode): string {
  if (mode === 'light') return 'pi pi-sun'
  if (mode === 'dark') return 'pi pi-moon'
  return 'pi pi-desktop'
}

function getLabel(mode: ThemeMode): string {
  if (mode === 'light') return 'Light'
  if (mode === 'dark') return 'Dark'
  return 'System'
}

function toggleMode(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['light', 'dark', 'system']
  const idx = order.indexOf(current)
  return order[(idx + 1) % order.length]
}


describe('Theme Store — Pure Logic', () => {
  describe('isDark resolution', () => {
    it('dark mode → always dark', () => {
      expect(resolveIsDark('dark', false)).toBe(true)
      expect(resolveIsDark('dark', true)).toBe(true)
    })

    it('light mode → always light', () => {
      expect(resolveIsDark('light', false)).toBe(false)
      expect(resolveIsDark('light', true)).toBe(false)
    })

    it('system mode → follows OS preference (dark)', () => {
      expect(resolveIsDark('system', true)).toBe(true)
    })

    it('system mode → follows OS preference (light)', () => {
      expect(resolveIsDark('system', false)).toBe(false)
    })
  })

  describe('Icon getter', () => {
    it('light → sun icon', () => {
      expect(getIcon('light')).toBe('pi pi-sun')
    })

    it('dark → moon icon', () => {
      expect(getIcon('dark')).toBe('pi pi-moon')
    })

    it('system → desktop icon', () => {
      expect(getIcon('system')).toBe('pi pi-desktop')
    })
  })

  describe('Label getter', () => {
    it('light → Light', () => {
      expect(getLabel('light')).toBe('Light')
    })

    it('dark → Dark', () => {
      expect(getLabel('dark')).toBe('Dark')
    })

    it('system → System', () => {
      expect(getLabel('system')).toBe('System')
    })
  })

  describe('Toggle cycling', () => {
    it('light → dark', () => {
      expect(toggleMode('light')).toBe('dark')
    })

    it('dark → system', () => {
      expect(toggleMode('dark')).toBe('system')
    })

    it('system → light (wraps around)', () => {
      expect(toggleMode('system')).toBe('light')
    })

    it('full cycle returns to start', () => {
      let mode: ThemeMode = 'light'
      mode = toggleMode(mode)
      mode = toggleMode(mode)
      mode = toggleMode(mode)
      expect(mode).toBe('light')
    })
  })

  describe('Storage key', () => {
    it('should use "hw-manager-theme"', () => {
      expect(STORAGE_KEY).toBe('hw-manager-theme')
    })
  })
})
