<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '../stores/theme'
import Button from 'primevue/button'
import AssetNodeLogo from '../components/illustrations/AssetNodeLogo.vue'
import PublicNavbar from '../components/PublicNavbar.vue'

const router = useRouter()
useI18n()
const themeStore = useThemeStore()

const observerRef = ref<IntersectionObserver | null>(null)
const heroVid = ref<HTMLVideoElement | null>(null)

const hoverPlay = (e: Event) => {
  const vid = e.target as HTMLVideoElement
  if (vid) vid.play().catch(() => {  })
}
const hoverPause = (e: Event) => {
  const vid = e.target as HTMLVideoElement
  if (vid) vid.pause()
}

let cineRaf: number | null = null

function driveVignettes() {
  const isLight = document.querySelector('.landing--light') !== null
  const sections = document.querySelectorAll('.cine-section')
  if (!sections.length) return
  const vh = window.innerHeight

  sections.forEach(section => {
    const rect = section.getBoundingClientRect()
    const center = rect.top + rect.height / 2
    const screenCenter = vh / 2
    const dist = Math.min(Math.abs(center - screenCenter) / (vh * 0.55), 1)


    const spread = Math.round(85 - dist * 45)
    const opacity = isLight ? Math.min(dist * 1.2, 0.7) : 0

    const el = section as HTMLElement
    el.style.setProperty('--cine-spread', `${spread}%`)
    el.style.setProperty('--cine-opacity', `${opacity}`)
  })
}

function onCineScroll() {
  if (cineRaf) cancelAnimationFrame(cineRaf)
  cineRaf = requestAnimationFrame(driveVignettes)
}

onMounted(() => {
  observerRef.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')
          observerRef.value?.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  )
  document.querySelectorAll('.reveal').forEach((el) => observerRef.value?.observe(el))
  startCounters()
  window.addEventListener('scroll', onCineScroll, { passive: true })
  driveVignettes()

  const existingScript = document.getElementById('schema-org')
  if (!existingScript) {
    const scriptEl = document.createElement('script')
    scriptEl.id = 'schema-org'
    scriptEl.setAttribute('type', 'application/ld+json')
    scriptEl.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://asset-node.com/#website",
          "url": "https://asset-node.com/",
          "name": "AssetNode",
          "description": "IT-Asset-Management-Software Open Source für wachsende Teams. Hardware, Lizenzen & Peripherie zentral verwalten."
        },
        {
          "@type": "Organization",
          "@id": "https://asset-node.com/#organization",
          "name": "AssetNode",
          "url": "https://asset-node.com/",
          "logo": "https://asset-node.com/android-chrome-512x512.png"
        }
      ]
    })
    document.head.appendChild(scriptEl)
  }
})

onUnmounted(() => {
  observerRef.value?.disconnect()
  window.removeEventListener('scroll', onCineScroll)
  if (cineRaf) cancelAnimationFrame(cineRaf)
})

const counters = ref({ assets: 0, companies: 0, integrations: 0, uptime: 0 })

function animateCounter(key: keyof typeof counters.value, target: number, dur = 2200) {
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min((now - start) / dur, 1)
    const e = 1 - Math.pow(1 - p, 3)
    counters.value[key] = Math.round(e * target)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function startCounters() {
  const el = document.querySelector('.stats-section')
  if (!el) return
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      animateCounter('integrations', 13)
      animateCounter('uptime', 99)
      const host = window.location.hostname
      const apiBase = (host.endsWith('.asset-node.com') || host === 'asset-node.com')
        ? 'https://api.asset-node.com'
        : 'http://localhost:3001'
      fetch(`${apiBase}/api/public/stats`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            animateCounter('assets', data.assets || 0)
            animateCounter('companies', data.companies || 0)
          }
        })
        .catch(() => {
          animateCounter('assets', 0)
          animateCounter('companies', 0)
        })
      obs.disconnect()
    }
  }, { threshold: 0.3 })
  obs.observe(el)
}

const activeTestimonial = ref(0)
const testimonials = [
  { quote: 'Become an early adopter and help us redefine how mid-sized companies manage their hardware. Your feedback shapes our roadmap.', name: 'Your Name', role: 'IT-Lead', company: 'Your Company', avatar: '/assets/landing/testimonial-avatar.jpg' },
  { quote: 'Become a contributer help us improve how mid-sized companies manage their hardware. Your help is appreciated.', name: 'Your Name', role: 'IT-Lead', company: 'Your Company', avatar: '/assets/landing/testimonial-avatar.jpg' },
  { quote: 'Are you tired of spreadsheet chaos? Partner with us to build the exact features your finance and IT teams actually need.', name: 'Your Name', role: 'CFO', company: 'Your Company', avatar: '/assets/landing/testimonial-avatar.jpg' },
]

let testimonialTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  testimonialTimer = setInterval(() => {
    activeTestimonial.value = (activeTestimonial.value + 1) % testimonials.length
  }, 5000)
})
onUnmounted(() => { if (testimonialTimer) clearInterval(testimonialTimer) })

const contactForm = reactive({ name: '', email: '', company: '', message: '' })
const contactStatus = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const contactError = ref('')

