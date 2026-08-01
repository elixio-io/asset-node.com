<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'

const router = useRouter()
const themeStore = useThemeStore()

const posts = [
  {
    title: 'IT-Offboarding Checkliste: Mitarbeiteraustritt absichern',
    date: '21. April 2026',
    category: 'Best Practice',
    excerpt: 'Wenn Mitarbeiter das Unternehmen verlassen, müssen Geräte zurückgegeben und Zugänge deaktiviert werden. 7 Schritte für ein sicheres IT-Offboarding.',
    readTime: '8 Min.',
    slug: 'it-offboarding-checkliste'
  },
  {
    title: 'DSGVO-konformes IT-Asset-Management: Anforderungen & Checkliste',
    date: '21. April 2026',
    category: 'Compliance',
    excerpt: 'IT-Assets enthalten personenbezogene Daten. 5 DSGVO-Anforderungen und eine Checkliste für datenschutzkonforme IT-Inventarverwaltung.',
    readTime: '10 Min.',
    slug: 'dsgvo-it-asset-management'
  },
  {
    title: 'Laptop-Onboarding automatisieren: Neue Mitarbeiter ausstatten',
    date: '21. April 2026',
    category: 'Automatisierung',
    excerpt: 'Der erste Arbeitstag entscheidet. So automatisieren IT-Teams das Laptop-Onboarding mit HR-Sync, MDM-Integration und Kits.',
    readTime: '7 Min.',
    slug: 'laptop-onboarding'
  },
  {
    title: 'Snipe-IT vs. AssetNode: Welches ITAM-Tool passt zu Ihrem Team?',
    date: '19. April 2026',
    category: 'Vergleich',
    excerpt: 'Snipe-IT ist das populärste Open-Source-ITAM-Tool. Aber Open-Source bedeutet nicht kostenlos. Ein ehrlicher Vergleich.',
    readTime: '10 Min.',
    slug: 'snipe-it-vs-assetnode'
  },
  {
    title: 'BlueTally vs. AssetNode: Preis- & Feature-Vergleich',
    date: '19. April 2026',
    category: 'Vergleich',
    excerpt: 'BlueTally beginnt bei $99/Monat. AssetNode bei €0. Ein Feature-Vergleich für die richtige Entscheidung.',
    readTime: '8 Min.',
    slug: 'bluetally-vs-assetnode'
  },
  {
    title: 'Warum Excel kein ITAM-Tool ist — 5 Gründe für den Wechsel',
    date: '5. Februar 2026',
    category: 'Ratgeber',
    excerpt: 'IT-Inventar mit Excel verwalten? 5 Gründe, warum Tabellen als Asset-Management-Tool scheitern.',
    readTime: '8 Min.',
    slug: 'excel-vs-itam'
  },
]
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="blog-content">
      <div class="blog-header">
        <h1>Blog</h1>
        <p>IT-Asset-Management Ratgeber, Produktupdates und Best Practices.</p>
      </div>

      <div class="blog-grid">
        <article v-for="post in posts" :key="post.title" class="blog-card" :class="{ 'blog-card--clickable': post.slug }" @click="post.slug && router.push(`/blog/${post.slug}`)">
          <div class="blog-meta">
            <span class="blog-category">{{ post.category }}</span>
            <span class="blog-date">{{ post.date }}</span>
          </div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.excerpt }}</p>
          <div class="blog-card-footer">
            <span class="blog-read-time">{{ post.readTime }}</span>
            <span v-if="post.slug" class="blog-read-link">Lesen →</span>
            <span v-else class="blog-coming-soon">Demnächst</span>
          </div>
        </article>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>



.blog-content { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; flex: 1; width: 100%; }
.blog-header { text-align: center; margin-bottom: 56px; }
.blog-header h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
.blog-header p { color: var(--an-text-subtle); font-size: 1.1rem; }

.blog-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
@media (max-width: 700px) { .blog-grid { grid-template-columns: 1fr; } }

.blog-card {
  padding: 28px;
  border: 1px solid var(--an-border-dark);
  border-radius: 14px;
  background: var(--an-surface-dark);
  transition: border-color 0.2s;
  cursor: pointer;
}
.blog-card:hover { border-color: var(--an-border-subtle); }
.blog-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.blog-category { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--an-primary); background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 4px; }
.blog-date { font-size: 12px; color: var(--an-text-muted); }
.blog-card h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; line-height: 1.4; }
.blog-card p { font-size: 13px; color: var(--an-text-subtle); line-height: 1.6; margin-bottom: 12px; }
.blog-read-time { font-size: 12px; color: var(--an-text-muted); }
.blog-card-footer { display: flex; align-items: center; justify-content: space-between; }
.blog-read-link { font-size: 13px; font-weight: 600; color: var(--an-primary); }
.blog-coming-soon { font-size: 11px; color: var(--an-text-muted); font-style: italic; }
.blog-card--clickable { cursor: pointer; }
.blog-card--clickable:hover { border-color: var(--an-primary); }


.legal-footer a { color: var(--an-primary); text-decoration: none; }


.legal-page--light .blog-card { background: white; border-color: #e5e7eb; }
.legal-page--light .blog-category { background: rgba(0,0,0,0.06); }

</style>
