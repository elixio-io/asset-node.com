import { createI18n } from 'vue-i18n'
import en from './en.json'
import de from './de.json'
import fr from './fr.json'
import es from './es.json'
import it from './it.json'
import nl from './nl.json'
import pl from './pl.json'
import pt from './pt.json'

export type SupportedLocale = 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'pl' | 'pt'

export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'pt', label: 'Português' }
]

const LOCALE_CODES = SUPPORTED_LOCALES.map(l => l.code) as string[]

const STORAGE_KEY = 'hw-manager-locale'

function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && LOCALE_CODES.includes(stored)) return stored as SupportedLocale

  const browserLang = navigator.language.split('-')[0]
  if (LOCALE_CODES.includes(browserLang)) return browserLang as SupportedLocale
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'en',
  messages: { en, de, fr, es, it, nl, pl, pt }
})

export function setLocale(locale: SupportedLocale) {
  (i18n.global.locale as any).value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

export function getLocale(): SupportedLocale {
  return (i18n.global.locale as any).value as SupportedLocale
}

export function toggleLocale() {
  const current = getLocale()
  const idx = LOCALE_CODES.indexOf(current)
  const next = LOCALE_CODES[(idx + 1) % LOCALE_CODES.length] as SupportedLocale
  setLocale(next)
}

export default i18n
