<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import AssetNodeLogo from '../components/illustrations/AssetNodeLogo.vue'

const router = useRouter()
const { t } = useI18n()
const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function handleSubmit() {
  if (!email.value) {
    error.value = t('auth.fillAllFields')
    return
  }
  loading.value = true
  error.value = null
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    success.value = true
  } catch (err: any) {


    error.value = err?.response?.data?.error || t('auth.resetError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-hero-panel">
      <div class="hero-content">
        <div class="hero-terminal">
          <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
          <div class="term-body">
            <div class="t-line"><span class="t-prompt">$ </span><span class="t-cmd">assetnode reset --password</span></div>
            <div class="t-line"><span class="t-info">Sending reset link...</span></div>
            <div class="t-line"><span class="t-success">✓ Reset email sent</span></div>
            <div class="t-line"><span class="t-success">✓ Check your inbox</span></div>
          </div>
        </div>

        <h1 class="hero-title">Precision IT Asset Management</h1>
        <p class="hero-sub">Track, audit, and optimize your entire infrastructure with unprecedented speed.</p>
      </div>
    </div>

    <div class="auth-form-panel">
      <div class="auth-form-wrapper">
        <div class="flex align-items-center gap-2 mb-5">
          <AssetNodeLogo :size="28" />
          <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">AssetNode</span>
        </div>

        <template v-if="!success">
          <h2 style="font-size: 28px; font-weight: 800; margin: 0 0 8px;">{{ $t('auth.forgotPassword') }}</h2>
          <p style="color: var(--an-text-muted); font-size: 14px; margin-bottom: 24px;">
            {{ $t('auth.resetDescription') }}
          </p>

          <Message v-if="error" severity="error" closable @close="error = null" class="mb-3">
            {{ error }}
          </Message>

          <form @submit.prevent="handleSubmit" class="flex flex-column gap-3">
            <div class="flex flex-column gap-2">
              <label for="reset-email">{{ $t('auth.email') }}</label>
              <span class="p-input-icon-left">
                <i class="pi pi-envelope" />
                <InputText
                  id="reset-email"
                  v-model="email"
                  type="email"
                  :placeholder="$t('auth.email')"
                  class="w-full"
                  required
                  autofocus
                  data-testid="forgot-password-email"
                />
              </span>
            </div>

            <Button
              type="submit"
              :label="$t('auth.sendResetLink')"
              severity="primary"
              size="large"
              class="w-full btn-glow-primary"
              :loading="loading"
              data-testid="forgot-password-submit"
            />
          </form>
        </template>

        <template v-else>
          <div class="success-state">
            <i class="pi pi-check-circle" style="font-size: 48px; color: var(--an-emerald); margin-bottom: 16px;" />
            <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">{{ $t('auth.resetSent') }}</h2>
            <p style="color: var(--an-text-muted); font-size: 14px; margin-bottom: 24px;">
              {{ $t('auth.resetSentDescription') }}
            </p>
          </div>
        </template>

        <div class="text-center mt-4">
          <Button
            :label="$t('auth.backToSignIn')"
            text
            severity="secondary"
            size="small"
            icon="pi pi-arrow-left"
            @click="router.push('/sign-in')"
            data-testid="forgot-password-back"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  min-height: 100dvh;
  background: var(--an-bg);
  color: var(--an-text);
}

.auth-hero-panel {
  flex: 1;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: linear-gradient(135deg, var(--an-surface-dark), var(--an-bg));
  border-right: 1px solid var(--an-border-dark);
}

@media (min-width: 992px) {
  .auth-hero-panel { display: flex; }
}

.hero-content { max-width: 520px; }

.hero-terminal {
  background: #0d1117;
  border-radius: 12px;
  border: 1px solid var(--an-border-dark);
  overflow: hidden;
  margin-bottom: 40px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.term-bar {
  padding: 10px 14px;
  display: flex;
  gap: 7px;
  background: rgba(255, 255, 255, 0.04);
}

.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.r { background: #ff5f56; }
.dot.y { background: #ffbd2e; }
.dot.g { background: #27c93f; }

.term-body { padding: 16px 18px; line-height: 1.8; }
.t-line { white-space: nowrap; }
.t-prompt { color: var(--an-emerald); }
.t-cmd { color: var(--an-text); }
.t-info { color: var(--an-text-muted); }
.t-success { color: var(--an-emerald); }

.hero-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 12px; }
.hero-sub { font-size: 15px; color: var(--an-text-muted); line-height: 1.6; margin: 0; }

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

.success-state {
  text-align: center;
  padding: 20px 0;
}
</style>
