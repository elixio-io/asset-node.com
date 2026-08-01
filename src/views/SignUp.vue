<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import AssetNodeLogo from '../components/illustrations/AssetNodeLogo.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const companyName = ref('')
const gdprConsent = ref(false)

async function handleSignUp() {
  if (!email.value || !password.value || !confirmPassword.value || !companyName.value || !firstName.value || !lastName.value) {
    authStore.error = t('auth.fillAllFields')
    return
  }

  if (password.value !== confirmPassword.value) {
    authStore.error = t('auth.passwordsDoNotMatch')
    return
  }

  if (password.value.length < 8) {
    authStore.error = t('auth.passwordMinLength')
    return
  }

  if (!gdprConsent.value) {
    authStore.error = t('auth.gdprRequired')
    return
  }

  const success = await authStore.register(
    email.value,
    password.value,
    firstName.value,
    lastName.value,
    companyName.value
  )
  if (success) {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-illustration">
      <div class="auth-illustration-content">
        <div class="signup-features">
          <div class="signup-feature-card" v-for="f in [
            { icon: 'pi pi-shield', title: 'Enterprise Security', desc: 'TLS encryption, audit trails & GDPR-ready' },
            { icon: 'pi pi-bolt', title: 'Instant Setup', desc: 'Get started in under 2 minutes' },
            { icon: 'pi pi-infinity', title: 'Unlimited Assets', desc: 'No limits on tracked devices' }
          ]" :key="f.title">
            <i :class="f.icon" style="font-size: 1.2rem; color: var(--an-primary); margin-bottom: 8px;"></i>
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">{{ f.title }}</h3>
            <p style="font-size: 12px; color: var(--an-text-subtle);">{{ f.desc }}</p>
          </div>
        </div>
        <div class="auth-illustration-text">
          <h2>Start Managing<br>Assets Today</h2>
          <p>Create your workspace and invite your team in minutes.</p>
        </div>
      </div>
    </div>

    <div class="auth-form-panel">
      <div class="auth-form-wrapper">
        <div class="flex align-items-center gap-3 mb-5">
          <AssetNodeLogo :size="36" style="color: var(--an-primary);" />
          <span class="text-lg font-bold">AssetNode</span>
        </div>

        <h1 class="text-2xl font-bold mb-2">{{ $t('auth.createAccount') }}</h1>
        <p class="mb-4" style="color: var(--an-text-subtle);">{{ $t('auth.signUpSubtitle') }}</p>

        <Message v-if="authStore.error" severity="error" closable @close="authStore.error = null" class="mb-3">
          {{ authStore.error }}
        </Message>

        <form @submit.prevent="handleSignUp">
          <div class="grid mb-1">
            <div class="col-6">
              <div class="flex flex-column gap-2">
                <label for="signup-first-name">{{ $t('auth.firstName') }}</label>
                <InputText
                  id="signup-first-name"
                  v-model="firstName"
                  :placeholder="$t('auth.firstName')"
                  class="w-full"
                  required
                  data-testid="sign-up-first-name"
                />
              </div>
            </div>
            <div class="col-6">
              <div class="flex flex-column gap-2">
                <label for="signup-last-name">{{ $t('auth.lastName') }}</label>
                <InputText
                  id="signup-last-name"
                  v-model="lastName"
                  :placeholder="$t('auth.lastName')"
                  class="w-full"
                  required
                  data-testid="sign-up-last-name"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-column gap-2 mb-3">
            <label for="signup-company">{{ $t('auth.companyName') }}</label>
            <span class="p-input-icon-left">
              <i class="pi pi-building" />
              <InputText
                id="signup-company"
                v-model="companyName"
                :placeholder="$t('auth.companyName')"
                class="w-full"
                required
                data-testid="sign-up-company"
              />
            </span>
          </div>

          <div class="flex flex-column gap-2 mb-3">
            <label for="signup-email">{{ $t('auth.email') }}</label>
            <span class="p-input-icon-left">
              <i class="pi pi-envelope" />
              <InputText
                id="signup-email"
                v-model="email"
                type="email"
                :placeholder="$t('auth.email')"
                class="w-full"
                required
                data-testid="sign-up-email"
              />
            </span>
          </div>

          <div class="flex flex-column gap-2 mb-3">
            <label for="signup-password">{{ $t('auth.password') }}</label>
            <Password
              id="signup-password"
              v-model="password"
              :placeholder="$t('auth.password')"
              class="w-full"
              inputClass="w-full"
              toggleMask
              required
              data-testid="sign-up-password"
            />
          </div>

          <div class="flex flex-column gap-2 mb-3">
            <label for="signup-confirm-password">{{ $t('auth.confirmPassword') }}</label>
            <Password
              id="signup-confirm-password"
              v-model="confirmPassword"
              :placeholder="$t('auth.confirmPassword')"
              class="w-full"
              inputClass="w-full"
              :feedback="false"
              toggleMask
              required
              data-testid="sign-up-confirm-password"
            />
          </div>

          <div class="flex align-items-center gap-2 mb-4">
            <Checkbox
              v-model="gdprConsent"
              :binary="true"
              inputId="gdpr-consent"
              data-testid="sign-up-gdpr-consent"
            />
            <label for="gdpr-consent" style="font-size: 13px;">
              {{ $t('auth.gdprConsent', { link: $t('auth.privacyPolicy') }) }}
            </label>
          </div>

          <Button
            type="submit"
            :label="$t('auth.createAccount')"
            severity="primary"
            size="large"
            class="w-full mb-3 btn-glow-primary"
            :loading="authStore.loading"
            data-testid="sign-up-submit"
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
            data-testid="sign-up-to-signin"
          />
        </div>
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


</style>
