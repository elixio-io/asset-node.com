<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBillingStore, type PlanKey } from '../stores/billing'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'

const { t } = useI18n()
const billing = useBillingStore()

const loading = ref(true)
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)
const ready = ref(false)

const showTrialDialog = ref(false)
const showCancelDialog = ref(false)
const showSubscribeDialog = ref(false)
const selectedPlan = ref<PlanKey>('starter')
const selectedInterval = ref<'monthly' | 'annual'>('monthly')

const billingForm = ref({
  companyName: '',
  street: '',
  city: '',
  zipCode: '',
  countryCode: 'DE',
  vatNumber: '',
})

const intervalOptions = [
  { label: 'Monatlich', value: 'monthly' },
  { label: 'Jährlich (2 Monate gratis)', value: 'annual' },
]

onMounted(async () => {
  try {
    await Promise.all([billing.fetchPlans(), billing.fetchStatus(), billing.fetchInvoices()])
  } catch {
    error.value = 'Failed to load billing data'
  } finally {
    loading.value = false
    await nextTick()
    setTimeout(() => { ready.value = true }, 50)
  }
})

const statusSeverity = computed(() => {
  switch (billing.subscriptionStatus) {
    case 'active': return 'success'
    case 'trialing': return 'info'
    case 'past_due': return 'warn'
    case 'canceled': return 'danger'
    default: return 'secondary'
  }
})

const statusLabel = computed(() => {
  switch (billing.subscriptionStatus) {
    case 'active': return 'Aktiv'
    case 'trialing': return 'Testphase'
    case 'past_due': return 'Zahlung ausstehend'
    case 'canceled': return 'Gekündigt'
    default: return 'Free'
  }
})

const statusIcon = computed(() => {
  switch (billing.subscriptionStatus) {
    case 'active': return 'pi pi-check-circle'
    case 'trialing': return 'pi pi-clock'
    case 'past_due': return 'pi pi-exclamation-circle'
    case 'canceled': return 'pi pi-times-circle'
    default: return 'pi pi-circle'
  }
})

function usageColor(percent: number): string {
  if (percent >= 90) return 'var(--p-red-500)'
  if (percent >= 70) return 'var(--p-orange-400)'
  return 'var(--an-emerald)'
}

