<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'

interface PasskeySummary {
  id: string
  name: string
  createdAt: string
  lastUsedAt?: string
  backedUp: boolean
  deviceType: 'singleDevice' | 'multiDevice'
}

interface SecurityStatus {
  ssoOnly: boolean
  totpEnabled: boolean
  stepUpRequired: boolean
  recoveryCodesRemaining: number
  passkeys: PasskeySummary[]
}

const status = ref<SecurityStatus>({ ssoOnly: false, totpEnabled: false, stepUpRequired: false, recoveryCodesRemaining: 0, passkeys: [] })
const authStore = useAuthStore()
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const showPasskeyDialog = ref(false)
const passkeyName = ref('My passkey')
const passkeyPassword = ref('')
const passkeyCode = ref('')
const passkeyLoading = ref(false)
const passkeyToRemove = ref<PasskeySummary | null>(null)
const removePassword = ref('')
const removeCode = ref('')

const showMfaDialog = ref(false)
const mfaPassword = ref('')
const mfaCode = ref('')
const mfaQrCode = ref<string | null>(null)
const mfaManualKey = ref<string | null>(null)
const recoveryCodes = ref<string[]>([])
const mfaLoading = ref(false)

const showDisableDialog = ref(false)
const disablePassword = ref('')
const disableCode = ref('')

const showRecoveryDialog = ref(false)
const recoveryPassword = ref('')
const recoveryCode = ref('')

function messageFrom(errorValue: any, fallback: string) {
  return errorValue?.response?.data?.error || errorValue?.message || fallback
}

function requiresMfaStepUp(errorValue: any) {
  return errorValue?.response?.data?.code === 'MFA_STEP_UP_REQUIRED'
}

async function loadStatus() {
  loading.value = true
  try {
    const { data } = await api.get('/auth/security')
    status.value = data
  } catch (err) {
    error.value = messageFrom(err, 'Security settings could not be loaded')
  } finally {
    loading.value = false
  }
}

async function addPasskey() {
  passkeyLoading.value = true
  error.value = null
  try {
    const [{ data }, { startRegistration }] = await Promise.all([
      api.post('/auth/passkeys/register/options', {
        currentPassword: passkeyPassword.value,
        ...(status.value.stepUpRequired && { code: passkeyCode.value })
      }),
      import('@simplewebauthn/browser')
    ])
    const response = await startRegistration({ optionsJSON: data.options })
    await api.post('/auth/passkeys/register/verify', {
      ceremonyToken: data.ceremonyToken,
      name: passkeyName.value,
      response
    })
    closePasskeyDialog()
    notice.value = 'Passkey added successfully'
    await loadStatus()
  } catch (err: any) {
    if (requiresMfaStepUp(err)) status.value.stepUpRequired = true
    error.value = err?.name === 'NotAllowedError'
      ? 'Passkey enrollment was cancelled or timed out'
      : messageFrom(err, 'Passkey could not be added')
  } finally {
    passkeyLoading.value = false
  }
}

function closePasskeyDialog() {
  showPasskeyDialog.value = false
  passkeyPassword.value = ''
  passkeyCode.value = ''
  passkeyName.value = 'My passkey'
}

async function removePasskey() {
  if (!passkeyToRemove.value) return
  passkeyLoading.value = true
  error.value = null
  try {
    const { data } = await api.delete(`/auth/passkeys/${encodeURIComponent(passkeyToRemove.value.id)}`, {
      data: {
        currentPassword: removePassword.value,
        ...(status.value.stepUpRequired && { code: removeCode.value })
      }
    })
    authStore.acceptSession(data)
    passkeyToRemove.value = null
    removePassword.value = ''
    removeCode.value = ''
    notice.value = 'Passkey removed'
    await loadStatus()
  } catch (err) {
    if (requiresMfaStepUp(err)) status.value.stepUpRequired = true
    error.value = messageFrom(err, 'Passkey could not be removed')
  } finally {
    passkeyLoading.value = false
  }
}

