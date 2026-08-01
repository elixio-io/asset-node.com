<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import { useBlogArticleSchema } from '../composables/useBlogArticleSchema'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
import Button from 'primevue/button'

const router = useRouter()
const themeStore = useThemeStore()

useBlogArticleSchema({
  headline: 'BlueTally vs. AssetNode — Preis- & Feature-Vergleich',
  datePublished: '2026-04-19',
  description: 'BlueTally vs. AssetNode: Preisvergleich ($99 vs. €20/Monat), Features, DSGVO-Konformität und Workflow-Automatisierung im direkten Vergleich.',
  slug: 'bluetally-vs-assetnode'
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="article-content">
      <div class="article-meta">
        <router-link to="/blog" class="article-back">← Back to Blog</router-link>
        <div class="article-tags">
          <span class="article-tag">Comparison</span>
          <span class="article-date">April 2026</span>
          <span class="article-read">8 min read</span>
        </div>
      </div>

      <h1>BlueTally vs. AssetNode: Feature Comparison for IT Teams</h1>

      <p class="article-lead">
        BlueTally is a popular cloud-based IT asset tracker. But at $99–$499/month, is it the right investment?
        Here's how it compares to AssetNode — feature by feature.
      </p>

      <h2>Pricing: The Elephant in the Room</h2>

      <p>
        BlueTally starts at $99/month for their "Pro" plan and scales to $499/month for enterprise features.
        For many SMB IT teams — especially in the DACH region — that's a significant line item for what is
        essentially an inventory tracker.
      </p>
      <p>
        AssetNode offers a <strong>free forever plan</strong> with 100 assets, 5 users, 1 MDM integration,
        and read-only API access. Paid plans start at just <strong>€20/month</strong> — roughly 80% less
        than BlueTally's entry point.
      </p>

      <h2>Feature-by-Feature Comparison</h2>

      <div class="article-comparison">
        <h3>BlueTally vs. AssetNode</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>BlueTally</th>
              <th>AssetNode</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Starting Price</td>
              <td class="text-warn">$99/mo (Pro plan)</td>
              <td class="text-good">€0 (Free) / €20/mo</td>
            </tr>
            <tr>
              <td>Free Plan</td>
              <td class="text-warn">❌ No free tier</td>
              <td class="text-good">✅ 100 assets, 5 users</td>
            </tr>
            <tr>
              <td>MDM Auto-Sync</td>
              <td class="text-neutral">✅ Intune, Jamf</td>
              <td class="text-good">✅ Intune, Jamf, Kandji, Autopilot</td>
            </tr>
            <tr>
              <td>Workflow Automation</td>
              <td class="text-warn">❌ Not available</td>
              <td class="text-good">✅ Onboarding, offboarding, alerts</td>
            </tr>
            <tr>
              <td>SCIM 2.0 Provisioning</td>
              <td class="text-neutral">✅ Available (higher tiers)</td>
              <td class="text-good">✅ Available on Pro plan</td>
            </tr>
            <tr>
              <td>Custom Fields</td>
              <td class="text-neutral">✅ Unlimited</td>
              <td class="text-good">✅ 3 free, unlimited on paid</td>
            </tr>
            <tr>
              <td>REST API</td>
              <td class="text-neutral">✅ Full API</td>
              <td class="text-good">✅ Full API (read-only free)</td>
            </tr>
            <tr>
              <td>QR/Barcode Labels</td>
              <td class="text-neutral">✅ Built-in</td>
              <td class="text-good">✅ Built-in</td>
            </tr>
            <tr>
              <td>EU Data Residency</td>
              <td class="text-warn">❌ US-hosted</td>
              <td class="text-good">✅ Hosted in Germany</td>
            </tr>
            <tr>
              <td>GDPR Compliance</td>
              <td class="text-warn">⚠️ US-based, data transfers</td>
              <td class="text-good">✅ GDPR-native, no US transfers</td>
            </tr>
            <tr>
              <td>Employee Lifecycle</td>
              <td class="text-neutral">✅ Check in/out</td>
              <td class="text-good">✅ Full lifecycle with automation</td>
            </tr>
            <tr>
              <td>Depreciation Tracking</td>
              <td class="text-neutral">✅ Available</td>
              <td class="text-good">✅ Built-in</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Where BlueTally Wins</h2>
      <p>Let's be fair — BlueTally has strengths:</p>

      <ul class="article-list">
        <li><strong>Longer market presence</strong> — BlueTally has been around longer and has a larger user base</li>
        <li><strong>More polished UI</strong> — Years of iteration have produced a refined interface</li>
        <li><strong>Richer reporting</strong> — Their analytics and reporting suite is more mature</li>
        <li><strong>Mobile app</strong> — BlueTally has a dedicated mobile app for scanning and tracking</li>
      </ul>

      <h2>Where AssetNode Wins</h2>

      <ul class="article-list">
        <li><strong>80% lower cost</strong> — €20/mo vs. $99/mo. Plus a real free plan.</li>
        <li><strong>Workflow automation</strong> — Built-in automation for onboarding, offboarding, warranty alerts. BlueTally doesn't have this.</li>
        <li><strong>EU data residency</strong> — Data stays in Germany. For DACH companies with GDPR requirements, this is non-negotiable.</li>
        <li><strong>Broader MDM support</strong> — Kandji and Autopilot support on top of Intune and Jamf.</li>
        <li><strong>True free tier</strong> — 100 assets and 5 users, permanently free. Enough for a small team to fully evaluate.</li>
      </ul>

      <div class="article-callout">
        <i class="pi pi-info-circle" />
        <div>
          <strong>DACH Tip:</strong> If your company is subject to GDPR, check whether your ITAM vendor stores
          data in the EU. BlueTally is US-hosted — AssetNode runs on Hetzner servers in Germany.
        </div>
      </div>

      <h2>Who Should Choose What?</h2>

      <p><strong>Choose BlueTally if:</strong></p>
      <ul class="article-list">
        <li>You're a US-based company without EU data residency requirements</li>
        <li>You need a mature mobile app for warehouse scanning</li>
        <li>Budget isn't a primary constraint and you want a proven solution</li>
      </ul>

      <p><strong>Choose AssetNode if:</strong></p>
      <ul class="article-list">
        <li>You're in the DACH region and GDPR/EU hosting matters</li>
        <li>You want workflow automation for onboarding/offboarding</li>
        <li>You're cost-conscious (€20 vs. $99+/mo)</li>
        <li>You want to start free and grow into paid features naturally</li>
        <li>You use Intune, Jamf, Kandji, or Autopilot for MDM</li>
      </ul>

      <div class="article-cta">
        <h3>Switch from BlueTally? We'll help.</h3>
        <p>Import your existing asset data in minutes. Free plan includes 100 assets, 5 users, and MDM sync.</p>
        <Button label="Start free — No credit card" icon="pi pi-arrow-right" @click="router.push('/sign-up')" />
      </div>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>
.article-content { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; }

.article-meta { margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.article-back { font-size: 13px; color: var(--an-primary); text-decoration: none; font-weight: 600; }
.article-back:hover { text-decoration: underline; }
.article-tags { display: flex; align-items: center; gap: 12px; }
.article-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--an-primary); background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 4px; }
.article-date, .article-read { font-size: 12px; color: var(--an-text-muted); }

.article-content h1 {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.3;
  margin-bottom: 24px;
}

.article-lead {
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--an-text-subtle);
  margin-bottom: 40px;
  border-left: 3px solid var(--an-primary);
  padding-left: 20px;
}

