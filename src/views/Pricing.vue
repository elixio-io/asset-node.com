<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import Button from 'primevue/button'

const router = useRouter()
const themeStore = useThemeStore()

const isAnnual = ref(false)
const pageReady = ref(false)

const plans = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'For small teams getting started',
    monthlyPrice: 0,
    annualPrice: 0,
    popular: false,
    cta: 'Start free now',
    ctaStyle: 'secondary',
    icon: 'pi pi-users',
    features: [
      { text: '100 Assets', included: true },
      { text: '5 Users', included: true },
      { text: 'Basic Reports', included: true },
      { text: '1 MDM Integration', included: true },
      { text: '1 Workflow Automation', included: true },
      { text: 'Unlimited Custom Fields', included: true },
      { text: 'Read-only API', included: true },
      { text: 'Hosted in Germany', included: true },
      { text: 'SSO / SAML', included: false },
    ]
  },
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For growing companies',
    monthlyPrice: 20,
    annualPrice: 200,
    popular: false,
    cta: 'Start 30-day Enterprise trial',
    ctaStyle: 'primary',
    icon: 'pi pi-bolt',
    features: [
      { text: '500 Assets', included: true },
      { text: '10 Users', included: true },
      { text: 'All Reports', included: true },
      { text: 'Full API Access', included: true },
      { text: '2 Integrations', included: true },
      { text: '3 Automations', included: true },
      { text: 'Unlimited Custom Fields', included: true },
      { text: 'Email Support', included: true },
      { text: 'SSO / SAML', included: false },
    ]
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For professional IT management',
    monthlyPrice: 50,
    annualPrice: 500,
    popular: true,
    cta: 'Start 30-day Enterprise trial',
    ctaStyle: 'primary',
    icon: 'pi pi-star',
    features: [
      { text: 'Unlimited Assets', included: true },
      { text: '50 Users', included: true },
      { text: 'Reports + CSV Export', included: true },
      { text: 'Full API Access', included: true },
      { text: 'All Integrations', included: true },
      { text: 'Unlimited Automations', included: true },
      { text: 'Unlimited Custom Fields', included: true },
      { text: 'SCIM Provisioning', included: true },
      { text: 'SSO / SAML', included: true },
    ]
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For enterprises with custom requirements',
    monthlyPrice: 150,
    annualPrice: 1500,
    popular: false,
    cta: 'Book a demo',
    ctaStyle: 'secondary',
    icon: 'pi pi-building',
    features: [
      { text: 'Unlimited Assets', included: true },
      { text: 'Unlimited Users', included: true },
      { text: 'Reports + CSV Export', included: true },
      { text: 'Full API Access', included: true },
      { text: 'All Integrations + Priority', included: true },
      { text: 'Unlimited Automations', included: true },
      { text: 'Unlimited Custom Fields', included: true },
      { text: 'SCIM Provisioning', included: true },
      { text: 'SSO / SAML + Dedicated Support', included: true },
    ]
  },
]

const faqs = [
  {
    question: 'How does the 30-day trial work?',
    answer: 'Every new workspace starts with the complete Enterprise feature set for 30 days. No payment details are required. Afterwards, you can choose a plan or continue on Free.',
    open: false,
  },
  {
    question: 'How do I pay?',
    answer: 'We invoice monthly or annually. Payment is made via SEPA bank transfer — no credit card required.',
    open: false,
  },
  {
    question: 'Can I change my plan anytime?',
    answer: 'Yes, you can upgrade anytime. If you downgrade, you keep your current plan until the end of the billing period.',
    open: false,
  },
  {
    question: 'Where is my data stored?',
    answer: 'All data is hosted and processed on German servers (Hetzner, Nuremberg). We are fully GDPR compliant.',
    open: false,
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer: 'Your data is preserved. You simply cannot create new assets beyond the limit. Existing data remains fully accessible.',
    open: false,
  },
]

const faqItems = ref(faqs)

function toggleFaq(index: number) {
  faqItems.value[index].open = !faqItems.value[index].open
}

function handleCta(planKey: string) {
  if (planKey === 'free') {
    router.push('/sign-up')
  } else if (planKey === 'enterprise') {
    window.open('mailto:contact@asset-node.com?subject=Enterprise%20Demo%20Request', '_blank')
  } else {
    router.push(`/sign-up?plan=${planKey}`)
  }
}

