<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import AssetNodeLogo from '../components/illustrations/AssetNodeLogo.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const email = ref('')
const password = ref('')
const ssoLoading = ref(false)
const ssoError = ref<string | null>(null)
const mfaCode = ref('')
const useRecoveryCode = ref(false)

async function handleSignIn() {
  if (!email.value || !password.value) {
    authStore.error = t('auth.fillAllFields')
    return
  }

  const success = await authStore.login(email.value, password.value)
  if (success) {
    const redirect = (router.currentRoute.value.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } else if (authStore.mfaChallenge) {
    password.value = ''
  }
}

async function handleMfa() {
  if (!mfaCode.value) return
  if (await authStore.completeMfa(mfaCode.value, useRecoveryCode.value)) {
    const redirect = (router.currentRoute.value.query.redirect as string) || '/dashboard'
    router.push(redirect)
  }
}

async function handlePasskeyLogin() {
  if (await authStore.loginWithPasskey()) {
    const redirect = (router.currentRoute.value.query.redirect as string) || '/dashboard'
    router.push(redirect)
  }
}

async function handleSsoLogin() {
  if (!email.value) {
    ssoError.value = t('auth.ssoEnterEmail')
    return
  }
  ssoLoading.value = true
  ssoError.value = null
  try {
    const { data } = await api.post('/auth/sso/discover', { email: email.value })
    window.location.href = data.ssoUrl
  } catch (err: any) {
    ssoError.value = err?.response?.data?.error || t('auth.ssoError')
  } finally {
    ssoLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-illustration">
      <div class="auth-illustration-content">
        <div class="terminal-window">
          <div class="terminal-dots">
            <span class="dot dot--red" />
            <span class="dot dot--yellow" />
            <span class="dot dot--green" />
          </div>
          <div class="terminal-body">
            <div class="terminal-line"><span class="t-prompt">$</span> assetnode sync --status</div>
            <div class="terminal-line t-dim">Connecting to inventory...</div>
            <div class="terminal-line t-success">✓ Assets synchronized</div>
            <div class="terminal-line t-success">✓ Audit trail active</div>
            <div class="terminal-line t-dim">Checking integrations...</div>
            <div class="terminal-line t-success">✓ Dashboard ready</div>
            <div class="terminal-line"><span class="t-cursor">_</span></div>
          </div>
        </div>
        <div class="auth-illustration-text">
          <h2>Precision IT Asset<br>Management</h2>
          <p>Track, audit, and optimize your entire infrastructure with unprecedented speed.</p>
        </div>
      </div>
    </div>

    <div class="auth-form-panel">
      <div class="auth-form-wrapper">
        <div class="flex align-items-center gap-3 mb-6">
          <AssetNodeLogo :size="36" style="color: var(--an-primary);" />
          <span class="text-lg font-bold">AssetNode</span>
        </div>

        <h1 class="text-2xl font-bold mb-2">{{ authStore.mfaChallenge ? 'Verify your identity' : $t('auth.welcomeBack') }}</h1>
        <p class="mb-5" style="color: var(--an-text-subtle);">
          {{ authStore.mfaChallenge ? 'Enter a code from your authenticator app or use a recovery code.' : $t('auth.signInSubtitle') }}
        </p>

        <Message v-if="authStore.error" severity="error" closable @close="authStore.error = null" class="mb-4">
          {{ authStore.error }}
        </Message>

        <form v-if="!authStore.mfaChallenge" @submit.prevent="handleSignIn">
          <div class="flex flex-column gap-2 mb-3">
            <label for="signin-email">{{ $t('auth.email') }}</label>
            <span class="p-input-icon-left">
              <i class="pi pi-envelope" />
              <InputText
                id="signin-email"
                v-model="email"
                type="email"
                :placeholder="$t('auth.email')"
                class="w-full"
                required
                data-testid="sign-in-email"
              />
            </span>
          </div>

          <div class="flex flex-column gap-2 mb-4">
            <label for="signin-password">{{ $t('auth.password') }}</label>
            <Password
              id="signin-password"
              v-model="password"
              :placeholder="$t('auth.password')"
              class="w-full"
              inputClass="w-full"
              :feedback="false"
              toggleMask
              required
              data-testid="sign-in-password"
            />
          </div>

          <div class="flex justify-content-end mb-2">
            <router-link to="/forgot-password" class="forgot-link" data-testid="forgot-password-link">
              {{ $t('auth.forgotPassword') }}
            </router-link>
          </div>

          <Button
            type="submit"
            :label="$t('auth.signIn')"
            severity="primary"
            size="large"
            class="w-full mb-3 btn-glow-primary"
            :loading="authStore.loading"
            data-testid="sign-in-submit"
          />
        </form>

        <form v-else @submit.prevent="handleMfa">
          <div class="flex flex-column gap-2 mb-3">
            <label for="signin-mfa-code">{{ useRecoveryCode ? 'Recovery code' : 'Authenticator code' }}</label>
            <InputText
              id="signin-mfa-code"
              v-model="mfaCode"
              :placeholder="useRecoveryCode ? 'XXXX-XXXX-XXXX' : '000000'"
              :autocomplete="useRecoveryCode ? 'off' : 'one-time-code'"
              :inputmode="useRecoveryCode ? 'text' : 'numeric'"
              class="w-full"
              autofocus
            />
          </div>
          <Button
            type="submit"
            label="Verify and sign in"
            severity="primary"
            size="large"
            class="w-full mb-2 btn-glow-primary"
            :loading="authStore.loading"
            :disabled="!mfaCode"
          />
          <Button
            type="button"
            :label="useRecoveryCode ? 'Use authenticator code' : 'Use a recovery code'"
            text
            class="w-full"
            @click="useRecoveryCode = !useRecoveryCode; mfaCode = ''"
          />
          <Button
            type="button"
            label="Start over"
            text
            severity="secondary"
            class="w-full"
            @click="authStore.mfaChallenge = null; mfaCode = ''"
          />
        </form>

        <div v-if="!authStore.mfaChallenge" class="sso-divider">
          <span>{{ $t('auth.orDivider') }}</span>
        </div>

        <Button
          v-if="!authStore.mfaChallenge"
          label="Sign in with a passkey"
          severity="secondary"
          outlined
          size="large"
          icon="pi pi-key"
          class="w-full mb-3"
          :loading="authStore.loading"
          @click="handlePasskeyLogin"
          data-testid="sign-in-passkey-button"
        />

        <Message v-if="ssoError && !authStore.mfaChallenge" severity="error" closable @close="ssoError = null" class="mb-3">
          {{ ssoError }}
        </Message>
        <Button
          v-if="!authStore.mfaChallenge"
          :label="$t('auth.ssoLogin')"
          severity="secondary"
          outlined
          size="large"
          icon="pi pi-shield"
          class="w-full"
          :loading="ssoLoading"
          @click="handleSsoLogin"
          data-testid="sign-in-sso-button"
        />

        <div v-if="!authStore.mfaChallenge" class="text-center mt-4">
          <span style="font-size: 14px; color: var(--an-text-subtle);">{{ $t('auth.noAccount') }}</span>
          <Button
            :label="$t('auth.signUp')"
            text
            severity="secondary"
            size="small"
            class="ml-1"
            @click="router.push('/sign-up')"
            data-testid="sign-in-to-signup"
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
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.auth-illustration-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
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

.terminal-window {
  background: #0e0e11;
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.terminal-dots {
  display: flex;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--an-border-dark);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot--red { background: #ef4444; }
.dot--yellow { background: #eab308; }
.dot--green { background: #22c55e; }

.terminal-body {
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.8;
}

.terminal-line { color: var(--an-text-primary); }
.t-prompt { color: var(--an-cobalt); }
.t-dim { color: var(--an-text-muted); }
.t-success { color: var(--an-emerald); }
.t-cursor { animation: blink 1s step-end infinite; color: var(--an-cobalt); }

@keyframes blink {
  50% { opacity: 0; }
}

.auth-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.auth-form-wrapper {
  width: 100%;
  max-width: 400px;
}

.sso-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  color: var(--an-text-muted);
  font-size: 13px;
}

.sso-divider::before,
.sso-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--an-border-dark);
}

.sso-panel {
  background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
}

.forgot-link {
  font-size: 13px;
  color: var(--an-cobalt);
  text-decoration: none;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: var(--an-cobalt-light, #60a5fa);
  text-decoration: underline;
}

</style>