async function submitContact() {
  if (!contactForm.name || !contactForm.email || !contactForm.message) return
  contactStatus.value = 'sending'
  contactError.value = ''
  try {
    const host = window.location.hostname
    const apiBase = (host.endsWith('.asset-node.com') || host === 'asset-node.com')
      ? 'https://api.asset-node.com'
      : 'http://localhost:3001'
    const res = await fetch(`${apiBase}/api/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactForm)
    })
    if (res.ok) {
      contactStatus.value = 'sent'
      contactForm.name = ''
      contactForm.email = ''
      contactForm.company = ''
      contactForm.message = ''
    } else {
      const data = await res.json().catch(() => null)
      contactError.value = data?.error || 'Something went wrong.'
      contactStatus.value = 'error'
    }
  } catch {
    contactError.value = 'Network error. Please try again.'
    contactStatus.value = 'error'
  }
}

function scrollToContact() {
  const el = document.querySelector('#contact')
  el?.scrollIntoView({ behavior: 'smooth' })
}

const integrationLogos = [
  { name: 'Intune', icon: 'pi pi-microsoft' },
  { name: 'Google Cloud', icon: 'pi pi-google' },
  { name: 'Okta', icon: 'pi pi-shield' },
  { name: 'Slack', icon: 'pi pi-slack' },
  { name: 'Active Directory', icon: 'pi pi-users' },
  { name: 'Jamf', icon: 'pi pi-apple' }
]

const placeholderLogos = [
  { name: 'Your Company', icon: 'pi pi-building' },
  { name: 'Future Partner', icon: 'pi pi-star' },
  { name: 'Your Logo Here', icon: 'pi pi-images' },
  { name: 'Early Adopter', icon: 'pi pi-bolt' },
  { name: 'Your Enterprise', icon: 'pi pi-globe' },
  { name: 'Pilot Customer', icon: 'pi pi-flag' }
]
const marqueeLogos = [...placeholderLogos, ...placeholderLogos, ...placeholderLogos]

const features = [
  { icon: 'pi pi-sync', title: 'Automated MDM Sync', desc: 'Connect Intune, Jamf, Kandji or Autopilot and your inventory populates automatically. No manual data entry, ever.', tag: 'DISCOVERY', link: '/integrations', image: '/assets/landing/feature-mdm-sync.jpg' },
  { icon: 'pi pi-users', title: 'Employee Lifecycle', desc: 'Onboard new hires with pre-configured device bundles. Offboard with one click — all assignments are tracked and audited.', tag: 'LIFECYCLE', link: '/sign-up', image: '/assets/landing/feature-lifecycle.jpg' },
  { icon: 'pi pi-shopping-cart', title: 'Smart Procurement', desc: 'Compare refurbished prices across BackMarket, refurbed and Grover. Save up to 40% on device costs.', tag: 'MARKETPLACE', link: '/sign-up', image: '/assets/landing/feature-procurement.jpg' },
  { icon: 'pi pi-chart-bar', title: 'Financial Insights', desc: 'Track purchase prices, depreciation, warranty dates and total cost of ownership. Export reports for your finance team.', tag: 'FINANCIALS', link: '/pricing' },
  { icon: 'pi pi-shield', title: 'Compliance & Audit', desc: 'Full audit trail for every asset change. DSGVO-compliant data handling. Automated compliance reports.', tag: 'SECURITY', link: '/sign-up' },
  { icon: 'pi pi-code', title: 'REST API & SCIM', desc: 'Full programmatic access. SCIM 2.0 provisioning for identity providers. Webhooks for real-time updates.', tag: 'DEVELOPER', link: '/api-docs' },
]

const onMouseMove = (e: MouseEvent) => {
  const el = document.documentElement
  el.style.setProperty('--mouse-clientX', `${e.clientX}px`)
  el.style.setProperty('--mouse-clientY', `${e.clientY}px`)
}
</script>

<template>
  <div class="landing" :class="{ 'landing--light': !themeStore.isDark }" @mousemove="onMouseMove">
    <div class="aurora-bg">
      <div class="aurora-orb aurora-1" />
      <div class="aurora-orb aurora-2" />
      <div class="aurora-orb aurora-3" />
    </div>
    <div class="lumos-flashlight" />
    <PublicNavbar />

    <section class="hero">
      <div class="hero-bg">
        <div class="hero-gradient" />
        <div class="hero-grid-pattern" />
        <div class="hero-noise" />
      </div>

      <div class="hero-content">
        <h1 class="hero-h1 reveal">
          Don't leave your<br/>
          <span class="hero-h1-gradient">IT operations</span> in the dark
        </h1>

        <p class="hero-p reveal">
          Gain clarity through automated discovery, real-time MDM sync,<br class="hide-mobile"/>
          and actionable insights — all in one platform.
        </p>

        <div class="hero-cta reveal">
          <Button label="Start free — No credit card" icon="pi pi-arrow-right" iconPos="right" size="large" class="hero-btn-primary" @click="router.push('/sign-up')" />
          <Button label="View pricing" icon="pi pi-tag" size="large" outlined class="hero-btn-ghost" @click="router.push('/pricing')" />
        </div>

        <div class="hero-proof reveal">
          <span class="hero-proof-item"><i class="pi pi-check-circle" /> Free forever — 100 assets</span>
          <span class="hero-proof-item"><i class="pi pi-check-circle" /> Setup in under 5 minutes</span>
          <span class="hero-proof-item"><i class="pi pi-check-circle" /> 🇩🇪 Hosted in Germany</span>
        </div>
      </div>

      <div
        class="hero-visual reveal"
        @mouseenter="heroVid?.play()?.catch?.(() => {})"
        @mouseleave="heroVid?.pause()"
      >
        <div class="hero-visual-glow" />
        <div class="hero-particles" />
        <video
          ref="heroVid"
          src="/assets/landing/hero-ambient.mp4"
          loop
          muted
          playsinline
          class="hero-bg-video"
        />
        <div class="hero-dashboard">
          <div class="hd-topbar">
            <div class="hd-dots"><span/><span/><span/></div>
            <div class="hd-url">app.assetnode.com/dashboard</div>
          </div>
          <div class="hd-body">
            <div class="hd-sidebar">
              <AssetNodeLogo :size="16" style="color: var(--an-cobalt); margin-bottom: 12px;" />
              <div v-for="i in 6" :key="i" class="hd-nav" :class="{ 'hd-nav--active': i === 1 }" />
            </div>
            <div class="hd-main">
              <div class="hd-kpi-row">
                <div v-for="(kpi, idx) in [
                  { label: 'Total Assets', value: '1,247', trend: '+12%', up: true },
                  { label: 'Asset Value', value: '€847K', trend: '+8%', up: true },
                  { label: 'Utilization', value: '94.2%', trend: '→', up: false },
                  { label: 'Employees', value: '312', trend: '+3', up: true },
                ]" :key="idx" class="hd-kpi">
                  <span class="hd-kpi-label">{{ kpi.label }}</span>
                  <span class="hd-kpi-val">{{ kpi.value }}</span>
                  <span class="hd-kpi-trend" :class="{ 'hd-kpi-trend--up': kpi.up }">{{ kpi.trend }}</span>
                </div>
              </div>
              <div class="hd-charts">
                <div class="hd-chart">
                  <div class="hd-chart-title">Status Breakdown</div>
                  <div class="hd-bars">
                    <div v-for="(h, i) in [85,62,45,30,20,55,70,40]" :key="i" class="hd-bar" :style="`height:${h}%;animation-delay:${i*0.08}s`" />
                  </div>
                </div>
                <div class="hd-activity">
                  <div class="hd-chart-title">Recent Activity</div>
                  <div v-for="(item, i) in [
                    { color: 'var(--an-emerald)', w: 70, tag: 'assigned' },
                    { color: 'var(--an-cobalt)', w: 55, tag: 'synced' },
                    { color: 'var(--an-orange)', w: 80, tag: 'returned' },
                    { color: 'var(--an-emerald)', w: 45, tag: 'created' },
                    { color: '#8b5cf6', w: 65, tag: 'updated' },
                  ]" :key="i" class="hd-row">
                    <span class="hd-dot" :style="`background:${item.color}`" />
                    <span class="hd-line" :style="`width:${item.w}%`" />
                    <span class="hd-tag">{{ item.tag }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="trust-bar">
      <div class="trust-signals">
        <div class="trust-signal-item">
          <i class="pi pi-shield" />
          <span>GDPR Compliant</span>
        </div>
        <div class="trust-signal-item">
          <i class="pi pi-server" />
          <span>Hosted in Germany</span>
        </div>
        <div class="trust-signal-item">
          <i class="pi pi-lock" />
          <span>AES-256 Encryption</span>
        </div>
        <div class="trust-signal-item">
          <i class="pi pi-sync" />
          <span>Intune & Jamf Sync</span>
        </div>
        <div class="trust-signal-item">
          <i class="pi pi-code" />
          <span>REST API & SCIM 2.0</span>
        </div>
        <div class="trust-signal-item">
          <i class="pi pi-bolt" />
          <span>99.9% Uptime SLA</span>
        </div>
      </div>
    </section>

    <section id="features" class="features-section cine-section">
      <div class="cine-vignette"></div>
      <div class="section-inner">
        <div class="section-header reveal">
          <p class="section-eyebrow">CAPABILITIES</p>
          <h2 class="section-h2">Everything you need to manage<br/><span class="text-gradient">IT assets at scale</span></h2>
          <p class="section-p">From procurement to retirement — one platform for hardware, licenses, and people.</p>
        </div>

        <div class="features-grid">
          <div v-for="(f, i) in features" :key="f.title" class="f-card reveal" :style="`--d:${i * 0.06}s`">
            <div class="f-card-accent" />
            <div class="f-tag">{{ f.tag }}</div>
            <div class="f-icon">
              <i :class="f.icon" />
            </div>
            <h3 class="f-title">{{ f.title }}</h3>
            <p class="f-desc">{{ f.desc }}</p>
            <a class="f-link" @click="router.push(f.link)">
              Learn more <i class="pi pi-arrow-right" style="font-size: 11px;" />
            </a>

            <div v-if="f.image" class="f-image-wrapper">
              <img :src="f.image" alt="Platform Screenshot" />
            </div>
            <div class="f-glow" />
          </div>
        </div>
      </div>
    </section>

    <section class="stats-section cine-section">
      <div class="cine-vignette"></div>
      <div class="stats-inner reveal">
        <div class="stat-card" v-for="(s, i) in [
          { val: counters.assets.toLocaleString('de-DE') + '+', label: 'Assets tracked' },
          { val: counters.companies + '+', label: 'Companies' },
          { val: counters.integrations.toString(), label: 'Integrations' },
          { val: counters.uptime + '.9%', label: 'Uptime SLA' },
        ]" :key="i">
          <div class="stat-val">{{ s.val }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <section class="how-section cine-section">
      <div class="cine-vignette"></div>
      <div class="section-inner">
        <div class="section-header reveal">
          <p class="section-eyebrow">HOW IT WORKS</p>
          <h2 class="section-h2">Up and running in <span class="text-gradient">minutes</span></h2>
          <p class="section-p">No complex implementations. No consulting fees. Just connect and go.</p>
        </div>

        <div class="how-zz">
          <div v-for="(step, i) in ([
            { num: '01', title: 'Connect Everything', desc: 'Link your MDM, HR-System or import a CSV. Our zero-touch integration handles the data flow.', image: '/assets/landing/connect.png' },
            { num: '02', title: 'Manage Hardware', desc: 'Track laptops, phones, licenses, and peripherals natively. Assign to employees with a full timestamped audit trail.', image: '/assets/landing/manage.png' },
            { num: '03', title: 'Automated Lifecycle', desc: 'Webhooks, SCIM provisioning, and scheduled sync keep everything perfectly mirrored. Automatically trigger offboarding processes.', image: '/assets/landing/automate.png' }
          ] as Array<{ num: string, title: string, desc: string, image?: string, video?: string }>)" :key="step.num" class="zz-row reveal" :class="{ 'zz-reverse': i % 2 !== 0 }" :style="`--d:${i * 0.1}s`">

            <div class="zz-content">
              <div class="zz-num">{{ step.num }}</div>
              <h3 class="zz-title">{{ step.title }}</h3>
              <p class="zz-desc">{{ step.desc }}</p>
            </div>

            <div class="zz-media">
              <div class="zz-media-inner">
                <video v-if="step.video" :src="step.video" loop muted playsinline @mouseenter="hoverPlay" @mouseleave="hoverPause"></video>
                <img v-else :src="step.image" alt="Feature Image" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>

    <section class="compare-section cine-section">
      <div class="cine-vignette"></div>
      <div class="section-inner">
        <div class="section-header reveal">
          <p class="section-eyebrow">WHY ASSETNODE</p>
          <h2 class="section-h2">Replace spreadsheets and <span class="text-gradient">expensive tools</span></h2>
          <p class="section-p">See how AssetNode compares to the alternatives your team is considering.</p>
        </div>

        <div class="compare-table-wrapper reveal">
          <table class="compare-table">
            <thead>
              <tr>
                <th></th>
                <th class="compare-highlight">AssetNode</th>
                <th>Spreadsheets</th>
                <th>Snipe-IT</th>
                <th>BlueTally</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="compare-feature">Pricing</td>
                <td class="compare-highlight"><strong>Free / €20/mo</strong></td>
                <td>Free</td>
                <td>Free (self-host)</td>
                <td>$99–$499/mo</td>
              </tr>
              <tr>
                <td class="compare-feature">MDM Auto-Sync</td>
                <td class="compare-highlight"><i class="pi pi-check-circle compare-yes" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-check-circle compare-yes" /></td>
              </tr>
              <tr>
                <td class="compare-feature">Setup Time</td>
                <td class="compare-highlight"><strong>30 minutes</strong></td>
                <td>Hours</td>
                <td>1–2 days</td>
                <td>30 minutes</td>
              </tr>
              <tr>
                <td class="compare-feature">Server Management</td>
                <td class="compare-highlight">None (SaaS)</td>
                <td>None</td>
                <td>You manage</td>
                <td>None (SaaS)</td>
              </tr>
              <tr>
                <td class="compare-feature">Workflow Automation</td>
                <td class="compare-highlight"><i class="pi pi-check-circle compare-yes" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
              </tr>
              <tr>
                <td class="compare-feature">SCIM Provisioning</td>
                <td class="compare-highlight"><i class="pi pi-check-circle compare-yes" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-check-circle compare-yes" /></td>
              </tr>
              <tr>
                <td class="compare-feature">EU Data Residency</td>
                <td class="compare-highlight"><i class="pi pi-check-circle compare-yes" /></td>
                <td>Varies</td>
                <td>Self-hosted</td>
                <td><i class="pi pi-times-circle compare-no" /></td>
              </tr>
              <tr>
                <td class="compare-feature">Marketplace (Refurbished)</td>
                <td class="compare-highlight"><i class="pi pi-check-circle compare-yes" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
                <td><i class="pi pi-times-circle compare-no" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="compare-cta reveal">
          <Button label="Start free — see the difference" icon="pi pi-arrow-right" iconPos="right" size="large" class="hero-btn-primary" @click="router.push('/sign-up')" />
        </div>
      </div>
    </section>

    <section class="integ-section cine-section">
      <div class="cine-vignette"></div>
      <div class="section-inner">
        <div class="section-header reveal">
          <p class="section-eyebrow">INTEGRATIONS</p>
          <h2 class="section-h2">Connects with your <span class="text-gradient">entire stack</span></h2>
          <p class="section-p">Out-of-the-box integrations with the tools your IT team already uses.</p>
        </div>

        <div class="integ-grid reveal">
          <div v-for="logo in integrationLogos" :key="logo.name" class="integ-pill">
            <i :class="logo.icon" class="integ-icon" />
            <span class="integ-name">{{ logo.name }}</span>
          </div>
        </div>

        <div class="integ-cta reveal">
          <Button label="See all integrations" icon="pi pi-arrow-right" iconPos="right" outlined class="integ-btn" @click="router.push('/integrations')" />
        </div>
      </div>
    </section>

    <section id="contact" class="contact-section cine-section">
      <div class="cine-vignette"></div>
      <div class="section-inner">
        <div class="section-header reveal">
          <p class="section-eyebrow">CONTACT</p>
          <h2 class="section-h2">Let's <span class="text-gradient">talk</span></h2>
          <p class="section-p">Have questions? Want a personal demo? We'd love to hear from you.</p>
        </div>

        <div class="contact-grid reveal">
          <div class="contact-form-card">
            <form @submit.prevent="submitContact" class="contact-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="contact-name">Name *</label>
                  <input id="contact-name" v-model="contactForm.name" type="text" placeholder="Max Mustermann" required />
                </div>
                <div class="form-group">
                  <label for="contact-email">Email *</label>
                  <input id="contact-email" v-model="contactForm.email" type="email" placeholder="max@company.de" required />
                </div>
              </div>
              <div class="form-group">
                <label for="contact-company">Company</label>
                <input id="contact-company" v-model="contactForm.company" type="text" placeholder="Acme GmbH" />
              </div>
              <div class="form-group">
                <label for="contact-message">Message *</label>
                <textarea id="contact-message" v-model="contactForm.message" rows="4" placeholder="Tell us about your use case..." required></textarea>
              </div>

              <div v-if="contactStatus === 'error'" class="contact-error">
                <i class="pi pi-exclamation-circle" /> {{ contactError }}
              </div>
              <div v-if="contactStatus === 'sent'" class="contact-success">
                <i class="pi pi-check-circle" /> Thank you! We'll get back to you shortly.
              </div>

              <Button
                type="submit"
                :label="contactStatus === 'sending' ? 'Sending...' : 'Send message'"
                icon="pi pi-send"
                iconPos="right"
                :disabled="contactStatus === 'sending'"
                class="contact-submit-btn"
              />
            </form>
          </div>

          <div class="contact-info-card">
            <div class="contact-info-item">
              <div class="contact-info-icon"><i class="pi pi-calendar" /></div>
              <div>
                <h4>Book a demo</h4>
                <p>See AssetNode in action with a personalized walkthrough.</p>
                <Button label="Contact us" icon="pi pi-arrow-down" iconPos="right" outlined class="calendly-btn" @click="scrollToContact" />
              </div>
            </div>
            <div class="contact-info-item">
              <div class="contact-info-icon"><i class="pi pi-envelope" /></div>
              <div>
                <h4>Email us directly</h4>
                <p><a href="mailto:hello@elixio.io" class="contact-email-link">hello@elixio.io</a></p>
              </div>
            </div>
            <div class="contact-info-item">
              <div class="contact-info-icon"><i class="pi pi-clock" /></div>
              <div>
                <h4>Response time</h4>
                <p>We typically respond within 24 hours on business days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="cta-mesh" />
      <div class="cta-inner reveal">
        <p class="section-eyebrow" style="color: rgba(255,255,255,0.6);">GET STARTED</p>
        <h2 class="cta-h2">Simplify your IT ecosystem<br/>with AssetNode</h2>
        <p class="cta-p">Free forever for up to 100 assets — no credit card required</p>
        <div class="cta-buttons">
          <Button label="Start free now" icon="pi pi-arrow-right" iconPos="right" size="large" class="cta-btn-white" @click="router.push('/sign-up')" />
          <Button label="Talk to Sales" icon="pi pi-comments" size="large" outlined class="cta-btn-outline" @click="document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })" />
        </div>
        <div class="cta-sub">
          <span><i class="pi pi-shield" /> SOC 2 compliant</span>
          <span><i class="pi pi-globe" /> EU data residency</span>
          <span><i class="pi pi-lock" /> AES-256 encryption</span>
        </div>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand">
            <AssetNodeLogo :size="22" />
            <p class="footer-desc">Modern IT asset management for growing companies. Track, manage, and automate — all in one platform.</p>
            <div class="footer-socials">
              <a href="https://linkedin.com" target="_blank"><i class="pi pi-linkedin" /></a>
              <a href="https://github.com/elixio-io/asset-node.com" target="_blank"><i class="pi pi-github" /></a>
            </div>
          </div>
          <div class="footer-col">
            <h4 class="footer-heading">Product</h4>
            <div class="footer-links">
              <a @click="router.push('/#features')">Features</a>
              <a @click="router.push('/pricing')">Pricing</a>
              <a @click="router.push('/integrations')">Integrations</a>
              <a @click="router.push('/api-docs')">API Docs</a>
              <a @click="router.push('/changelog')">Changelog</a>
            </div>
          </div>
          <div class="footer-col">
            <h4 class="footer-heading">Company</h4>
            <div class="footer-links">
              <a @click="router.push('/about')">About</a>
              <a @click="router.push('/blog')">Blog</a>
              <a @click="router.push('/careers')">Careers</a>
              <a @click="router.push('/faq')">FAQ</a>
            </div>
          </div>
          <div class="footer-col">
            <h4 class="footer-heading">Legal</h4>
            <div class="footer-links">
              <a @click="router.push('/privacy-policy')">Privacy Policy</a>
              <a @click="router.push('/imprint')">Imprint</a>
              <a @click="router.push('/terms')">Terms</a>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <span class="footer-copy">© {{ new Date().getFullYear() }} AssetNode — a product of Elixio UG</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  --glass: rgba(255,255,255,0.03);
  --glass-border: rgba(255,255,255,0.06);
  --accent: rgba(255, 255, 255, 0.9);
  --accent-2: rgba(255, 255, 255, 0.4);
  --text-glow-core: #ffffff;
  background: var(--an-bg-dark);
  color: var(--an-text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
  overflow-x: hidden;
}

.lumos-flashlight {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: radial-gradient(
    800px circle at var(--mouse-clientX, 50vw) var(--mouse-clientY, 50vh),
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.03) 25%,
    transparent 60%
  );
  mix-blend-mode: normal;
  transition: opacity 0.3s;
}
.landing--light .lumos-flashlight {
  display: none;
}

.section-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

.reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
  transition-delay: var(--d, 0s);
}
.reveal.in-view { opacity: 1; transform: none; }

.text-gradient {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-header { text-align: center; margin-bottom: 72px; }
.section-eyebrow {
  font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
  color: var(--accent); margin-bottom: 16px; text-transform: uppercase;
}
.section-h2 {
  font-size: clamp(1.8rem, 3.5vw, 2.8rem); font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 20px;
}
.section-p {
  font-size: 1.15rem; color: var(--an-text-subtle);
  max-width: 560px; margin: 0 auto; line-height: 1.7;
}

.hero {
  position: relative;
  padding: 140px 24px 80px;
  display: flex; flex-direction: column; align-items: center;
  min-height: 100dvh;
  overflow: hidden;
}

.hero-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.hero-gradient {
  position: absolute; width: 1400px; height: 1400px;
  top: -30%; left: 50%;
  background:
    radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1), transparent 50%),
    radial-gradient(circle at 60% 60%, rgba(255,255,255,0.08), transparent 50%);
  animation: hero-aurora 20s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes hero-aurora {
  0% { transform: translateX(-50%) rotate(0deg) scale(1); opacity: 0.6; }
  100% { transform: translateX(-50%) rotate(10deg) scale(1.15); opacity: 1; }
}
.hero-grid-pattern {
  position: absolute; inset: 0; top: 0; bottom: -50%; left: -50%; right: -50%;
  background-image:
    linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
  background-size: 80px 80px;
  transform: perspective(600px) rotateX(60deg) translateY(-100px) translateZ(-200px);
  animation: grid-drift 10s linear infinite;
  mask-image: linear-gradient(transparent, black 40%, transparent 90%);
}
@keyframes grid-drift {
  0% { transform: perspective(600px) rotateX(60deg) translateY(0) translateZ(-200px); }
  100% { transform: perspective(600px) rotateX(60deg) translateY(80px) translateZ(-200px); }
}
.hero-noise {
  position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.4;
}

.hero-content { position: relative; z-index: 1; text-align: center; max-width: 900px; }

.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--an-text-subtle);
  padding: 8px 20px; border-radius: 999px; margin-bottom: 32px;
  background: var(--glass); border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px); cursor: pointer;
  transition: border-color 0.3s, background 0.3s;
}
.hero-badge:hover { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }
.hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-2); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.hero-h1 {
  font-size: clamp(3.2rem, 6.5vw, 6.5rem); font-weight: 900;
  letter-spacing: -0.05em; line-height: 1.05; margin-bottom: 24px;
  text-shadow: 0 24px 48px rgba(0,0,0,0.5);
}
.hero-h1-gradient {
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent-2) 20%,
    var(--text-glow-core) 40%,
    var(--text-glow-core) 60%,
    var(--accent-2) 80%,
    var(--accent) 100%
  );
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; background-size: 300% auto;
  animation: shine-text 7s linear infinite;
}
@keyframes shine-text {
  to { background-position: -300% center; }
}

.hero-p {
  font-size: 1.25rem; color: var(--an-text-subtle); line-height: 1.7;
  max-width: 600px; margin: 0 auto 40px;
}
.hide-mobile { display: inline; }

.hero-cta { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
.hero-btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2)) !important;
  border: none !important; font-weight: 600 !important; color: white !important;
  box-shadow: 0 4px 24px rgba(255,255,255,0.2), 0 0 0 1px rgba(255,255,255,0.1) !important;
  transition: box-shadow 0.3s, transform 0.3s !important;
}
.hero-btn-primary:hover {
  box-shadow: 0 8px 40px rgba(255,255,255,0.3), 0 0 0 1px rgba(255,255,255,0.2) !important;
  transform: translateY(-2px) !important;
}
.hero-btn-ghost {
  border-color: var(--glass-border) !important; color: var(--an-text-primary) !important;
  background: var(--glass) !important; backdrop-filter: blur(8px);
}
.hero-btn-ghost:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; }

.hero-proof {
  display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
  font-size: 13px; color: var(--an-text-muted);
}
.hero-proof-item { display: flex; align-items: center; gap: 6px; }
.hero-proof-item .pi { color: var(--accent-2); font-size: 14px; }

.hero-visual {
  position: relative; z-index: 1; width: 100%; max-width: 1060px;
  margin-top: 72px; padding-top: 160px; perspective: 1400px;
}
.hero-bg-video {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  object-fit: cover; border-radius: 16px;
  opacity: 0.05; filter: grayscale(100%);
  transition: opacity 0.8s ease, filter 0.8s ease;
  z-index: 0; pointer-events: none;
}
.hero-visual:hover .hero-bg-video {
  opacity: 0.25; filter: grayscale(0%);
}
.hero-visual-glow {
  position: absolute; top: -30px; left: 15%; right: 15%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
  box-shadow: 0 0 24px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4), 0 0 80px rgba(255,255,255,0.2);
  pointer-events: none; z-index: 0;
}
.hero-particles {
  position: absolute; top: -30px; left: 15%; right: 15%; height: 160px;
  background-image:
    radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px),
    radial-gradient(circle, rgba(255,255,255,0.5) 1.5px, transparent 1.5px),
    radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px);
  background-size: 80px 80px, 110px 110px, 150px 150px;
  animation: fall 10s linear infinite;
  mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  pointer-events: none; z-index: 0;
}
@keyframes fall {
  0% { background-position: 0px 0px, 0px 0px, 0px 0px; }
  100% { background-position: 0px 80px, 0px 110px, 0px 150px; }
}
.hero-dashboard {
  z-index: 1;
  transform: rotateX(8deg) scale(0.96) translateY(20px);
  transform-origin: bottom center;
  transition: transform 0.8s cubic-bezier(0.16,1,0.3,1), box-shadow 0.8s ease;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; overflow: hidden;
  background: rgba(17,17,21,0.9);
  box-shadow: 0 48px 120px rgba(0,0,0,0.6), 0 0 80px rgba(255,255,255,0.06), 0 0 1px rgba(255,255,255,0.1) inset;
  position: relative;
}
.hero-dashboard::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.04) 25%, transparent 30%);
  background-size: 200% 200%;
  animation: dash-glare 6s infinite linear;
  z-index: 10;
}
@keyframes dash-glare {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.hero-dashboard:hover {
  transform: rotateX(0deg) scale(1) translateY(0);
  box-shadow: 0 64px 160px rgba(0,0,0,0.8), 0 0 120px rgba(255,255,255,0.15), 0 0 1px rgba(255,255,255,0.2) inset;
}

.hd-topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.hd-dots { display: flex; gap: 6px; }
.hd-dots span { width: 10px; height: 10px; border-radius: 50%; }
.hd-dots span:nth-child(1) { background: #ff5f57; }
.hd-dots span:nth-child(2) { background: #ffbd2e; }
.hd-dots span:nth-child(3) { background: #28c840; }
.hd-url {
  font-size: 11px; color: var(--an-text-muted);
  background: rgba(255,255,255,0.04); padding: 4px 12px;
  border-radius: 6px; flex: 1; text-align: center;
}

.hd-body { display: flex; min-height: 280px; }
.hd-sidebar {
  width: 52px; border-right: 1px solid rgba(255,255,255,0.06);
  padding: 14px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: rgba(0,0,0,0.2);
}
.hd-nav { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.04); }
.hd-nav--active { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); }

.hd-main { flex: 1; padding: 16px; }
.hd-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.hd-kpi {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
}
.hd-kpi-label { font-size: 9px; color: var(--an-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.hd-kpi-val { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
.hd-kpi-trend { font-size: 10px; color: var(--an-text-muted); font-weight: 600; }
.hd-kpi-trend--up { color: var(--an-emerald); }

.hd-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hd-chart, .hd-activity {
  padding: 14px; border-radius: 10px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
}
.hd-chart-title { font-size: 10px; font-weight: 600; color: var(--an-text-muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.hd-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; }
.hd-bar {
  flex: 1; border-radius: 4px 4px 0 0;
  background: linear-gradient(to top, var(--accent), var(--accent-2));
  opacity: 0.7; transform-origin: bottom; animation: bar-up 1s ease-out forwards;
  transform: scaleY(0);
}
@keyframes bar-up { to { transform: scaleY(1); } }

.hd-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
.hd-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.hd-line { height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; }
.hd-tag { font-size: 9px; font-weight: 600; color: var(--an-text-muted); background: rgba(255,255,255,0.04); padding: 2px 6px; border-radius: 4px; margin-left: auto; }

.trust-bar {
  padding: 48px 24px; text-align: center;
  border-top: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border);
}
.trust-signals {
  display: flex; justify-content: center; flex-wrap: wrap; gap: 32px;
  max-width: 1000px; margin: 0 auto;
}
.trust-signal-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--an-text-subtle);
  letter-spacing: 0.02em;
}
.trust-signal-item i {
  font-size: 16px; color: var(--accent-2); opacity: 0.7;
}

.compare-section { padding: 140px 0; }
.compare-table-wrapper {
  overflow-x: auto; max-width: 900px; margin: 0 auto;
  border: 1px solid var(--glass-border); border-radius: 16px;
  background: var(--glass);
}
.compare-table {
  width: 100%; border-collapse: collapse; font-size: 14px;
}
.compare-table th, .compare-table td {
  padding: 16px 20px; text-align: center;
  border-bottom: 1px solid var(--glass-border);
}
.compare-table thead th {
  font-size: 13px; font-weight: 700; color: var(--an-text-subtle);
  letter-spacing: 0.02em; text-transform: uppercase;
}
.compare-table .compare-feature {
  text-align: left; font-weight: 600; color: var(--an-text-primary); white-space: nowrap;
}
.compare-table .compare-highlight {
  background: rgba(255, 255, 255, 0.04); font-weight: 600;
}
.compare-table thead .compare-highlight {
  color: var(--accent); font-size: 14px;
}
.compare-yes { color: var(--an-emerald); font-size: 18px; }
.compare-no { color: var(--an-text-muted); opacity: 0.4; font-size: 18px; }
.compare-cta { text-align: center; margin-top: 48px; }

.features-section { padding: 140px 0; }
.features-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
}

.f-card {
  padding: 48px 36px 0 36px; background: var(--an-bg-dark); position: relative;
  border: 1px solid var(--glass-border); border-radius: 24px;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s, box-shadow 0.6s, border-color 0.4s;
  overflow: hidden; cursor: pointer;
  display: flex; flex-direction: column;
}
.f-card:hover {
  background: rgba(255,255,255,0.015);
  border-color: rgba(255,255,255,0.2);
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1) inset;
}
.f-card-accent {
  position: absolute; top: 0; left: 36px; width: 0; height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  border-radius: 0 0 3px 3px; transition: width 0.7s cubic-bezier(0.16,1,0.3,1);
}
.f-card:hover .f-card-accent { width: 120px; }

.f-glow {
  position: absolute; inset: 0; opacity: 0; transition: opacity 0.7s;
  background: radial-gradient(400px circle at 50% 120%, rgba(255,255,255,0.15), transparent);
  pointer-events: none;
}
@keyframes breathe-glow {
  0% { transform: translateY(0) scale(1); opacity: 0.8; }
  100% { transform: translateY(-10px) scale(1.05); opacity: 1; }
}
.f-card:hover .f-glow { opacity: 1; animation: breathe-glow 2.5s ease-in-out infinite alternate; }

.f-tag {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  margin-bottom: 20px; color: var(--accent-2);
}
.f-icon {
  width: 56px; height: 56px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; margin-bottom: 24px; color: var(--accent); background: var(--glass);
  transition: transform 0.3s, box-shadow 0.3s;
}
.f-card:hover .f-icon { transform: scale(1.08); }

.f-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.01em; }
.f-desc { font-size: 14px; color: var(--an-text-subtle); line-height: 1.75; margin: 0 0 24px; }
.f-link {
  font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;
  transition: gap 0.3s, opacity 0.3s; cursor: pointer; color: var(--accent); opacity: 0.7;
  margin-bottom: 36px;
}
.f-link:hover { gap: 10px; opacity: 1; }

.f-image-wrapper {
  margin-top: auto; margin-left: -36px; margin-right: -36px; margin-bottom: 0px;
  border-top: 1px solid rgba(255,255,255,0.06);
  position: relative; z-index: 10;
  overflow: hidden; border-radius: 0 0 24px 24px;
  height: 320px;
}
.f-image-wrapper img {
  width: 100%; height: 100%; object-fit: cover; object-position: center 35%; display: block; opacity: 0.5;
  filter: grayscale(100%) contrast(1.1);
  transition: opacity 0.5s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), filter 0.5s;
  transform: translateY(4px) scale(1.02);
}
.f-card:hover .f-image-wrapper img {
  opacity: 0.9; transform: translateY(0) scale(1);
  filter: grayscale(0%) contrast(1);
}

.stats-section { padding: 100px 24px; }
.stats-inner {
  max-width: 1000px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
}
.stat-card {
  text-align: center; padding: 48px 24px;
  border-radius: 16px; position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.04);
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
  box-shadow: 0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.stat-card:hover {
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 24px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2);
  transform: translateY(-6px);
}
.stat-card::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  opacity: 0; transition: opacity 0.5s;
}
.stat-card:hover::after { opacity: 1; }

.stat-val {
  font-size: 3.2rem; font-weight: 800; letter-spacing: -0.04em;
  margin-bottom: 12px; line-height: 1.1;
  background: linear-gradient(180deg, #ffffff 0%, #71717a 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 8px 16px rgba(255,255,255,0.1));
}
.stat-label {
  font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--an-text-muted);
}

@keyframes data-flow-x {
  0% { left: -50%; }
  100% { left: 100%; }
}

.how-section { padding: 140px 0; }
.how-zz { display: flex; flex-direction: column; gap: 100px; max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.zz-row { display: flex; align-items: center; gap: 80px; }
.zz-reverse { flex-direction: row-reverse; }

.zz-content { flex: 1; }
.zz-num {
  font-family: monospace; font-size: 14px; font-weight: 600;
  color: var(--accent); margin-bottom: 24px;
}
.zz-title { font-size: 2.2rem; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.02em; }
.zz-desc { font-size: 1.1rem; color: var(--an-text-subtle); line-height: 1.8; }

.zz-media { flex: 1; position: relative; }
.zz-media-inner {
  border-radius: 24px; overflow: hidden;
  border: 1px solid var(--glass-border);
  background: var(--an-bg-dark);
  box-shadow: 0 32px 64px rgba(0,0,0,0.4);
  aspect-ratio: 4 / 3;
}
.zz-media-inner video, .zz-media-inner img {
  width: 100%; height: 100%; object-fit: cover;
  filter: grayscale(100%) contrast(1.1); opacity: 0.6;
  transition: opacity 0.8s, filter 0.8s, transform 0.8s;
}
.zz-media-inner:hover video, .zz-media-inner:hover img {
  opacity: 1; filter: grayscale(0%) contrast(1);
  transform: scale(1.02);
}

@media (max-width: 900px) {
  .zz-row, .zz-reverse { flex-direction: column; gap: 40px; text-align: center; }
  .zz-title { font-size: 1.8rem; }
}

.testi-section { padding: 140px 0; }
.testi-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.testi-card {
  padding: 36px; border-radius: 20px;
  border: 1px solid var(--glass-border); background: var(--glass);
  transition: all 0.4s; cursor: pointer; position: relative; overflow: hidden;
}
.testi-card--active { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); }
.testi-card--active::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}
.testi-card:hover { border-color: rgba(255,255,255,0.12); }
.testi-stars { display: flex; gap: 2px; margin-bottom: 20px; color: #facc15; font-size: 13px; }
.testi-quote { font-size: 15px; line-height: 1.75; color: var(--an-text-primary); margin: 0 0 28px; font-weight: 400; }
.testi-author { display: flex; align-items: center; gap: 12px; padding-top: 20px; border-top: 1px solid var(--glass-border); }
.testi-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  overflow: hidden; flex-shrink: 0;
}
.testi-avatar img {
  width: 100%; height: 100%; object-fit: cover;
  filter: grayscale(100%);
}
.testi-name { font-size: 14px; font-weight: 600; }
.testi-role { font-size: 12px; color: var(--an-text-muted); }
.testi-dots { display: flex; justify-content: center; gap: 8px; margin-top: 32px; }
.testi-dot {
  width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--an-text-muted); opacity: 0.3; transition: all 0.3s;
}
.testi-dot--active { opacity: 1; background: var(--accent); width: 24px; border-radius: 4px; }

.integ-section { padding: 140px 0; }
.integ-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  max-width: 900px; margin: 0 auto;
}
.integ-pill {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
  padding: 40px 24px; border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
  border: 1px solid rgba(255,255,255,0.03);
  font-size: 1.1rem; font-weight: 600;
  color: var(--an-text-subtle); transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
  cursor: pointer; opacity: 0.6; filter: grayscale(100%);
}
.integ-icon {
  font-size: 3.5rem; transition: all 0.5s ease;
  background: linear-gradient(180deg, #ffffff, #71717a);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.integ-name { letter-spacing: -0.01em; font-size: 15px; }
.integ-pill:hover {
  transform: translateY(-8px) scale(1.02);
  opacity: 1; filter: grayscale(0%);
  background: linear-gradient(180deg, rgba(255,255,255,0.05), transparent);
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
}
.integ-pill:hover .integ-icon { filter: drop-shadow(0 12px 24px rgba(255,255,255,0.25)); }
.integ-cta { text-align: center; margin-top: 48px; }
.integ-btn { border-color: rgba(255,255,255,0.2) !important; color: var(--an-text-primary) !important; position: relative; overflow: visible !important; }
.integ-btn::after { content: ''; position: absolute; inset: -4px; border-radius: inherit; border: 2px solid rgba(255, 255, 255, 0.6); animation: landing-ring 2.5s ease-in-out infinite; pointer-events: none; }
.integ-btn:hover::after { animation: none; border-color: var(--an-cobalt); opacity: 1; }
@keyframes landing-ring { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.03); } }

.contact-section { padding: 140px 0; }
.contact-grid {
  display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px;
  max-width: 1000px; margin: 0 auto;
}
.contact-form-card {
  padding: 40px; border-radius: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
  border: 1px solid rgba(255,255,255,0.06);
}
.contact-form { display: flex; flex-direction: column; gap: 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label {
  font-size: 13px; font-weight: 600; color: var(--an-text-subtle);
  letter-spacing: 0.02em; text-transform: uppercase;
}
.form-group input, .form-group textarea {
  padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: var(--an-text-primary);
  font-size: 14px; font-family: inherit; transition: all 0.3s;
  outline: none; resize: vertical;
}
.form-group input::placeholder, .form-group textarea::placeholder { color: var(--an-text-muted); }
.form-group input:focus, .form-group textarea:focus {
  border-color: rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
}
.contact-submit-btn {
  align-self: flex-start; margin-top: 4px;
  background: linear-gradient(135deg, var(--an-cobalt), #3b82f6) !important;
  border: none !important; font-weight: 600 !important;
}
.contact-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(59,130,246,0.3); }
.contact-error {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 10px;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
  color: #f87171; font-size: 13px;
}
.contact-success {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 10px;
  background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);
  color: #4ade80; font-size: 13px;
}
.contact-info-card {
  display: flex; flex-direction: column; gap: 32px;
  padding: 40px; border-radius: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
  border: 1px solid rgba(255,255,255,0.04);
}
.contact-info-item { display: flex; gap: 16px; align-items: flex-start; }
.contact-info-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  color: var(--an-text-primary); font-size: 18px;
}
.contact-info-item h4 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--an-text-primary); }
.contact-info-item p { margin: 0; font-size: 13px; color: var(--an-text-subtle); line-height: 1.5; }
.contact-email-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.contact-email-link:hover { text-decoration: underline; }
.calendly-btn {
  margin-top: 12px; font-size: 13px !important;
  border-color: rgba(255,255,255,0.15) !important; color: var(--an-text-primary) !important;
}

.cta-section {
  padding: 160px 24px; text-align: center; position: relative; overflow: hidden;
}
.cta-mesh {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.06), transparent 50%),
              radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.04), transparent 50%);
}
.cta-inner { position: relative; z-index: 1; }
.cta-h2 {
  font-size: clamp(2rem, 4vw, 3rem); font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 20px;
}
.cta-p { font-size: 1.15rem; color: var(--an-text-subtle); margin-bottom: 40px; }
.cta-buttons { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
.cta-btn-white {
  background: white !important; color: #111 !important; border: none !important; font-weight: 700 !important;
  box-shadow: 0 4px 24px rgba(255,255,255,0.15) !important;
}
.cta-btn-white:hover { box-shadow: 0 8px 40px rgba(255,255,255,0.25) !important; transform: translateY(-2px); }
.cta-btn-outline { border-color: rgba(255,255,255,0.2) !important; color: white !important; }
.cta-sub {
  display: flex; justify-content: center; gap: 32px; flex-wrap: wrap;
  font-size: 13px; color: var(--an-text-muted);
}
.cta-sub span { display: flex; align-items: center; gap: 6px; }
.cta-sub .pi { font-size: 14px; color: var(--accent-2); }

.landing-footer { border-top: 1px solid var(--glass-border); padding: 72px 24px 24px; max-width: 1200px; margin: 0 auto; }
.footer-inner { margin-bottom: 48px; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; }
.footer-brand { max-width: 280px; }
.footer-desc { font-size: 14px; color: var(--an-text-subtle); line-height: 1.7; margin: 16px 0 20px; }
.footer-socials { display: flex; gap: 16px; }
.footer-socials a { color: var(--an-text-muted); font-size: 18px; transition: color 0.3s; }
.footer-socials a:hover { color: var(--an-text-primary); }
.footer-heading { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; color: var(--an-text-primary); }
.footer-links { display: flex; flex-direction: column; gap: 10px; }
.footer-links a { font-size: 14px; color: var(--an-text-subtle); text-decoration: none; transition: color 0.3s; cursor: pointer; }
.footer-links a:hover { color: var(--an-text-primary); }
.footer-bottom { border-top: 1px solid var(--glass-border); padding-top: 24px; }
.footer-copy { font-size: 13px; color: var(--an-text-muted); }

@media (max-width: 1024px) {
  .features-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .hero-h1 { font-size: 2.2rem; }
  .features-grid, .testi-cards { grid-template-columns: 1fr; }
  .stats-inner { grid-template-columns: repeat(2, 1fr); }
  .how-steps { flex-direction: column; gap: 40px; }
  .how-line { display: none; }
  .hd-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .hd-charts { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .contact-form-card, .contact-info-card { padding: 24px; }
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .footer-brand { grid-column: 1 / -1; max-width: 100%; }
  .hide-mobile { display: none; }
  .hero-proof { flex-direction: column; gap: 8px; }
  .compare-table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -24px; padding: 0 24px; }
  .compare-table { min-width: 600px; }
  .integ-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .integ-pill { padding: 24px 16px; }
  .section-inner { padding: 0 16px; }
  .hero-visual { max-width: 100%; }
  .hero-dashboard { transform: none; }
}
@media (max-width: 480px) {
  .hero { padding-top: 120px; }
  .stats-inner { grid-template-columns: 1fr; gap: 16px; }
  .hd-sidebar { display: none; }
  .footer-grid { grid-template-columns: 1fr; }
  .integ-grid { grid-template-columns: 1fr; }
  .hero-visual { display: none; }
  .cta-section { padding: 80px 16px; }
  .integ-section, .contact-section, .features-section, .stats-section, .how-section, .compare-section { padding: 80px 0; }
}





.aurora-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.aurora-orb {
  position: absolute; border-radius: 50%; filter: blur(140px); opacity: 0.4;
  animation: float-aurora 35s ease-in-out infinite alternate;
}
.aurora-1 { width: 50vw; height: 50vw; top: -10vw; left: -10vw; background: rgba(255,255,255,0.04); }
.aurora-2 { width: 40vw; height: 40vw; bottom: -10vw; right: -10vw; background: rgba(255,255,255,0.03); animation-delay: -5s; }
.aurora-3 { width: 40vw; height: 40vw; top: 30vh; left: 20vw; background: rgba(255,255,255,0.03); animation-delay: -10s; }

@keyframes float-aurora {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(5vw, 4vh) scale(1.05); }
  100% { transform: translate(-3vw, 8vh) scale(0.95); }
}

.landing--light {
  --glass: rgba(255, 255, 255, 0.4);
  --glass-border: rgba(255, 255, 255, 0.9);
  --accent: #18181b;
  --accent-2: #3f3f46;
  --text-glow-core: #09090b;
  --an-text-subtle: #52525b;
  --an-text-muted: #71717a;
  background: #e2e8f0;
}

.cine-section { position: relative; }
.cine-vignette {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  opacity: var(--cine-opacity, 0);
  background: radial-gradient(
    ellipse var(--cine-spread, 85%) var(--cine-spread, 85%) at center,
    transparent 0%,
    rgba(148,163,184,0.08) 60%,
    rgba(100,116,139,0.22) 80%,
    rgba(71,85,105,0.4) 100%
  );
}

.landing--light .aurora-orb { opacity: 0.8; }
.landing--light .aurora-1 { width: 70vw; height: 70vw; background: rgba(0,0,0,0.04); }
.landing--light .aurora-2 { width: 60vw; height: 60vw; background: rgba(0,0,0,0.03); }
.landing--light .aurora-3 { width: 50vw; height: 50vw; background: rgba(0,0,0,0.03); }

.landing--light .lumos-flashlight {
  background: radial-gradient(
    900px circle at var(--mouse-clientX, 50%) var(--mouse-clientY, 50%),
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.2) 30%,
    transparent 60%
  ) !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

.landing--light .hero-badge { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); border-color: rgba(255,255,255,1); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.landing--light .hero-btn-ghost { color: #18181b !important; }

.landing--light .hero-dashboard {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(50px); -webkit-backdrop-filter: blur(50px);
  border-color: rgba(255,255,255,1);
  box-shadow: 0 40px 100px rgba(0,0,0,0.15), 0 16px 40px rgba(0,0,0,0.1), 0 0 0 2px rgba(255,255,255,0.9) inset;
}
.landing--light .hd-topbar, .landing--light .hd-kpi, .landing--light .hd-chart, .landing--light .hd-activity { background: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.9); }
.landing--light .hd-sidebar { background: rgba(241,245,249,0.7); border-color: rgba(255,255,255,0.9); }
.landing--light .hd-nav { background: rgba(255,255,255,0.5); }
.landing--light .hd-nav--active { background: #ffffff; border-color: rgba(0,0,0,0.08); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.landing--light .hd-line { background: rgba(0,0,0,0.08); }
.landing--light .hd-tag { background: #ffffff; color: #52525b; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

.landing--light .f-card, .landing--light .testi-card {
  background: rgba(255,255,255,0.5) !important;
  backdrop-filter: blur(50px) !important; -webkit-backdrop-filter: blur(50px) !important;
  border: 1px solid rgba(255, 255, 255, 1) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.8) inset !important;
}
.landing--light .f-card:hover, .landing--light .testi-card--active {
  background: rgba(255,255,255,0.9) !important;
  box-shadow: 0 32px 64px rgba(0,0,0,0.15), 0 12px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,1) inset !important;
  border-color: #ffffff !important;
  transform: translateY(-6px);
}
.landing--light .stat-card { background: rgba(255,255,255,0.6); backdrop-filter: blur(20px); border-color: rgba(255,255,255,1); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.landing--light .stat-val { color: #18181b; }

.landing--light .how-line { background: rgba(0,0,0,0.06); }
.landing--light .how-icon { background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); color: #18181b; box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: rgba(255,255,255,1); }

.landing--light .trust-logo, .landing--light .integ-pill {
  background: transparent; border: none; box-shadow: none; filter: grayscale(100%); opacity: 0.6; color: #18181b;
}
.landing--light .trust-logo:hover, .landing--light .integ-pill:hover { opacity: 1; text-shadow: 0 0 12px rgba(0,0,0,0.1); }
.landing--light .integ-pill:hover .integ-icon { text-shadow: 0 0 12px rgba(0,0,0,0.1); color: #18181b; }

.landing--light .cta-btn-white { background: #09090b !important; color: white !important; box-shadow: 0 12px 32px rgba(0,0,0,0.2) !important; }
.landing--light .cta-btn-outline { border-color: #09090b !important; color: #09090b !important; }

.landing--light .compare-table-wrapper {
  background: rgba(255,255,255,0.6); backdrop-filter: blur(30px);
  border-color: rgba(255,255,255,1); box-shadow: 0 8px 32px rgba(0,0,0,0.06);
}
.landing--light .compare-table th,
.landing--light .compare-table td { border-bottom-color: rgba(0,0,0,0.06); }
.landing--light .compare-table .compare-highlight { background: rgba(0,0,0,0.02); }
.landing--light .compare-table thead .compare-highlight { color: #18181b; }
.landing--light .compare-table .compare-feature { color: #18181b; }

.landing--light .contact-form-card {
  background: rgba(255,255,255,0.55); backdrop-filter: blur(30px);
  border-color: rgba(255,255,255,1); box-shadow: 0 12px 32px rgba(0,0,0,0.06);
}
.landing--light .contact-info-card {
  background: rgba(255,255,255,0.4); backdrop-filter: blur(20px);
  border-color: rgba(255,255,255,0.9);
}
.landing--light .contact-info-icon { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.06); color: #18181b; }
.landing--light .contact-info-item h4 { color: #18181b; }
.landing--light .contact-email-link { color: #18181b; }
.landing--light .form-group input,
.landing--light .form-group textarea {
  background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.08); color: #18181b;
}
.landing--light .form-group input::placeholder,
.landing--light .form-group textarea::placeholder { color: #a1a1aa; }
.landing--light .form-group input:focus,
.landing--light .form-group textarea:focus {
  border-color: rgba(0,0,0,0.18); background: rgba(255,255,255,0.9);
  box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
}
.landing--light .calendly-btn { border-color: rgba(0,0,0,0.12) !important; color: #18181b !important; }

.landing--light .cta-sub .pi { color: #52525b; }

.landing--light .landing-footer { border-top-color: rgba(0,0,0,0.06); }
.landing--light .footer-bottom { border-top-color: rgba(0,0,0,0.06); }
.landing--light .footer-heading { color: #18181b; }
.landing--light .footer-links a { color: #52525b; }
.landing--light .footer-links a:hover { color: #18181b; }
.landing--light .footer-socials a { color: #71717a; }
.landing--light .footer-socials a:hover { color: #18181b; }

.landing--light .hero-grid-pattern {
  background-image:
    linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
}
.landing--light .hero-gradient {
  background:
    radial-gradient(circle at 40% 30%, rgba(0,0,0,0.04), transparent 50%),
    radial-gradient(circle at 60% 60%, rgba(0,0,0,0.03), transparent 50%);
}
.landing--light .hero-noise { opacity: 0.15; }

.landing--light .integ-icon {
  background: linear-gradient(180deg, #18181b, #52525b);
  -webkit-background-clip: text; background-clip: text;
}
.landing--light .integ-btn { border-color: rgba(0,0,0,0.15) !important; color: #18181b !important; }
.landing--light .integ-btn::after { border-color: rgba(0,0,0,0.2); }
.landing--light .integ-pill:hover { box-shadow: 0 24px 64px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.08); }

.landing--light .cta-mesh {
  background: radial-gradient(ellipse at 30% 50%, rgba(0,0,0,0.02), transparent 50%),
              radial-gradient(ellipse at 70% 50%, rgba(0,0,0,0.015), transparent 50%);
}
</style>
