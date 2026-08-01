<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import { onMounted } from 'vue'

const themeStore = useThemeStore()

onMounted(() => {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://asset-node.com/' },
      { '@type': 'ListItem', position: 2, name: 'About' }
    ]
  }

  const existing = document.getElementById('breadcrumb-jsonld')
  if (existing) existing.remove()
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(breadcrumb)
  script.id = 'breadcrumb-jsonld'
  document.head.appendChild(script)
})

const values = [
  { icon: 'pi pi-shield', titleKey: 'about.securityFirst', descKey: 'about.securityFirstDesc' },
  { icon: 'pi pi-eye', titleKey: 'about.transparency', descKey: 'about.transparencyDesc' },
  { icon: 'pi pi-bolt', titleKey: 'about.apiFirst', descKey: 'about.apiFirstDesc' },
  { icon: 'pi pi-globe', titleKey: 'about.multiLanguage', descKey: 'about.multiLanguageDesc' },
]
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="about-content">
      <div class="about-header">
        <h1>{{ $t('about.title') }}</h1>
        <p>{{ $t('about.subtitle') }}</p>
      </div>

      <section class="about-story">
        <h2>{{ $t('about.ourStory') }}</h2>
        <p>{{ $t('about.storyText') }}</p>
        <p>{{ $t('about.basedIn') }}</p>
      </section>

      <section>
        <h2>{{ $t('about.values') }}</h2>
        <div class="values-grid">
          <div v-for="v in values" :key="v.titleKey" class="value-card">
            <div class="value-icon"><i :class="v.icon" /></div>
            <h3>{{ $t(v.titleKey) }}</h3>
            <p>{{ $t(v.descKey) }}</p>
          </div>
        </div>
      </section>



      <section class="about-story">
        <h2>{{ $t('about.bonnTitle') }}</h2>
        <p>{{ $t('about.bonnText') }}</p>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>




.about-content { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; width: 100%; }
.about-header { text-align: center; margin-bottom: 64px; }
.about-header h1 { font-size: 2.4rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 16px; }
.about-header p { color: var(--an-text-subtle); font-size: 1.15rem; max-width: 600px; margin: 0 auto; line-height: 1.7; }

.about-story { max-width: 700px; margin-bottom: 56px; }
.about-story h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 16px; }
.about-story p { color: var(--an-text-subtle); line-height: 1.8; margin-bottom: 14px; font-size: 15px; }

.about-content section { margin-bottom: 56px; }
.about-content h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 24px; }

.values-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
@media (max-width: 600px) { .values-grid { grid-template-columns: 1fr; } }
.value-card { padding: 28px; border: 1px solid var(--an-border-dark); border-radius: 14px; background: var(--an-surface-dark); }
.value-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; color: var(--an-cobalt); margin-bottom: 14px; }
.value-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 6px; }
.value-card p { font-size: 13px; color: var(--an-text-subtle); line-height: 1.6; margin: 0; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 600px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
.stat-card { text-align: center; padding: 28px 16px; border: 1px solid var(--an-border-dark); border-radius: 14px; background: var(--an-surface-dark); }
.stat-value { display: block; font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; color: var(--an-primary); }
.stat-label { font-size: 13px; color: var(--an-text-muted); margin-top: 4px; }


.legal-footer a { color: var(--an-primary); text-decoration: none; }


.legal-page--light .value-card, .legal-page--light .stat-card { background: white; border-color: #e5e7eb; }

</style>
