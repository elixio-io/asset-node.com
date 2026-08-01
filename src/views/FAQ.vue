<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import Button from 'primevue/button'
import { ref, onMounted } from 'vue'

const router = useRouter()
const themeStore = useThemeStore()

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is AssetNode?',
        a: 'AssetNode is a modern IT asset management platform that helps companies track hardware, manage software licenses, automate employee onboarding/offboarding, and maintain audit trails — all from a single dashboard.'
      },
      {
        q: 'How do I get started?',
        a: 'Sign up for a free account. Our onboarding wizard will guide you through importing your first assets and inviting team members. No credit card required.'
      },
      {
        q: 'Is AssetNode free?',
        a: 'AssetNode is currently in early access and free to use. We will announce pricing plans in the future — early users will be notified in advance.'
      },
      {
        q: 'Can I import existing inventory data?',
        a: 'Yes. AssetNode supports CSV import for hardware, employees, licenses, and assignments. We also offer a REST API for programmatic bulk imports.'
      },
    ]
  },
  {
    category: 'Features & Capabilities',
    items: [
      {
        q: 'What types of assets can I track?',
        a: 'Laptops, desktops, tablets, phones, monitors, servers, networking equipment, printers, and peripherals. You can also manage software licenses, consumables, and custom asset categories.'
      },
      {
        q: 'Does AssetNode support multiple locations?',
        a: 'Yes. You can define locations (offices, warehouses, remote sites) and assign assets to specific locations. Filter and report by location at any time.'
      },
      {
        q: 'How does employee assignment work?',
        a: 'Create assignment records that link assets to employees with expected return dates and notes. When an employee leaves, initiate a return flow that updates asset status automatically.'
      },
      {
        q: 'Can I track depreciation?',
        a: 'Yes. AssetNode calculates depreciation automatically based on purchase date, price, and configurable depreciation schedules (straight-line or declining balance).'
      },
    ]
  },
  {
    category: 'Integrations',
    items: [
      {
        q: 'Which MDM solutions does AssetNode integrate with?',
        a: 'AssetNode supports integrations with Microsoft Intune, Windows Autopilot, Jamf Pro, and Kandji. Device enrollment data syncs automatically.'
      },
      {
        q: 'Does AssetNode support SCIM provisioning?',
        a: 'Yes. Our SCIM 2.0 endpoint supports user provisioning from identity providers including Okta, Azure AD, and OneLogin.'
      },
      {
        q: 'Is there an API?',
        a: 'Yes. AssetNode offers a REST API with API key authentication. Every entity (hardware, employees, assignments, licenses) is accessible programmatically.'
      },
    ]
  },
  {
    category: 'Security & Data',
    items: [
      {
        q: 'Where is my data stored?',
        a: 'All data is stored on Hetzner Cloud infrastructure in Germany. We use Cloudflare for CDN and DDoS protection, which is US-headquartered but processes data under EU-compliant agreements.'
      },
      {
        q: 'Is AssetNode GDPR compliant?',
        a: 'AssetNode is built with GDPR compliance in mind. We offer data export and deletion capabilities. Our primary servers are located in Germany. Where data passes through non-EU infrastructure (e.g. CDN), we rely on Standard Contractual Clauses.'
      },
      {
        q: 'Do you provide audit trails?',
        a: 'Yes. Every action in AssetNode is logged with timestamps, user identity, and change details. Audit trails are exportable for compliance reviews.'
      },
    ]
  },
]

const openItems = ref<Set<string>>(new Set())

function toggleItem(id: string) {
  if (openItems.value.has(id)) {
    openItems.value.delete(id)
  } else {
    openItems.value.add(id)
  }
  openItems.value = new Set(openItems.value)
}

function isOpen(id: string) {
  return openItems.value.has(id)
}

