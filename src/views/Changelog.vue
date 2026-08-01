<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'

const themeStore = useThemeStore()

const releases: { version: string; date: string; tag: string; items: { type: string; text: string }[] }[] = []

function typeLabel(type: string) {
  const labels: Record<string, string> = { feature: 'New', improvement: 'Improved', fix: 'Fixed', security: 'Security' }
  return labels[type] || type
}
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="legal-content">
      <div class="legal-header">
        <h1>Changelog</h1>
        <p class="legal-updated">What's new in AssetNode</p>
      </div>

      <div v-if="releases.length === 0" class="release-block" style="text-align: center; padding: 48px 0;">
        <i class="pi pi-clock" style="font-size: 2rem; color: var(--an-text-muted); margin-bottom: 16px;" />
        <h3 style="font-weight: 600; margin-bottom: 8px;">Changelog coming soon</h3>
        <p style="color: var(--an-text-subtle); font-size: 14px;">We're working on documenting our release history. Check back soon for updates.</p>
      </div>

      <div v-for="release in releases" :key="release.version" class="release-block">
        <div class="release-header">
          <h2>
            v{{ release.version }}
            <span v-if="release.tag" class="release-tag">{{ release.tag }}</span>
          </h2>
          <span class="release-date">{{ release.date }}</span>
        </div>
        <ul class="release-items">
          <li v-for="item in release.items" :key="item.text">
            <span class="release-type" :class="`type-${item.type}`">{{ typeLabel(item.type) }}</span>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>





.legal-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
.legal-updated { color: var(--an-text-muted); font-size: 14px; }

.release-block { margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid var(--an-border-dark); }
.release-block:last-child { border-bottom: none; }
.release-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.release-header h2 { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0; }
.release-tag { font-size: 11px; font-weight: 700; background: var(--an-emerald); color: #000; padding: 2px 10px; border-radius: 999px; }
.release-date { font-size: 13px; color: var(--an-text-muted); }

.release-items { list-style: none; padding: 0; margin: 0; }
.release-items li { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14px; color: var(--an-text-subtle); }
.release-type { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 4px; min-width: 56px; text-align: center; }
.type-feature { background: rgba(59,130,246,0.15); color: var(--an-cobalt); }
.type-improvement { background: rgba(16,185,129,0.15); color: #10b981; }
.type-fix { background: rgba(245,158,11,0.15); color: #f59e0b; }
.type-security { background: rgba(239,68,68,0.15); color: #ef4444; }

.legal-footer { max-width: 800px; margin: 0 auto; padding: 24px; border-top: 1px solid var(--an-border-dark); display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--an-text-muted); }
.legal-footer a { color: var(--an-primary); text-decoration: none; }



.legal-page--light .release-block { border-bottom-color: #e5e7eb; }

</style>