onMounted(() => {
  setTimeout(() => { pageReady.value = true }, 100)

  const offers = plans.filter(p => p.monthlyPrice > 0).map(p => ({
    '@type': 'Offer',
    name: `AssetNode ${p.name}`,
    price: isAnnual.value ? p.annualPrice : p.monthlyPrice,
    priceCurrency: 'EUR',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: p.monthlyPrice,
      priceCurrency: 'EUR',
      billingDuration: 'P1M',
    },
    description: p.tagline,
  }))

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'AssetNode',
    description: 'IT Asset Management Platform',
    offers,
  }

  const existing = document.getElementById('pricing-jsonld')
  if (existing) existing.remove()
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.id = 'pricing-jsonld'
  script.textContent = JSON.stringify(schema)
  document.head.appendChild(script)
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="pricing-content">
      <div class="pricing-header" :class="{ 'pricing-header--ready': pageReady }">
        <div class="pricing-header-badge">Pricing</div>
        <h1>Simple, transparent pricing</h1>
        <p>Every new workspace starts with the complete Enterprise feature set free for 30 days.</p>

        <div class="billing-toggle">
          <span :class="{ active: !isAnnual }">Monthly</span>
          <button
            class="toggle-switch"
            :class="{ 'toggle-switch--on': isAnnual }"
            @click="isAnnual = !isAnnual"
            aria-label="Billing toggle"
          >
            <div class="toggle-knob" />
          </button>
          <span :class="{ active: isAnnual }">
            Annual
            <span class="annual-badge">2 months free</span>
          </span>
        </div>
      </div>

      <div class="pricing-grid">
        <div
          v-for="(plan, idx) in plans"
          :key="plan.key"
          class="pricing-card"
          :class="{
            'pricing-card--highlight': plan.popular,
            'pricing-card--free': plan.key === 'free',
            'pricing-card--ready': pageReady,
          }"
          :style="{ '--card-idx': idx }"
        >
          <div v-if="plan.popular" class="pricing-badge">Most Popular</div>

          <h3 class="pricing-plan-name">{{ plan.name }}</h3>
          <p class="pricing-tagline">{{ plan.tagline }}</p>

          <div v-if="plan.monthlyPrice === 0" class="pricing-price-wrap">
            <span class="pricing-amount">€0</span>
            <span class="pricing-period">free forever</span>
          </div>
          <div v-else class="pricing-price-wrap">
            <div class="pricing-price">
              <span class="pricing-currency">€</span>
              <Transition name="price-flip" mode="out-in">
                <span class="pricing-amount" :key="isAnnual ? 'annual' : 'monthly'">{{ isAnnual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice }}</span>
              </Transition>
            </div>
            <span class="pricing-period">
              per month{{ isAnnual ? `, €${plan.annualPrice}/year` : '' }}
            </span>
            <Transition name="savings-slide">
              <div v-if="isAnnual" class="pricing-savings">
                <i class="pi pi-percentage" style="font-size:10px;" />
                You save €{{ plan.monthlyPrice * 12 - plan.annualPrice }} per year
              </div>
            </Transition>
          </div>

          <Button
            :label="plan.cta"
            :class="[
              'w-full mt-4',
              plan.ctaStyle === 'primary' ? 'pricing-cta-primary' : 'pricing-cta-secondary'
            ]"
            @click="handleCta(plan.key)"
          />

          <ul class="pricing-features">
            <li v-for="f in plan.features" :key="f.text" :class="{ 'feature--disabled': !f.included }">
              <i :class="f.included ? 'pi pi-check' : 'pi pi-times'" />
              {{ f.text }}
            </li>
          </ul>
        </div>
      </div>

      <div class="trust-row" :class="{ 'trust-row--ready': pageReady }">
        <div v-for="(trust, i) in [
          { icon: 'pi pi-shield', text: 'GDPR Compliant' },
          { icon: 'pi pi-server', text: 'Hosted in Germany' },
          { icon: 'pi pi-credit-card', text: 'Pay by invoice' },
          { icon: 'pi pi-lock', text: 'AES-256 Encryption' },
        ]" :key="i" class="trust-item">
          <i :class="trust.icon" />
          <span>{{ trust.text }}</span>
        </div>
      </div>

      <div class="faq-section" :class="{ 'faq-section--ready': pageReady }">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">
          <div
            v-for="(faq, i) in faqItems"
            :key="i"
            class="faq-item"
            :class="{ 'faq-item--open': faq.open }"
          >
            <button class="faq-question" @click="toggleFaq(i)">
              <span>{{ faq.question }}</span>
              <i class="faq-chevron" :class="faq.open ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
            </button>
            <Transition name="faq-expand">
              <div v-if="faq.open" class="faq-answer">
                {{ faq.answer }}
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div class="bottom-cta" :class="{ 'bottom-cta--ready': pageReady }">
        <h2>Ready to get started?</h2>
        <p>Start free today and upgrade when you're ready.</p>
        <div class="bottom-cta-buttons">
          <Button label="Start free now" class="pricing-cta-primary" @click="router.push('/sign-up')" />
          <Button label="Book a demo" class="pricing-cta-secondary" @click="window.open('mailto:contact@asset-node.com?subject=Demo%20Request', '_blank')" />
        </div>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>


.pricing-content { max-width: 1200px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; width: 100%; }