onMounted(() => {
  const allItems = faqs.flatMap(cat => cat.items)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      }
    }))
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://asset-node.com/' },
      { '@type': 'ListItem', position: 2, name: 'FAQ' }
    ]
  }

  const schemas = [
    { id: 'faq-jsonld', data: faqSchema },
    { id: 'breadcrumb-jsonld', data: breadcrumb }
  ]
  for (const { id, data } of schemas) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    script.id = id
    document.head.appendChild(script)
  }
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="faq-content">
      <div class="faq-header">
        <h1>Frequently Asked Questions</h1>
        <p>Everything you need to know about AssetNode.</p>
      </div>

      <div class="faq-categories">
        <div v-for="(cat, ci) in faqs" :key="cat.category" class="faq-category">
          <h2>{{ cat.category }}</h2>
          <div class="faq-items">
            <div
              v-for="(item, ii) in cat.items"
              :key="`${ci}-${ii}`"
              class="faq-item"
              :class="{ 'faq-item--open': isOpen(`${ci}-${ii}`) }"
            >
              <button class="faq-question" @click="toggleItem(`${ci}-${ii}`)">
                <span>{{ item.q }}</span>
                <i class="pi pi-plus faq-icon" :class="{ 'faq-icon--open': isOpen(`${ci}-${ii}`) }" />
              </button>
              <div class="faq-answer" :class="{ 'faq-answer--open': isOpen(`${ci}-${ii}`) }">
                <p>{{ item.a }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section class="faq-cta">
        <h2>Still have questions?</h2>
        <p>Our team is happy to help. Check back soon for contact options.</p>
        <div class="flex justify-content-center gap-3 mt-4">
          <Button label="View API Docs" icon="pi pi-code" severity="secondary" outlined @click="router.push('/api-docs')" />
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>




.faq-content { max-width: 800px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; }
.faq-header { text-align: center; margin-bottom: 56px; }
.faq-header h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
.faq-header p { color: var(--an-text-subtle); font-size: 1.05rem; line-height: 1.6; }
.faq-header a { color: var(--an-primary); text-decoration: none; }
.faq-header a:hover { text-decoration: underline; }

.faq-category { margin-bottom: 40px; }
.faq-category h2 {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--an-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--an-border-dark);
}

.faq-items { display: flex; flex-direction: column; gap: 2px; }

.faq-item {
  border: 1px solid var(--an-border-dark);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.faq-item:hover { border-color: var(--an-border-subtle); }
.faq-item--open { border-color: var(--an-primary); background: var(--an-surface-dark); }

.faq-question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  background: none;
  border: none;
  color: var(--an-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}
.faq-question:hover { color: var(--an-primary); }
.faq-icon {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--an-text-muted);
  transition: transform 0.3s ease, color 0.15s;
}
.faq-icon--open {
  transform: rotate(45deg);
  color: var(--an-primary);
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.35s ease;
  padding: 0 20px;
}
.faq-answer--open {
  max-height: 300px;
  opacity: 1;
  padding: 0 20px 18px;
}
.faq-answer p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--an-text-subtle);
  margin: 0;
}

.faq-cta {
  text-align: center;
  padding: 40px;
  margin-top: 40px;
  border: 1px solid var(--an-border-dark);
  border-radius: 16px;
  background: var(--an-surface-dark);
}
.faq-cta h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; }
.faq-cta p { color: var(--an-text-subtle); font-size: 15px; }

.legal-footer { max-width: 800px; margin: 0 auto; padding: 24px; border-top: 1px solid var(--an-border-dark); display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--an-text-muted); }
.legal-footer a { color: var(--an-primary); text-decoration: none; }

.legal-page--light { background: #fafafa; color: #111827; }

.legal-page--light .faq-header h1 { color: #111827; }
.legal-page--light .faq-header p { color: #6b7280; }
.legal-page--light .faq-item { border-color: #e5e7eb; }
.legal-page--light .faq-item:hover { border-color: #d1d5db; }
.legal-page--light .faq-item--open { border-color: var(--an-primary); background: white; }
.legal-page--light .faq-question { color: #111827; }
.legal-page--light .faq-question:hover { color: var(--an-primary); }
.legal-page--light .faq-icon { color: #9ca3af; }
.legal-page--light .faq-answer p { color: #4b5563; }
.legal-page--light .faq-category h2 { border-bottom-color: #e5e7eb; color: var(--an-primary); }
.legal-page--light .faq-cta { background: white; border-color: #e5e7eb; }
.legal-page--light .faq-cta h2 { color: #111827; }
.legal-page--light .faq-cta p { color: #6b7280; }
.legal-page--light .legal-footer { border-top-color: #e5e7eb; }
</style>