function formatLimit(limit: number): string {
  return limit === -1 ? '∞' : limit.toString()
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCents(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`
}

function resourceIcon(resource: string): string {
  switch (resource) {
    case 'assets': return 'pi pi-box'
    case 'users': return 'pi pi-users'
    case 'integrations': return 'pi pi-link'
    case 'workflows': return 'pi pi-bolt'
    case 'customFields': return 'pi pi-sliders-h'
    default: return 'pi pi-circle'
  }
}

function resourceLabel(resource: string): string {
  switch (resource) {
    case 'assets': return 'Assets'
    case 'users': return 'Benutzer'
    case 'integrations': return 'Integrationen'
    case 'workflows': return 'Automations'
    case 'customFields': return 'Custom Fields'
    default: return resource
  }
}

const upgradablePlans = computed(() => {
  const planOrder: PlanKey[] = ['free', 'starter', 'pro', 'enterprise']
  const currentIdx = planOrder.indexOf(billing.basePlan)
  return billing.plans.filter(p => planOrder.indexOf(p.key) > currentIdx && p.pricing)
})
const subscribablePlans = computed(() => billing.plans.filter(p => p.pricing))

const selectedPlanDef = computed(() => billing.plans.find(p => p.key === selectedPlan.value))
const selectedTrialDays = computed(() => selectedPlanDef.value?.trialDays ?? 0)
const selectedPricePreview = computed(() => {
  const p = selectedPlanDef.value
  if (!p?.pricing) return ''
  if (selectedInterval.value === 'annual') {
    return `€${(p.pricing.annual / 100).toFixed(0)}/Jahr (€${Math.round(p.pricing.annual / 12 / 100)}/Mo)`
  }
  return `€${(p.pricing.monthly / 100).toFixed(0)}/Monat`
})

async function handleStartTrial() {
  showTrialDialog.value = false
  const success = await billing.startTrial(selectedPlan.value, selectedInterval.value)
  if (success) {
    successMsg.value = `${selectedPlan.value.charAt(0).toUpperCase() + selectedPlan.value.slice(1)} Testphase gestartet!`
    setTimeout(() => successMsg.value = null, 5000)
  } else {
    error.value = billing.error
    setTimeout(() => error.value = null, 5000)
  }
}

async function handleCancel() {
  showCancelDialog.value = false
  const success = await billing.cancelSubscription()
  if (success) {
    successMsg.value = 'Abonnement wird zum Ende der Abrechnungsperiode gekündigt.'
    setTimeout(() => successMsg.value = null, 5000)
  } else {
    error.value = billing.error
    setTimeout(() => error.value = null, 5000)
  }
}

async function handleReactivate() {
  const success = await billing.reactivateSubscription()
  if (success) {
    successMsg.value = 'Abonnement reaktiviert!'
    setTimeout(() => successMsg.value = null, 5000)
  }
}

function openSubscribeDialog(plan: PlanKey = billing.basePlan) {
  const selectable = subscribablePlans.value.find(candidate => candidate.key === plan)
    || upgradablePlans.value[0]
    || subscribablePlans.value[0]
  if (selectable) selectedPlan.value = selectable.key
  showSubscribeDialog.value = true
}

const subscribeFormValid = computed(() => {
  const f = billingForm.value
  return f.companyName.trim() && f.street.trim() && f.city.trim() && f.zipCode.trim() && f.countryCode.trim()
})

async function handleSubscribe() {
  showSubscribeDialog.value = false
  const result = await billing.subscribe(selectedPlan.value, selectedInterval.value, {
    companyName: billingForm.value.companyName,
    street: billingForm.value.street,
    city: billingForm.value.city,
    zipCode: billingForm.value.zipCode,
    countryCode: billingForm.value.countryCode,
    vatNumber: billingForm.value.vatNumber || undefined,
  })
  if (result) {
    successMsg.value = 'Rechnung erstellt. Der gewählte Plan wird nach bestätigtem Zahlungseingang aktiviert.'
    setTimeout(() => successMsg.value = null, 5000)
  } else {
    error.value = billing.error
    setTimeout(() => error.value = null, 5000)
  }
}

function downloadInvoice(invoiceId: string) {
  window.open(`/api/billing/invoices/${invoiceId}/download`, '_blank')
}
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <div class="billing-header" :class="{ 'billing-header--ready': ready }">
        <h1>Abonnement & Abrechnung</h1>
        <p>Verwalten Sie Ihren Plan, Nutzung und Rechnungen.</p>
      </div>

      <Transition name="msg">
        <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>
      </Transition>
      <Transition name="msg">
        <Message v-if="successMsg" severity="success" closable @close="successMsg = null" class="mb-4">{{ successMsg }}</Message>
      </Transition>

      <div v-if="loading" class="billing-skeleton">
        <div class="skeleton-card skeleton-pulse" />
        <div class="skeleton-card skeleton-card--small skeleton-pulse" />
        <div class="skeleton-card skeleton-card--full skeleton-pulse" />
      </div>

      <template v-else-if="billing.billingStatus">
        <div class="billing-grid" :class="{ 'billing-grid--ready': ready }">
          <div class="an-card billing-plan-card">
            <div class="flex justify-content-between align-items-start mb-3">
              <div>
                <div class="plan-name-row">
                  <span class="plan-name">{{ billing.currentPlanName }}</span>
                  <Tag :value="statusLabel" :severity="statusSeverity" />
                </div>
                <div class="plan-interval">{{ billing.billingStatus.interval === 'annual' ? 'Jährlich' : 'Monatlich' }}</div>
              </div>
              <div v-if="billing.billingStatus.pricing" class="plan-price-display">
                <span class="plan-price">{{ fmtCents(billing.billingStatus.interval === 'annual' ? billing.billingStatus.pricing.annual / 12 : billing.billingStatus.pricing.monthly) }}</span>
                <span class="plan-price-label">/Monat</span>
              </div>
              <div v-else class="plan-price-display">
                <span class="plan-price">€0</span>
                <span class="plan-price-label">kostenlos</span>
              </div>
            </div>

            <div v-if="billing.billingStatus.accessOverride" class="trial-banner">
              <i class="pi pi-gift" />
              <span>
                Enterprise-Zugang wurde vorübergehend freigeschaltet bis
                <strong>{{ fmtDate(billing.billingStatus.accessOverride.expiresAt) }}</strong>.
                Ihr Abonnement bleibt {{ billing.basePlanName }}.
              </span>
            </div>

            <div v-if="billing.isTrialing && billing.billingStatus.trial" class="trial-banner">
              <i class="pi pi-clock" />
              <span>
                Testphase endet in <strong>{{ billing.trialDaysRemaining }} Tagen</strong>
                ({{ fmtDate(billing.billingStatus.trial.endsAt) }})
              </span>
            </div>

            <div v-if="billing.billingStatus.pendingSubscription" class="trial-banner">
              <i class="pi pi-receipt" />
              <span>
                Rechnung für <strong>{{ billing.billingStatus.pendingSubscription.planName }}</strong> erstellt.
                <template v-if="['overdue', 'canceled'].includes(billing.billingStatus.pendingSubscription.state)">
                  Sie kann sicher ersetzt werden; die bisherige Rechnung wird vorher storniert bzw. wurde bereits storniert.
                </template>
                <template v-else>Der Plan wird erst nach bestätigtem Zahlungseingang aktiviert.</template>
              </span>
            </div>

            <div v-if="billing.isActive && billing.billingStatus.currentPeriod" class="period-info">
              <i class="pi pi-calendar" style="margin-right:6px;" />
              <span>Nächste Rechnung: <strong>{{ fmtDate(billing.billingStatus.currentPeriod.end) }}</strong></span>
            </div>

            <div v-if="billing.isPastDue" class="past-due-banner">
              <i class="pi pi-exclamation-triangle" />
              <span>Zahlung ausstehend — bitte überweisen Sie den offenen Betrag.</span>
            </div>

            <div v-if="billing.isCanceled" class="cancel-banner">
              <i class="pi pi-info-circle" />
              <span>
                Zugang bis {{ fmtDate(billing.billingStatus.currentPeriod?.end || billing.billingStatus.trial?.endsAt) }}.
                <a href="#" @click.prevent="handleReactivate" class="reactivate-link">Reaktivieren</a>
              </span>
            </div>

            <div class="plan-actions">
              <Button
                v-if="billing.billingStatus.pendingSubscription && ['overdue', 'canceled'].includes(billing.billingStatus.pendingSubscription.state)"
                label="Rechnung sicher neu ausstellen"
                icon="pi pi-refresh"
                severity="primary"
                class="upgrade-btn"
                @click="openSubscribeDialog(billing.billingStatus.pendingSubscription.plan)"
              />
              <Button
                v-else-if="billing.isTrialing && !billing.billingStatus.pendingSubscription"
                label="Testphase in Abo umwandeln"
                icon="pi pi-credit-card"
                severity="primary"
                class="upgrade-btn"
                @click="openSubscribeDialog(billing.basePlan)"
              />
              <Button
                v-else-if="billing.isActive && upgradablePlans.length > 0 && !billing.billingStatus.pendingSubscription"
                label="Plan ändern"
                icon="pi pi-arrow-up"
                severity="primary"
                class="upgrade-btn"
                @click="openSubscribeDialog(upgradablePlans[0]?.key)"
              />
              <Button
                v-else-if="!billing.isActive && upgradablePlans.length > 0 && !billing.billingStatus.pendingSubscription"
                label="Plan testen"
                icon="pi pi-play"
                severity="primary"
                class="upgrade-btn"
                @click="showTrialDialog = true"
              />
              <Button
                v-if="(billing.isTrialing || billing.isActive) && !billing.isCanceled"
                label="Kündigen"
                icon="pi pi-times"
                severity="danger"
                text
                class="cancel-btn"
                @click="showCancelDialog = true"
              />
            </div>
          </div>

          <div class="an-card billing-stats-card">
            <div class="stat-group">
              <div class="stat-icon-row">
                <i class="pi pi-wallet stat-icon" />
                <h3 class="section-title">Letzte Zahlung</h3>
              </div>
              <div class="stat-value">{{ fmtDate(billing.billingStatus.lastPaymentAt) }}</div>
            </div>
            <div class="stat-divider" />
            <div class="stat-group">
              <div class="stat-icon-row">
                <i class="pi pi-calendar stat-icon" />
                <h3 class="section-title">Plan seit</h3>
              </div>
              <div class="stat-value">{{ fmtDate(billing.billingStatus.trial?.startedAt || billing.billingStatus.currentPeriod?.start) }}</div>
            </div>
            <div class="stat-divider" />
            <div class="stat-group">
              <div class="stat-icon-row">
                <i class="pi pi-building stat-icon" />
                <h3 class="section-title">Zahlungsmethode</h3>
              </div>
              <div class="stat-value stat-value--method">
                <span class="payment-badge">SEPA</span>
                Überweisung
              </div>
            </div>
          </div>
        </div>

        <div class="an-card usage-card" :class="{ 'usage-card--ready': ready }">
          <h2 class="section-title mb-4">Nutzungsübersicht</h2>
          <div class="usage-grid">
            <div
              v-for="(resource, idx) in (['assets', 'users', 'integrations', 'workflows', 'customFields'] as const)"
              :key="resource"
              class="usage-item"
              :style="{ '--stagger': idx }"
            >
              <div class="usage-label">
                <span class="usage-name">
                  <i :class="resourceIcon(resource)" class="usage-icon" />
                  {{ resourceLabel(resource) }}
                </span>
                <span class="usage-values">
                  {{ billing.usage?.[resource]?.current ?? 0 }} / {{ formatLimit(billing.usage?.[resource]?.limit ?? 0) }}
                </span>
              </div>
              <div class="usage-bar-bg">
                <div
                  class="usage-bar-fill"
                  :class="{ 'usage-bar-fill--animated': ready }"
                  :style="{
                    '--bar-width': `${billing.usagePercent(resource)}%`,
                    '--bar-color': usageColor(billing.usagePercent(resource)),
                    transitionDelay: `${idx * 0.1}s`,
                  }"
                />
              </div>
            </div>
          </div>

          <div class="feature-access mt-4">
            <div
              v-for="feat in [
                { key: 'api', label: 'API', active: billing.features.api },
                { key: 'scim', label: 'SCIM', active: billing.features.scim },
                { key: 'sso', label: 'SSO', active: billing.features.sso },
                { key: 'export', label: 'Export', active: billing.features.reports !== 'basic' },
              ]"
              :key="feat.key"
              class="feature-chip"
              :class="{ 'feature-chip--active': feat.active }"
            >
              <i :class="feat.active ? 'pi pi-check' : 'pi pi-lock'" />
              {{ feat.label }}
            </div>
          </div>
        </div>

        <div class="an-card plans-section" :class="{ 'plans-section--ready': ready }">
          <h2 class="section-title mb-4">Pläne vergleichen</h2>
          <div class="plan-compare-grid">
            <div
              v-for="(plan, idx) in billing.plans"
              :key="plan.key"
              class="plan-compare-card"
              :class="{
                'plan-compare-card--current': plan.key === billing.basePlan,
                'plan-compare-card--popular': plan.popular,
              }"
              :style="{ '--plan-idx': idx }"
            >
              <Tag v-if="plan.key === billing.basePlan" value="Abonnement" severity="success" class="current-badge" />
              <div class="compare-plan-name">{{ plan.name }}</div>
              <div class="compare-price">
                {{ plan.pricing ? `€${plan.pricing.monthly / 100}` : '€0' }}
                <span>/Mo</span>
              </div>
              <div class="compare-tagline">{{ plan.tagline }}</div>
              <div class="compare-limits">
                <div><i class="pi pi-box limit-icon" /> {{ plan.limits.assets === -1 ? '∞' : plan.limits.assets }} Assets</div>
                <div><i class="pi pi-users limit-icon" /> {{ plan.limits.users === -1 ? '∞' : plan.limits.users }} Benutzer</div>
                <div><i class="pi pi-link limit-icon" /> {{ plan.limits.integrations === -1 ? 'Alle' : plan.limits.integrations }} Integrationen</div>
                <div v-if="plan.limits.api"><i class="pi pi-check limit-icon limit-icon--green" /> API</div>
                <div v-if="plan.limits.sso"><i class="pi pi-check limit-icon limit-icon--green" /> SSO</div>
              </div>
            </div>
          </div>
        </div>

        <div class="an-card invoices-section" :class="{ 'invoices-section--ready': ready }">
          <h2 class="section-title mb-4">Rechnungen</h2>
          <table v-if="billing.invoices.length" class="an-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Datum</th>
                <th>Betrag</th>
                <th>Status</th>
                <th class="text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in billing.invoices" :key="inv.id">
                <td class="font-mono">{{ inv.number || '—' }}</td>
                <td>{{ fmtDate(inv.issueDate || inv.date) }}</td>
                <td class="font-bold">{{ fmtCents(inv.amountCents || inv.amount) }}</td>
                <td>
                  <Tag
                    :value="inv.status === 'paid' ? 'Bezahlt' : inv.status === 'unpaid' ? 'Ausstehend' : inv.status === 'overdue' ? 'Überfällig' : inv.status"
                    :severity="inv.status === 'paid' ? 'success' : inv.status === 'unpaid' ? 'info' : 'danger'"
                  />
                </td>
                <td class="text-right">
                  <Button v-if="inv.hasAttachment || inv.downloadUrl" icon="pi pi-download" size="small" text severity="info" @click="downloadInvoice(inv.id)" />
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="invoice-empty">
            <div class="invoice-empty-icon">
              <i class="pi pi-file" />
            </div>
            <p class="invoice-empty-title">Noch keine Rechnungen</p>
            <p class="invoice-empty-text">Rechnungen erscheinen hier nach Ihrer ersten Zahlung.</p>
          </div>
        </div>
      </template>
    </div>

    <Dialog v-model:visible="showTrialDialog" header="Plan upgraden" :modal="true" :closable="true" style="width: 440px;" class="billing-dialog">
      <div class="dialog-body">
        <div class="dialog-field">
          <label class="dialog-label">Plan wählen</label>
          <Select
            v-model="selectedPlan"
            :options="upgradablePlans.map(p => ({ label: `${p.name} — €${(p.pricing?.monthly || 0) / 100}/Mo`, value: p.key }))"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">Abrechnungszeitraum</label>
          <Select v-model="selectedInterval" :options="intervalOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div v-if="selectedPricePreview" class="dialog-price-preview">
          <i class="pi pi-tag" />
          <span>{{ selectedPricePreview }}</span>
        </div>
        <Message severity="info" :closable="false" class="mt-2">
          {{ selectedTrialDays }} Tage kostenlos testen — keine Zahlungsdaten erforderlich.
        </Message>
      </div>
      <template #footer>
        <Button label="Abbrechen" text severity="secondary" @click="showTrialDialog = false" />
        <Button label="Testphase starten" icon="pi pi-play" severity="primary" class="upgrade-btn" @click="handleStartTrial" :loading="billing.loading" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showSubscribeDialog" header="Abonnement abschließen" :modal="true" :closable="true" style="width: 520px;" class="billing-dialog">
      <div class="dialog-body">
        <Message severity="info" :closable="false">
          Bitte geben Sie Ihre Rechnungsadresse ein. Die Rechnung wird per SEPA-Überweisung bezahlt.
        </Message>

        <div class="dialog-field">
          <label class="dialog-label">Plan</label>
          <Select
            v-model="selectedPlan"
            :options="subscribablePlans.map(p => ({ label: `${p.name} — €${(p.pricing?.monthly || 0) / 100}/Mo`, value: p.key }))"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">Abrechnungszeitraum</label>
          <Select v-model="selectedInterval" :options="intervalOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>

        <div v-if="selectedPricePreview" class="dialog-price-preview">
          <i class="pi pi-tag" />
          <span>{{ selectedPricePreview }}</span>
        </div>

        <hr style="border: 1px solid var(--an-border); margin: 8px 0;" />

        <div class="dialog-field">
          <label class="dialog-label">Firmenname *</label>
          <InputText v-model="billingForm.companyName" class="w-full" placeholder="ACME GmbH" />
        </div>
        <div class="dialog-row">
          <div class="dialog-field" style="flex: 2;">
            <label class="dialog-label">Straße *</label>
            <InputText v-model="billingForm.street" class="w-full" placeholder="Musterstraße 42" />
          </div>
          <div class="dialog-field" style="flex: 1;">
            <label class="dialog-label">PLZ *</label>
            <InputText v-model="billingForm.zipCode" class="w-full" placeholder="10115" />
          </div>
        </div>
        <div class="dialog-row">
          <div class="dialog-field" style="flex: 2;">
            <label class="dialog-label">Stadt *</label>
            <InputText v-model="billingForm.city" class="w-full" placeholder="Berlin" />
          </div>
          <div class="dialog-field" style="flex: 1;">
            <label class="dialog-label">Land *</label>
            <InputText v-model="billingForm.countryCode" class="w-full" placeholder="DE" maxlength="2" />
          </div>
        </div>
        <div class="dialog-field">
          <label class="dialog-label">USt-IdNr. (optional)</label>
          <InputText v-model="billingForm.vatNumber" class="w-full" placeholder="DE123456789" />
        </div>
      </div>
      <template #footer>
        <Button label="Abbrechen" text severity="secondary" @click="showSubscribeDialog = false" />
        <Button label="Rechnung erstellen" icon="pi pi-file" severity="primary" class="upgrade-btn" @click="handleSubscribe" :loading="billing.loading" :disabled="!subscribeFormValid" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showCancelDialog" header="Abonnement kündigen" :modal="true" :closable="true" style="width: 440px;" class="billing-dialog">
      <div class="cancel-dialog-body">
        <div class="cancel-warning-icon">
          <i class="pi pi-exclamation-triangle" />
        </div>
        <p class="cancel-dialog-text">
          Möchten Sie Ihr <strong>{{ billing.basePlanName }}</strong>-Abonnement wirklich kündigen?
        </p>
        <p class="cancel-dialog-subtext">
          Sie behalten Zugang bis zum Ende der aktuellen Abrechnungsperiode. Danach wird Ihr Konto auf den Free-Plan zurückgesetzt.
        </p>
      </div>
      <template #footer>
        <Button label="Nicht kündigen" text severity="secondary" @click="showCancelDialog = false" />
        <Button label="Ja, kündigen" icon="pi pi-times" severity="danger" @click="handleCancel" :loading="billing.loading" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.12; }
}

.billing-header {
  margin-bottom: 32px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.billing-header--ready { opacity: 1; transform: translateY(0); }
.billing-header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; }
.billing-header p { color: var(--an-text-subtle); font-size: 14px; }

.billing-skeleton { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
.skeleton-card {
  height: 200px; border-radius: 16px; background: var(--an-surface-dark);
  border: 1px solid var(--an-border-dark);
}
.skeleton-card--small { height: 200px; }
.skeleton-card--full { grid-column: 1 / -1; height: 160px; }
.skeleton-pulse { animation: skeletonPulse 1.8s ease-in-out infinite; }

.billing-grid {
  display: grid; grid-template-columns: 1fr 320px; gap: 16px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s;
}
.billing-grid--ready { opacity: 1; transform: translateY(0); }
@media (max-width: 768px) { .billing-grid { grid-template-columns: 1fr; } .billing-skeleton { grid-template-columns: 1fr; } }

.billing-plan-card { padding: 28px; }
.plan-name-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.plan-name { font-size: 1.4rem; font-weight: 700; }
.plan-interval { color: var(--an-text-muted); font-size: 13px; }
.plan-price-display { text-align: right; }
.plan-price { font-size: 2rem; font-weight: 800; }
.plan-price-label { color: var(--an-text-muted); font-size: 12px; display: block; }

.trial-banner, .past-due-banner, .cancel-banner {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  border-radius: 10px; font-size: 13px; margin-top: 16px;
}
.trial-banner { background: rgba(59,130,246,0.08); color: var(--p-blue-400); border: 1px solid rgba(59,130,246,0.15); }
.past-due-banner { background: rgba(234,179,8,0.08); color: var(--p-orange-400); border: 1px solid rgba(234,179,8,0.15); }
.cancel-banner { background: rgba(239,68,68,0.06); color: var(--p-red-400); border: 1px solid rgba(239,68,68,0.12); }
.period-info { color: var(--an-text-subtle); font-size: 13px; margin-top: 12px; display: flex; align-items: center; }

.reactivate-link {
  color: var(--an-emerald); font-weight: 600; text-decoration: none;
  transition: opacity 0.2s;
}
.reactivate-link:hover { opacity: 0.8; text-decoration: underline; }

.plan-actions { display: flex; gap: 8px; margin-top: 20px; }
.upgrade-btn {
  background: var(--an-emerald) !important; border: none !important;
  color: #000 !important; font-weight: 600 !important;
  box-shadow: 0 0 20px rgba(52, 211, 153, 0.15);
  transition: box-shadow 0.3s, transform 0.2s !important;
}
.upgrade-btn:hover {
  box-shadow: 0 0 30px rgba(52, 211, 153, 0.25) !important;
  transform: translateY(-1px);
}
.cancel-btn { transition: opacity 0.2s !important; }
.cancel-btn:hover { opacity: 0.85; }

.billing-stats-card { padding: 28px; }
.stat-group { }
.stat-icon-row { display: flex; align-items: center; gap: 8px; }
.stat-icon { font-size: 13px; color: var(--an-text-muted); }
.stat-value { font-size: 15px; font-weight: 500; margin-top: 6px; }
.stat-value--method { display: flex; align-items: center; gap: 8px; }
.stat-divider { border-top: 1px solid var(--an-border-dark); margin: 18px 0; }
.section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--an-text-muted);
}
.payment-badge {
  display: inline-block; background: rgba(59,130,246,0.12); color: var(--p-blue-400);
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
  letter-spacing: 0.03em;
}

.usage-card {
  margin-top: 16px; padding: 28px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s;
}
.usage-card--ready { opacity: 1; transform: translateY(0); }

.usage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px; }
.usage-item { }
.usage-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.usage-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.usage-icon { font-size: 12px; color: var(--an-text-muted); }
.usage-values { font-size: 12px; color: var(--an-text-muted); font-family: 'SF Mono', 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
.usage-bar-bg { height: 6px; border-radius: 999px; background: var(--an-border-dark); overflow: hidden; }
.usage-bar-fill {
  height: 100%; border-radius: 999px; width: 0;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s;
  min-width: 2px;
}
.usage-bar-fill--animated {
  width: var(--bar-width) !important;
  background: var(--bar-color) !important;
}

.feature-access { display: flex; flex-wrap: wrap; gap: 10px; }
.feature-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  color: var(--an-text-muted);
  transition: all 0.3s ease;
  cursor: default;
}
.feature-chip--active {
  border-color: var(--an-emerald); color: var(--an-emerald);
  background: rgba(52,211,153,0.06);
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.06);
}
.feature-chip i { font-size: 11px; }

.plans-section {
  margin-top: 16px; padding: 28px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s;
}
.plans-section--ready { opacity: 1; transform: translateY(0); }

.plan-compare-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 768px) { .plan-compare-grid { grid-template-columns: repeat(2, 1fr); } }

.plan-compare-card {
  padding: 22px; border: 1px solid var(--an-border-dark); border-radius: 14px;
  position: relative; transition: all 0.3s ease;
  cursor: default;
}
.plan-compare-card:hover {
  border-color: var(--an-border-subtle);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.plan-compare-card--current {
  border-color: var(--an-emerald); background: rgba(52,211,153,0.04);
}
.plan-compare-card--current:hover { border-color: var(--an-emerald); }
.current-badge { position: absolute; top: -10px; right: 12px; }

.compare-plan-name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
.compare-price { font-size: 1.6rem; font-weight: 800; margin-bottom: 4px; }
.compare-price span { font-size: 12px; color: var(--an-text-muted); font-weight: 400; }
.compare-tagline { font-size: 12px; color: var(--an-text-subtle); margin-bottom: 14px; }
.compare-limits { font-size: 12px; color: var(--an-text-subtle); display: flex; flex-direction: column; gap: 5px; }

.limit-icon { font-size: 10px; color: var(--an-text-muted); margin-right: 4px; }
.limit-icon--green { color: var(--an-emerald) !important; }

.invoices-section {
  margin-top: 16px; padding: 28px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s;
}
.invoices-section--ready { opacity: 1; transform: translateY(0); }

.invoice-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 48px 20px; text-align: center;
}
.invoice-empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
}
.invoice-empty-icon i { font-size: 24px; color: var(--an-text-muted); }
.invoice-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.invoice-empty-text { font-size: 13px; color: var(--an-text-muted); max-width: 280px; }

.dialog-body { display: flex; flex-direction: column; gap: 16px; }
.dialog-field { }
.dialog-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block; }
.dialog-price-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 8px;
  background: rgba(52, 211, 153, 0.06); border: 1px solid rgba(52, 211, 153, 0.12);
  font-size: 13px; font-weight: 600; color: var(--an-emerald);
}
.dialog-row { display: flex; gap: 12px; }
.font-mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }

.cancel-dialog-body { text-align: center; padding: 8px 0; }
.cancel-warning-icon {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
  background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15);
  display: flex; align-items: center; justify-content: center;
}
.cancel-warning-icon i { font-size: 24px; color: var(--p-red-400); }
.cancel-dialog-text { font-size: 15px; font-weight: 500; margin-bottom: 8px; }
.cancel-dialog-subtext { font-size: 13px; color: var(--an-text-subtle); line-height: 1.6; }

.msg-enter-active { transition: all 0.3s ease; }
.msg-leave-active { transition: all 0.2s ease; }
.msg-enter-from { opacity: 0; transform: translateY(-8px); }
.msg-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
