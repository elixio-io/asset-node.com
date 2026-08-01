<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import AssetNodeLogo from '../components/illustrations/AssetNodeLogo.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)
const tokenError = ref<string | null>(null)

const email = ref('')
const orgName = ref('')
const role = ref('')
const token = ref('')

const firstName = ref('')
const lastName = ref('')
const password = ref('')
const confirmPassword = ref('')

onMounted(async () => {
  token.value = (route.query.token as string) || ''

  if (!token.value) {
    tokenError.value = t('invite.invalidLink')
    loading.value = false
    return
  }

  try {
    const res = await api.get(`/invites/validate?token=${token.value}`)
    email.value = res.data.email
    orgName.value = res.data.orgName
    role.value = res.data.role
  } catch (err: any) {
    tokenError.value = err.response?.data?.error || t('invite.linkExpired')
  } finally {
    loading.value = false
  }
})

async function handleAccept() {
  error.value = null

  if (!firstName.value || !lastName.value || !password.value || !confirmPassword.value) {
    error.value = t('auth.fillAllFields')
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordsDoNotMatch')
    return
  }

  if (password.value.length < 8) {
    error.value = t('auth.passwordMinLength')
    return
  }

  submitting.value = true
  try {
    const res = await api.post('/invites/accept', {
      token: token.value,
      firstName: firstName.value,
      lastName: lastName.value,
      password: password.value
    })

    authStore.accessToken = res.data.accessToken
    authStore.refreshToken = res.data.refreshToken
    authStore.user = res.data.user
    localStorage.setItem('accessToken', res.data.accessToken)
    localStorage.setItem('refreshToken', res.data.refreshToken)

    router.push('/dashboard')
  } catch (err: any) {
    if (err.response?.status === 409) {
      error.value = err.response.data.error
    } else if (err.response?.status === 403) {
      error.value = err.response.data.error
    } else {
      error.value = err.response?.data?.error || t('invite.acceptFailed')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-illustration">
      <div class="auth-illustration-content">
        <div class="signup-features">
          <div class="signup-feature-card" v-for="f in [
            { icon: 'pi pi-users', title: 'Team Collaboration', desc: 'Work together to manage your IT assets' },
            { icon: 'pi pi-shield', title: 'Enterprise Security', desc: 'TLS encryption, audit trails & GDPR-ready' },
            { icon: 'pi pi-bolt', title: 'Instant Access', desc: 'Join your team\'s workspace in seconds' }
          ]" :key="f.title">
            <i :class="f.icon" style="font-size: 1.2rem; color: var(--an-primary); margin-bottom: 8px;"></i>
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">{{ f.title }}</h3>
            <p style="font-size: 12px; color: var(--an-text-subtle);">{{ f.desc }}</p>
          </div>
        </div>
        <div class="auth-illustration-text">
          <h2>Join Your<br>Team</h2>
          <p>You've been invited to collaborate on IT asset management.</p>
        </div>
      </div>
    </div>

    <div class="auth-form-panel">
      <div class="auth-form-wrapper">
        <div class="flex align-items-center gap-3 mb-5">
          <AssetNodeLogo :size="36" style="color: var(--an-primary);" />
          <span class="text-lg font-bold">AssetNode</span>
        </div>

        <div v-if="loading" class="flex justify-content-center p-5">
          <i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i>
        </div>

        <template v-else-if="tokenError">
          <h1 class="text-2xl font-bold mb-2">{{ $t('invite.invalidTitle') }}</h1>
          <Message severity="error" class="mb-4">{{ tokenError }}</Message>
          <p style="color: var(--an-text-subtle); margin-bottom: 24px;">
            {{ $t('invite.requestNew') }}
          </p>
          <Button
            :label="$t('auth.signIn')"
            severity="primary"
            class="w-full"
            @click="router.push('/sign-in')"
          />
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold mb-2">{{ $t('invite.title') }}</h1>
          <p class="mb-4" style="color: var(--an-text-subtle);">
            {{ $t('invite.subtitle', { org: orgName }) }}
          </p>

          <div class="org-badge mb-4">
            <i class="pi pi-building" style="color: var(--an-primary);"></i>
            <div>
              <div class="font-bold" style="font-size: 14px;">{{ orgName }}</div>
              <div style="font-size: 12px; color: var(--an-text-muted); text-transform: capitalize;">{{ role }}</div>
            </div>
          </div>

          <Message v-if="error" severity="error" closable @close="error = null" class="mb-3">
            {{ error }}
          </Message>

          <form @submit.prevent="handleAccept">
            <div class="flex flex-column gap-2 mb-3">
              <label>{{ $t('auth.email') }}</label>
              <span class="p-input-icon-left">
                <i class="pi pi-envelope" />
                <InputText
                  :modelValue="email"
                  readonly
                  class="w-full"
                  style="opacity: 0.7;"
                />
              </span>
            </div>

            <div class="grid mb-1">
              <div class="col-6">
                <div class="flex flex-column gap-2">
                  <label>{{ $t('auth.firstName') }}</label>
                  <InputText
                    v-model="firstName"
                    :placeholder="$t('auth.firstName')"
                    class="w-full"
                    required
                  />
                </div>
              </div>
              <div class="col-6">
                <div class="flex flex-column gap-2">
                  <label>{{ $t('auth.lastName') }}</label>
                  <InputText
                    v-model="lastName"
                    :placeholder="$t('auth.lastName')"
                    class="w-full"
                    required
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-column gap-2 mb-3">
              <label>{{ $t('auth.password') }}</label>
              <Password
                v-model="password"
                :placeholder="$t('auth.password')"
                class="w-full"
                inputClass="w-full"
                toggleMask
                required
              />
            </div>

            <div class="flex flex-column gap-2 mb-4">
              <label>{{ $t('auth.confirmPassword') }}</label>
              <Password
                v-model="confirmPassword"
                :placeholder="$t('auth.confirmPassword')"
                class="w-full"
                inputClass="w-full"
                :feedback="false"
                toggleMask
                required
              />
            </div>

            <Button
              type="submit"
              :label="$t('invite.acceptButton')"
              severity="primary"
              size="large"
              class="w-full mb-3 btn-glow-primary"
              :loading="submitting"
            />
          </form>

          <div class="text-center mt-4">
            <span style="font-size: 14px; color: var(--an-text-subtle);">{{ $t('auth.haveAccount') }}</span>
            <Button
              :label="$t('auth.signIn')"
              text
              severity="secondary"
              size="small"
              class="ml-1"
              @click="router.push('/sign-in')"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100dvh;
  display: flex;
  background: var(--an-bg-dark);
}

.auth-illustration {
  display: none;
  width: 50%;
  background: var(--an-surface-dark);
  border-right: 1px solid var(--an-border-dark);
  padding: 48px;
  position: relative;
  overflow: hidden;
}

@media (min-width: 960px) {
  .auth-illustration {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.auth-illustration::before {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -30%;
  width: 80%;
  height: 80%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.auth-illustration-content {
  position: relative;
  z-index: 1;
  max-width: 400px;
}

.auth-illustration-text {
  margin-top: 40px;
}

.auth-illustration-text h2 {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-bottom: 12px;
}

.auth-illustration-text p {
  color: var(--an-text-subtle);
  font-size: 16px;
  line-height: 1.5;
}

.signup-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.signup-feature-card {
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--an-border-dark);
  background: var(--an-surface-elevated);
  transition: border-color var(--transition-fast);
}

.signup-feature-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.auth-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  overflow-y: auto;
}

.auth-form-wrapper {
  width: 100%;
  max-width: 420px;
}

.org-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
}
</style>