async function startMfaSetup() {
  mfaLoading.value = true
  error.value = null
  try {
    const { data } = await api.post('/auth/mfa/setup', { currentPassword: mfaPassword.value })
    mfaPassword.value = ''
    mfaQrCode.value = data.qrCodeDataUrl
    mfaManualKey.value = data.manualKey
  } catch (err) {
    error.value = messageFrom(err, 'Two-factor setup could not be started')
  } finally {
    mfaLoading.value = false
  }
}

async function confirmMfa() {
  mfaLoading.value = true
  error.value = null
  try {
    const { data } = await api.post('/auth/mfa/confirm', { code: mfaCode.value })
    authStore.acceptSession(data)
    recoveryCodes.value = data.recoveryCodes
    mfaCode.value = ''
    mfaQrCode.value = null
    mfaManualKey.value = null
    notice.value = 'Two-factor authentication enabled'
    await loadStatus()
  } catch (err) {
    error.value = messageFrom(err, 'Authenticator code could not be verified')
  } finally {
    mfaLoading.value = false
  }
}

function closeMfaDialog() {
  showMfaDialog.value = false
  mfaPassword.value = ''
  mfaCode.value = ''
  mfaQrCode.value = null
  mfaManualKey.value = null
  recoveryCodes.value = []
}

async function disableMfa() {
  mfaLoading.value = true
  error.value = null
  try {
    const { data } = await api.post('/auth/mfa/disable', {
      currentPassword: disablePassword.value,
      code: disableCode.value
    })
    authStore.acceptSession(data)
    showDisableDialog.value = false
    disablePassword.value = ''
    disableCode.value = ''
    notice.value = 'Two-factor authentication disabled'
    await loadStatus()
  } catch (err) {
    error.value = messageFrom(err, 'Two-factor authentication could not be disabled')
  } finally {
    mfaLoading.value = false
  }
}

async function regenerateRecoveryCodes() {
  mfaLoading.value = true
  error.value = null
  try {
    const { data } = await api.post('/auth/mfa/recovery-codes', {
      currentPassword: recoveryPassword.value,
      code: recoveryCode.value
    })
    recoveryCodes.value = data.recoveryCodes
    recoveryPassword.value = ''
    recoveryCode.value = ''
    notice.value = 'Previous recovery codes were revoked'
    await loadStatus()
  } catch (err) {
    error.value = messageFrom(err, 'Recovery codes could not be regenerated')
  } finally {
    mfaLoading.value = false
  }
}

function closeRecoveryDialog() {
  showRecoveryDialog.value = false
  recoveryPassword.value = ''
  recoveryCode.value = ''
  recoveryCodes.value = []
}

async function copyRecoveryCodes() {
  await navigator.clipboard.writeText(recoveryCodes.value.join('\n'))
  notice.value = 'Recovery codes copied to the clipboard'
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Never'
}

onMounted(loadStatus)
</script>

