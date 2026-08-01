<template>
  <div class="sso-callback">
    <div v-if="error" class="sso-error">
      <h2>SSO Login Failed</h2>
      <p>{{ error }}</p>
      <router-link to="/sign-in" class="back-link">Back to Sign In</router-link>
    </div>
    <div v-else class="sso-loading">
      <div class="spinner"></div>
      <p>Completing SSO login...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api, { setTokens } from '../lib/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const error = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')

  if (!code) {
    error.value = 'No authorization code provided'
    return
  }

  try {
    const response = await api.post('/auth/sso/exchange', { code })
    if (response.data.mfaRequired) {
      authStore.mfaChallenge = response.data.challengeToken
      router.replace({ path: '/sign-in', query: { redirect: '/dashboard' } })
      return
    }
    const { accessToken, refreshToken } = response.data
    setTokens(accessToken, refreshToken)
    await authStore.fetchCurrentUser()
    router.replace('/dashboard')
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to complete SSO login'
  }
})
</script>

<style scoped>
.sso-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background: var(--bg-primary, #0a0a0f);
  color: var(--text-primary, #fff);
}

.sso-loading {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sso-error {
  text-align: center;
  max-width: 400px;
}

.sso-error h2 {
  margin-bottom: 8px;
  color: #ef4444;
}

.back-link {
  display: inline-block;
  margin-top: 16px;
  color: var(--accent, #6366f1);
  text-decoration: underline;
}
</style>
