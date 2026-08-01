import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { getAccessToken, getRefreshToken } from '../../lib/api'
import { useAuthStore } from '../auth'

describe('auth store session rotation', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('installs replacement tokens and user data returned by a sensitive auth change', () => {
    const store = useAuthStore()
    store.acceptSession({
      accessToken: 'replacement-access',
      refreshToken: 'replacement-refresh',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
        companyName: 'Example',
        orgId: 'org-1',
        role: 'admin',
        onboardingCompleted: true
      }
    })

    expect(getAccessToken()).toBe('replacement-access')
    expect(getRefreshToken()).toBe('replacement-refresh')
    expect(store.user?.id).toBe('user-1')
    expect(store.isAuthenticated).toBe(true)
  })
})
