
import type { GuideSession, GuideProgress, StoredAuth } from './types'


const KEYS = {
  AUTH: 'assetnode_auth',
  SESSION: 'assetnode_guide_session',
  PROGRESS: 'assetnode_guide_progress',
  SETTINGS: 'assetnode_settings',
} as const


export async function getAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(KEYS.AUTH)
  const auth = result[KEYS.AUTH] as StoredAuth | undefined
  if (!auth) return null

  if (new Date(auth.expiresAt) < new Date()) {
    await clearAuth()
    return null
  }
  return auth
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [KEYS.AUTH]: auth })
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(KEYS.AUTH)
}


export async function getSession(): Promise<GuideSession | null> {
  const result = await chrome.storage.session.get(KEYS.SESSION).catch(() =>
    chrome.storage.local.get(KEYS.SESSION)
  )
  return (result[KEYS.SESSION] as GuideSession) || null
}

export async function setSession(session: GuideSession): Promise<void> {
  await chrome.storage.session.set({ [KEYS.SESSION]: session }).catch(() =>
    chrome.storage.local.set({ [KEYS.SESSION]: session })
  )
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(KEYS.SESSION).catch(() =>
    chrome.storage.local.remove(KEYS.SESSION)
  )
}


export async function getAllProgress(): Promise<GuideProgress[]> {
  const result = await chrome.storage.local.get(KEYS.PROGRESS)
  return (result[KEYS.PROGRESS] as GuideProgress[]) || []
}

export async function getProgress(slug: string): Promise<GuideProgress | null> {
  const all = await getAllProgress()
  return all.find(p => p.slug === slug) || null
}

export async function updateProgress(progress: GuideProgress): Promise<void> {
  const all = await getAllProgress()
  const idx = all.findIndex(p => p.slug === progress.slug)
  if (idx >= 0) {
    all[idx] = progress
  } else {
    all.push(progress)
  }
  await chrome.storage.local.set({ [KEYS.PROGRESS]: all })
}


interface ExtensionSettings {
  apiBaseUrl: string
  showNerdMessages: boolean
  autoStartOnPortal: boolean
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: 'https://app.asset-node.com/api',
  showNerdMessages: true,
  autoStartOnPortal: true,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(KEYS.SETTINGS)
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] as Partial<ExtensionSettings>) }
}

export async function updateSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings()
  await chrome.storage.local.set({ [KEYS.SETTINGS]: { ...current, ...partial } })
}