.pricing-header {
  text-align: center; margin-bottom: 56px;
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.pricing-header--ready { opacity: 1; transform: translateY(0); }

.pricing-header-badge {
  display: inline-block; background: rgba(52, 211, 153, 0.08);
  color: var(--an-emerald); font-size: 12px; font-weight: 700;
  padding: 4px 16px; border-radius: 999px; border: 1px solid rgba(52, 211, 153, 0.15);
  margin-bottom: 20px; letter-spacing: 0.05em; text-transform: uppercase;
}

.pricing-header h1 {
  font-size: 2.6rem; font-weight: 800; letter-spacing: -0.03em;
  margin-bottom: 14px; line-height: 1.15;
}
.pricing-header p {
  color: var(--an-text-subtle); font-size: 1.15rem; max-width: 520px;
  margin: 0 auto 36px; line-height: 1.6;
}

.billing-toggle {
  display: inline-flex; align-items: center; gap: 16px;
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  border-radius: 999px; padding: 8px 24px; font-size: 14px; font-weight: 500;
}
.billing-toggle span { color: var(--an-text-muted); transition: color 0.3s; }
.billing-toggle span.active { color: var(--an-text-primary); font-weight: 600; }

.toggle-switch {
  width: 48px; height: 26px; border-radius: 999px; border: none; cursor: pointer;
  background: var(--an-border-dark); position: relative; transition: background 0.3s;
  padding: 0;
}
.toggle-switch--on { background: var(--an-emerald); }
.toggle-knob {
  width: 20px; height: 20px; border-radius: 50%; background: white;
  position: absolute; top: 3px; left: 3px; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.toggle-switch--on .toggle-knob { transform: translateX(22px); }

.annual-badge {
  display: inline-block; background: var(--an-emerald); color: #000;
  font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px;
  margin-left: 6px; vertical-align: middle;
}

.pricing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 48px; }
@media (max-width: 1024px) { .pricing-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .pricing-grid { grid-template-columns: 1fr; } }

.pricing-card {
  padding: 32px 28px; border: 1px solid var(--an-border-dark); border-radius: 16px;
  background: var(--an-surface-dark); position: relative; display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s;
  opacity: 0; transform: translateY(24px);
}
.pricing-card--ready {
  opacity: 1; transform: translateY(0);
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease, border-color 0.3s;
  transition-delay: calc(var(--card-idx) * 0.08s);
}
.pricing-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(0,0,0,0.2); }
.pricing-card--ready:hover { transform: translateY(-6px); }

.pricing-card--highlight {
  border-color: var(--an-emerald);
  box-shadow: 0 0 60px rgba(52, 211, 153, 0.08), 0 0 0 1px rgba(52, 211, 153, 0.1);
  background: linear-gradient(to bottom, rgba(52, 211, 153, 0.04), var(--an-surface-dark));
}

.pricing-badge {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  background: var(--an-emerald); color: #000; font-size: 12px; font-weight: 700;
  padding: 4px 20px; border-radius: 999px; white-space: nowrap;
  box-shadow: 0 4px 12px rgba(52, 211, 153, 0.2);
}

.pricing-plan-name { font-size: 1.3rem; font-weight: 700; margin-bottom: 4px; }
.pricing-tagline { color: var(--an-text-subtle); font-size: 13px; margin-bottom: 20px; line-height: 1.4; min-height: 38px; }

