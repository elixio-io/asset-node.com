import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { setTokens, clearTokens, getAccessToken } from '../lib/api'
import type { UserRole } from '../types/user'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  companyName: string
  orgId: string
  department?: string
  role: UserRole
  permissions?: string[]
  ssoOnly?: boolean
  onboardingCompleted: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const mfaChallenge = ref<string | null>(null)

  function acceptSession(data: { accessToken: string; refreshToken: string; user: AuthUser }) {
    setTokens(data.accessToken, data.refreshToken)
    user.value = data.user
    mfaChallenge.value = null
  }

  const isAuthenticated = computed(() => !!user.value && !!getAccessToken())
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superAdmin')
  const isManager = computed(() => ['manager', 'admin', 'superAdmin'].includes(user.value?.role || ''))
  const isSuperAdmin = computed(() => user.value?.role === 'superAdmin')
  const userRole = computed(() => user.value?.role)
  const canCustomizeColumns = computed(() => hasPermission('customize_columns'))

  async function register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    companyName: string,
    department?: string
  ): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        companyName,
        department
      })

      acceptSession(response.data)
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Registration failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/auth/login', { email, password })
      if (response.data.mfaRequired) {
        mfaChallenge.value = response.data.challengeToken
        return false
      }
      acceptSession(response.data)
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function completeMfa(value: string, useRecoveryCode = false): Promise<boolean> {
    if (!mfaChallenge.value) {
      error.value = 'Sign in with your password first'
      return false
    }
    loading.value = true
    error.value = null
    try {
      const response = await api.post('/auth/login/mfa', {
        challengeToken: mfaChallenge.value,
        ...(useRecoveryCode ? { recoveryCode: value } : { code: value })
      })
      acceptSession(response.data)
      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Verification failed'
      return false
    } finally {
      loading.value = false
    }
  }

async function loginWithPasskey(): Promise<boolean> {
  loading.value = true
  error.value = null

  try {
    const [{ data }, { startAuthentication }] = await Promise.all([
      api.post('/auth/passkeys/login/options', {}),
      import('@simplewebauthn/browser'),
    ])

    const response = await startAuthentication({
      optionsJSON: data.options,
    })

    const verification = await api.post(
      '/auth/passkeys/login/verify',
      {
        ceremonyToken: data.ceremonyToken,
        response,
      },
    )

    acceptSession(verification.data)
    return true
  } catch (err: any) {
    error.value =
      err?.name === 'NotAllowedError'
        ? 'Passkey sign-in was cancelled or timed out'
        : err.response?.data?.error || 'Passkey sign-in failed'

    return false
  } finally {
    loading.value = false
  }
}

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {})
    } catch {
    } finally {
      user.value = null
      mfaChallenge.value = null
      clearTokens()
    }
  }

  async function fetchCurrentUser(): Promise<boolean> {
    if (!getAccessToken()) return false

    try {
      const response = await api.get('/auth/me')
      user.value = response.data
      return true
    } catch {
      user.value = null
      clearTokens()
      return false
    }
  }

  function hasRole(...roles: UserRole[]): boolean {
    if (!user.value) return false
    if (user.value.role === 'superAdmin') return true
    return roles.includes(user.value.role)
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    if (user.value.role === 'admin' || user.value.role === 'superAdmin') return true
    return user.value.permissions?.includes(permission) ?? false
  }

  return {
    user,
    loading,
    error,
    mfaChallenge,
    isAuthenticated,
    isAdmin,
    isManager,
    isSuperAdmin,
    userRole,
    canCustomizeColumns,
    acceptSession,
    register,
    login,
    completeMfa,
    loginWithPasskey,
    logout,
    fetchCurrentUser,
    hasRole,
    hasPermission
  }
})
