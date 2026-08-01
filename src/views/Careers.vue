<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="careers-content">
      <div class="careers-header">
        <h1>Careers at AssetNode</h1>
        <p>We're a small team based in Bonn, building modern IT asset management software.</p>
      </div>

      <section class="careers-cta">
        <div style="text-align: center; padding: 48px 24px;">
          <i class="pi pi-briefcase" style="font-size: 2.5rem; color: var(--an-primary); margin-bottom: 16px; display: block;" />
          <h2>No open positions right now</h2>
          <p style="max-width: 480px; margin: 12px auto 0;">We're not actively hiring at the moment, but we're always interested in hearing from talented people. Check back later for updates.</p>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>




.careers-content { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; width: 100%; }
.careers-header { text-align: center; margin-bottom: 56px; }
.careers-header h1 { font-size: 2.4rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
.careers-header p { color: var(--an-text-subtle); font-size: 1.15rem; }

.careers-content section { margin-bottom: 56px; }
.careers-content h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 24px; }

.perks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 600px) { .perks-grid { grid-template-columns: repeat(2, 1fr); } }
.perk-item { display: flex; align-items: center; gap: 10px; padding: 16px; border: 1px solid var(--an-border-dark); border-radius: 10px; background: var(--an-surface-dark); font-size: 14px; }

.openings-list { display: flex; flex-direction: column; gap: 16px; }
.job-card { padding: 28px; border: 1px solid var(--an-border-dark); border-radius: 14px; background: var(--an-surface-dark); transition: border-color 0.2s; }
.job-card:hover { border-color: var(--an-border-subtle); }
.job-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.job-header h3 { font-size: 1.05rem; font-weight: 700; margin: 0; }
.job-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.job-tag { font-size: 11px; font-weight: 600; color: var(--an-text-muted); background: var(--an-surface-elevated); padding: 3px 10px; border-radius: 4px; }
.job-card p { font-size: 14px; color: var(--an-text-subtle); line-height: 1.6; margin-bottom: 12px; }
.job-apply { font-size: 13px; font-weight: 600; color: var(--an-primary); text-decoration: none; }
.job-apply:hover { text-decoration: underline; }

.careers-cta { text-align: center; padding: 40px; border: 1px solid var(--an-border-dark); border-radius: 16px; background: var(--an-surface-dark); }
.careers-cta h2 { margin-bottom: 8px; }
.careers-cta p { color: var(--an-text-subtle); font-size: 15px; }
.careers-cta a { color: var(--an-primary); }

.legal-footer { max-width: 800px; margin: 0 auto; padding: 24px; border-top: 1px solid var(--an-border-dark); display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--an-text-muted); }
.legal-footer a { color: var(--an-primary); text-decoration: none; }


.legal-page--light .perk-item, .legal-page--light .job-card, .legal-page--light .careers-cta { background: white; border-color: #e5e7eb; }
.legal-page--light .legal-footer { border-top-color: #e5e7eb; }
</style>