.pricing-price-wrap { margin-bottom: 4px; min-height: 90px; }
.pricing-price { display: flex; align-items: flex-start; gap: 2px; }
.pricing-currency { font-size: 1.4rem; font-weight: 600; margin-top: 6px; }
.pricing-amount { font-size: 3.2rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.pricing-period { color: var(--an-text-muted); font-size: 13px; display: block; margin-top: 4px; }
.pricing-savings {
  color: var(--an-emerald); font-size: 12px; font-weight: 600;
  margin-top: 6px; display: flex; align-items: center; gap: 4px;
}

.price-flip-enter-active { transition: all 0.25s ease; }
.price-flip-leave-active { transition: all 0.15s ease; position: absolute; }
.price-flip-enter-from { opacity: 0; transform: translateY(8px); }
.price-flip-leave-to { opacity: 0; transform: translateY(-8px); }

.savings-slide-enter-active { transition: all 0.3s ease 0.1s; }
.savings-slide-leave-active { transition: all 0.15s ease; }
.savings-slide-enter-from { opacity: 0; transform: translateY(-4px); }
.savings-slide-leave-to { opacity: 0; height: 0; }

.pricing-cta-primary {
  background: var(--an-emerald) !important; border: none !important;
  color: #000 !important; font-weight: 600 !important;
  transition: filter 0.2s, box-shadow 0.3s, transform 0.2s !important;
  box-shadow: 0 0 20px rgba(52, 211, 153, 0.12);
}
.pricing-cta-primary:hover {
  filter: brightness(1.08) !important;
  box-shadow: 0 0 30px rgba(52, 211, 153, 0.22) !important;
  transform: translateY(-1px);
}
.pricing-cta-secondary {
  background: transparent !important; border: 1px solid var(--an-border-subtle) !important;
  color: var(--an-text-primary) !important; transition: all 0.2s !important;
}
.pricing-cta-secondary:hover {
  border-color: var(--an-text-muted) !important;
  background: rgba(255,255,255,0.03) !important;
}

.pricing-features { list-style: none; padding: 0; margin-top: 24px; flex: 1; }
.pricing-features li {
  display: flex; align-items: center; gap: 10px; font-size: 13px;
  color: var(--an-text-subtle); padding: 7px 0;
  transition: opacity 0.2s;
}
.pricing-features li i.pi-check { color: var(--an-emerald); font-size: 12px; flex-shrink: 0; }
.pricing-features li i.pi-times { color: var(--an-text-muted); font-size: 11px; opacity: 0.5; flex-shrink: 0; }
.pricing-features li.feature--disabled { opacity: 0.4; }

.trust-row {
  display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;
  padding: 36px 0; margin-bottom: 64px;
  border-top: 1px solid var(--an-border-dark); border-bottom: 1px solid var(--an-border-dark);
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s;
}
.trust-row--ready { opacity: 1; transform: translateY(0); }

.trust-item {
  display: flex; align-items: center; gap: 10px; font-size: 14px;
  color: var(--an-text-subtle); font-weight: 500;
  transition: color 0.3s;
}
.trust-item:hover { color: var(--an-text-primary); }
.trust-item i { color: var(--an-emerald); font-size: 16px; transition: transform 0.3s; }
.trust-item:hover i { transform: scale(1.15); }

.faq-section {
  max-width: 700px; margin: 0 auto 64px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.6s, transform 0.5s ease 0.6s;
}
.faq-section--ready { opacity: 1; transform: translateY(0); }

.faq-section h2 { font-size: 1.8rem; font-weight: 700; text-align: center; margin-bottom: 36px; }

.faq-item {
  border: 1px solid var(--an-border-dark); border-radius: 14px;
  margin-bottom: 12px; overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.faq-item:hover { border-color: var(--an-border-subtle); }
.faq-item--open {
  border-color: var(--an-border-subtle);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.faq-question {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; background: none; border: none; cursor: pointer;
  color: var(--an-text-primary); font-size: 15px; font-weight: 600; text-align: left;
  transition: background 0.2s;
}
.faq-question:hover { background: rgba(255,255,255,0.02); }
.faq-chevron {
  color: var(--an-text-muted); font-size: 12px;
  transition: transform 0.3s ease, color 0.3s;
}
.faq-item--open .faq-chevron { color: var(--an-emerald); }

.faq-answer {
  padding: 0 22px 18px; color: var(--an-text-subtle); font-size: 14px; line-height: 1.7;
}

.faq-expand-enter-active { transition: all 0.3s ease; }
.faq-expand-leave-active { transition: all 0.2s ease; }
.faq-expand-enter-from { opacity: 0; transform: translateY(-6px); }
.faq-expand-leave-to { opacity: 0; transform: translateY(-4px); }

.bottom-cta {
  text-align: center; padding: 56px 24px;
  background: var(--an-surface-dark); border: 1px solid var(--an-border-dark);
  border-radius: 20px;
  opacity: 0; transform: translateY(16px);
  transition: opacity 0.5s ease 0.7s, transform 0.5s ease 0.7s;
}
.bottom-cta--ready { opacity: 1; transform: translateY(0); }

.bottom-cta h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 8px; }
.bottom-cta p { color: var(--an-text-subtle); font-size: 15px; margin-bottom: 28px; }
.bottom-cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }


.legal-page--light .pricing-card { background: white; border-color: #e5e7eb; }
.legal-page--light .pricing-card--highlight { border-color: var(--an-emerald); background: linear-gradient(to bottom, rgba(52, 211, 153, 0.03), white); }
.legal-page--light .pricing-card:hover { box-shadow: 0 16px 48px rgba(0,0,0,0.06); }
.legal-page--light .billing-toggle { background: white; border-color: #e5e7eb; }
.legal-page--light .toggle-switch { background: #d1d5db; }
.legal-page--light .faq-item { border-color: #e5e7eb; }
.legal-page--light .faq-question:hover { background: rgba(0,0,0,0.02); }
.legal-page--light .trust-row { border-color: #e5e7eb; }
.legal-page--light .bottom-cta { background: white; border-color: #e5e7eb; }
.legal-page--light .pricing-header-badge { background: rgba(52, 211, 153, 0.06); border-color: rgba(52, 211, 153, 0.12); }
</style>
