
import type { ApiGuideStepsResponse, GuideProgress, StoredAuth } from './types'
import { getAuth, getSettings } from './storage'


async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = await getAuth()
  if (!auth) throw new Error('Not authenticated')

  const settings = await getSettings()
  const url = `${settings.apiBaseUrl}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`,
      'X-AssetNode-Extension': '1.0.0',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`API ${response.status}: ${errorText}`)
  }

  if (response.status === 204) return {} as T

  return response.json()
}


export async function fetchGuideSteps(slug: string): Promise<ApiGuideStepsResponse | null> {
  try {
    return await apiRequest<ApiGuideStepsResponse>(`/guides/${slug}/extension-steps`)
  } catch (err) {
    console.warn(`[AssetNode Extension] Failed to fetch steps for ${slug}:`, err)
    return null
  }
}


export async function reportStepProgress(
  slug: string,
  currentStep: number,
  totalSteps: number
): Promise<void> {
  try {
    await apiRequest(`/guides/${slug}/progress`, {
      method: 'POST',
      body: JSON.stringify({ currentStep, totalSteps }),
    })
  } catch (err) {
    console.warn(`[AssetNode Extension] Failed to report progress:`, err)
  }
}

export async function reportGuideComplete(slug: string): Promise<void> {
  try {
    await apiRequest(`/guides/${slug}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
  } catch (err) {
    console.warn(`[AssetNode Extension] Failed to report completion:`, err)
  }
}

export async function fetchAllProgress(): Promise<GuideProgress[]> {
  try {
    const res = await apiRequest<{ guides: GuideProgress[] }>('/auth/guides')
    return res.guides || []
  } catch {
    return []
  }
}


export async function validateAuth(): Promise<boolean> {
  try {
    await apiRequest('/auth/me')
    return true
  } catch {
    return false
  }
}