.article-content h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-top: 40px;
  margin-bottom: 16px;
  letter-spacing: -0.02em;
}

.article-content p {
  font-size: 15px;
  line-height: 1.8;
  color: var(--an-text-subtle);
  margin-bottom: 20px;
}

.article-content strong { color: var(--an-text-primary); }

.article-comparison {
  margin: 32px 0;
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  overflow: hidden;
  background: var(--an-surface-dark);
}
.article-comparison h3 {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 16px 20px;
  margin: 0;
  border-bottom: 1px solid var(--an-border-dark);
  color: var(--an-text-muted);
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.comparison-table th {
  text-align: left;
  padding: 10px 16px;
  font-weight: 600;
  color: var(--an-text-muted);
  border-bottom: 1px solid var(--an-border-dark);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.comparison-table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--an-border-dark);
  line-height: 1.5;
}
.comparison-table tr:last-child td { border-bottom: none; }
.text-warn { color: var(--an-text-muted); }
.text-good { color: var(--an-primary); }
.text-neutral { color: var(--an-text-subtle); }

.article-list {
  margin: 16px 0 24px;
  padding-left: 20px;
}
.article-list li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--an-text-subtle);
  margin-bottom: 12px;
}
.article-list li strong { color: var(--an-text-primary); }

.article-callout {
  display: flex;
  gap: 16px;
  padding: 20px;
  margin: 28px 0;
  border: 1px solid var(--an-primary);
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  font-size: 14px;
  line-height: 1.6;
  color: var(--an-text-subtle);
}
.article-callout i {
  color: var(--an-primary);
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}
.article-callout strong { color: var(--an-text-primary); }

.article-cta {
  text-align: center;
  padding: 40px;
  margin-top: 48px;
  border: 1px solid var(--an-border-dark);
  border-radius: 16px;
  background: var(--an-surface-dark);
}
.article-cta h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; }
.article-cta p { color: var(--an-text-subtle); font-size: 15px; margin-bottom: 16px; }

.legal-page--light .article-comparison { background: white; border-color: #e5e7eb; }
.legal-page--light .article-comparison h3 { border-bottom-color: #e5e7eb; }
.legal-page--light .comparison-table th, .legal-page--light .comparison-table td { border-bottom-color: #e5e7eb; }
.legal-page--light .article-cta { background: white; border-color: #e5e7eb; }
.legal-page--light .article-tag { background: rgba(0,0,0,0.06); }
.legal-page--light .article-callout { background: rgba(0,0,0,0.03); }

@media (max-width: 600px) {
  .article-content h1 { font-size: 1.5rem; }
  .comparison-table { font-size: 11px; }
  .comparison-table th, .comparison-table td { padding: 8px 10px; }
}
</style>