<template>
  <div class="an-card mb-4 security-card">
    <h2 class="font-bold mb-2 flex align-items-center gap-2"><i class="pi pi-shield"></i>Sign-in security</h2>
    <p class="security-muted mb-4">Protect your account with phishing-resistant passkeys and optional authenticator codes.</p>

    <Message v-if="error" severity="error" closable class="mb-3" @close="error = null">{{ error }}</Message>
    <Message v-if="notice" severity="success" closable class="mb-3" @close="notice = null">{{ notice }}</Message>
    <Message v-if="status.ssoOnly" severity="info" :closable="false" class="mb-3">
      This is an SSO-only account. Passkey and MFA policy is managed by your identity provider.
    </Message>
    <div v-if="loading" class="py-3"><i class="pi pi-spin pi-spinner"></i></div>

    <template v-else>
      <section class="security-section">
        <div class="security-heading">
          <div>
            <h3><i class="pi pi-key"></i> Passkeys</h3>
            <p class="security-muted">Use Face ID, Touch ID, Windows Hello, or a hardware security key.</p>
          </div>
          <Button v-if="!status.ssoOnly" label="Add passkey" icon="pi pi-plus" outlined @click="showPasskeyDialog = true" />
        </div>
        <div v-if="status.passkeys.length" class="security-list">
          <div v-for="passkey in status.passkeys" :key="passkey.id" class="security-item">
            <div>
              <strong>{{ passkey.name }}</strong>
              <div class="security-muted">Added {{ formatDate(passkey.createdAt) }} · Last used {{ formatDate(passkey.lastUsedAt) }}</div>
            </div>
            <Button v-if="!status.ssoOnly" icon="pi pi-trash" severity="danger" text aria-label="Remove passkey" @click="passkeyToRemove = passkey" />
          </div>
        </div>
        <p v-else class="security-empty">No passkeys registered yet.</p>
      </section>

      <section class="security-section">
        <div class="security-heading">
          <div>
            <h3><i class="pi pi-mobile"></i> Authenticator app (2FA)</h3>
            <p class="security-muted" v-if="status.totpEnabled">Enabled · {{ status.recoveryCodesRemaining }} recovery codes remaining</p>
            <p class="security-muted" v-else>Add a rotating six-digit code after password sign-in.</p>
          </div>
          <div v-if="!status.ssoOnly" class="flex gap-2 flex-wrap justify-content-end">
            <Button v-if="!status.totpEnabled" label="Enable 2FA" outlined @click="showMfaDialog = true" />
            <template v-else>
              <Button label="New recovery codes" outlined @click="showRecoveryDialog = true" />
              <Button label="Disable" severity="danger" outlined @click="showDisableDialog = true" />
            </template>
          </div>
        </div>
      </section>
    </template>

    <Dialog v-model:visible="showPasskeyDialog" header="Add a passkey" modal :style="{ width: '480px' }" @hide="closePasskeyDialog">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <div class="flex flex-column gap-3">
        <div><label>Passkey name</label><InputText v-model="passkeyName" class="w-full mt-2" placeholder="e.g. MacBook Touch ID" /></div>
        <div><label>Current password</label><InputText v-model="passkeyPassword" type="password" autocomplete="current-password" class="w-full mt-2" /></div>
        <div v-if="status.stepUpRequired"><label>Authenticator code</label><InputText v-model="passkeyCode" inputmode="numeric" autocomplete="one-time-code" class="w-full mt-2" placeholder="000000" /></div>
        <small class="security-muted">Your device will ask for biometric or PIN verification next.</small>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="closePasskeyDialog" />
        <Button label="Continue" :loading="passkeyLoading" :disabled="!passkeyName || !passkeyPassword || (status.stepUpRequired && !passkeyCode)" @click="addPasskey" />
      </template>
    </Dialog>

    <Dialog :visible="!!passkeyToRemove" header="Remove passkey" modal :style="{ width: '440px' }" @update:visible="value => { if (!value) { passkeyToRemove = null; removePassword = ''; removeCode = '' } }">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <p>Confirm removal of <strong>{{ passkeyToRemove?.name }}</strong> with your password.</p>
      <InputText v-model="removePassword" type="password" autocomplete="current-password" class="w-full mt-3" />
      <InputText v-if="status.stepUpRequired" v-model="removeCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Authenticator code" class="w-full mt-3" />
      <template #footer>
        <Button label="Cancel" text @click="passkeyToRemove = null; removePassword = ''; removeCode = ''" />
        <Button label="Remove" severity="danger" :loading="passkeyLoading" :disabled="!removePassword || (status.stepUpRequired && !removeCode)" @click="removePasskey" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showMfaDialog" header="Enable two-factor authentication" modal :style="{ width: '520px' }" @hide="closeMfaDialog">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <div v-if="recoveryCodes.length">
        <Message severity="warn" :closable="false" class="mb-3">Save these one-time recovery codes now. They will not be shown again.</Message>
        <div class="recovery-grid"><code v-for="code in recoveryCodes" :key="code">{{ code }}</code></div>
        <Button label="Copy all codes" icon="pi pi-copy" outlined class="w-full mt-3" @click="copyRecoveryCodes" />
      </div>
      <div v-else-if="mfaQrCode" class="flex flex-column gap-3">
        <p>Scan this QR code with your authenticator app, then enter the current code.</p>
        <img :src="mfaQrCode" alt="Authenticator setup QR code" class="mfa-qr" />
        <div><small class="security-muted">Manual setup key</small><code class="manual-key">{{ mfaManualKey }}</code></div>
        <div><label>Authenticator code</label><InputText v-model="mfaCode" inputmode="numeric" autocomplete="one-time-code" class="w-full mt-2" placeholder="000000" /></div>
      </div>
      <div v-else>
        <p class="mb-3">Confirm your current password before displaying the setup secret.</p>
        <InputText v-model="mfaPassword" type="password" autocomplete="current-password" class="w-full" />
      </div>
      <template #footer>
        <Button :label="recoveryCodes.length ? 'Done' : 'Cancel'" text @click="closeMfaDialog" />
        <Button v-if="!mfaQrCode && !recoveryCodes.length" label="Show QR code" :loading="mfaLoading" :disabled="!mfaPassword" @click="startMfaSetup" />
        <Button v-else-if="mfaQrCode" label="Verify and enable" :loading="mfaLoading" :disabled="!mfaCode" @click="confirmMfa" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showDisableDialog" header="Disable two-factor authentication" modal :style="{ width: '460px' }" @hide="disablePassword = ''; disableCode = ''">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <div class="flex flex-column gap-3">
        <Message severity="warn" :closable="false">This removes the authenticator secret and all recovery codes.</Message>
        <div><label>Current password</label><InputText v-model="disablePassword" type="password" autocomplete="current-password" class="w-full mt-2" /></div>
        <div><label>Authenticator code</label><InputText v-model="disableCode" inputmode="numeric" autocomplete="one-time-code" class="w-full mt-2" /></div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showDisableDialog = false; disablePassword = ''; disableCode = ''" />
        <Button label="Disable 2FA" severity="danger" :loading="mfaLoading" :disabled="!disablePassword || !disableCode" @click="disableMfa" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showRecoveryDialog" header="Generate new recovery codes" modal :style="{ width: '500px' }" @hide="closeRecoveryDialog">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <div v-if="recoveryCodes.length">
        <Message severity="warn" :closable="false" class="mb-3">Previous codes are revoked. Save these replacements now; they will not be shown again.</Message>
        <div class="recovery-grid"><code v-for="code in recoveryCodes" :key="code">{{ code }}</code></div>
        <Button label="Copy all codes" icon="pi pi-copy" outlined class="w-full mt-3" @click="copyRecoveryCodes" />
      </div>
      <div v-else class="flex flex-column gap-3">
        <div><label>Current password</label><InputText v-model="recoveryPassword" type="password" autocomplete="current-password" class="w-full mt-2" /></div>
        <div><label>Authenticator code</label><InputText v-model="recoveryCode" inputmode="numeric" autocomplete="one-time-code" class="w-full mt-2" /></div>
      </div>
      <template #footer>
        <Button :label="recoveryCodes.length ? 'Done' : 'Cancel'" text @click="closeRecoveryDialog" />
        <Button v-if="!recoveryCodes.length" label="Replace codes" :loading="mfaLoading" :disabled="!recoveryPassword || !recoveryCode" @click="regenerateRecoveryCodes" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.security-card { padding: 24px; }
.security-muted { color: var(--an-text-muted); font-size: 13px; }
.security-section { padding: 18px 0; border-top: 1px solid var(--an-border); }
.security-section:last-child { padding-bottom: 0; }
.security-heading, .security-item { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.security-heading h3 { margin: 0 0 6px; font-size: 15px; }
.security-heading p { margin: 0; }
.security-list { margin-top: 14px; display: grid; gap: 8px; }
.security-item { background: var(--an-surface-2); border: 1px solid var(--an-border); border-radius: 8px; padding: 10px 12px; }
.security-empty { margin: 14px 0 0; color: var(--an-text-muted); font-size: 13px; }
.mfa-qr { width: 240px; height: 240px; align-self: center; border-radius: 8px; }
.manual-key { display: block; padding: 10px; margin-top: 6px; background: var(--an-surface-2); word-break: break-all; }
.recovery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.recovery-grid code { background: var(--an-surface-2); padding: 9px; border-radius: 6px; text-align: center; }
@media (max-width: 640px) {
  .security-heading { align-items: flex-start; flex-direction: column; }
  .recovery-grid { grid-template-columns: 1fr; }
}
</style>
