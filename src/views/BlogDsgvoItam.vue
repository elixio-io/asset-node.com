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
  headline: 'DSGVO-konformes IT-Asset-Management: Anforderungen & Best Practices',
  datePublished: '2026-04-21',
  description: 'DSGVO und IT-Asset-Management: 5 Anforderungen, Checkliste und Best Practices für datenschutzkonforme IT-Inventarverwaltung.',
  slug: 'dsgvo-it-asset-management'
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="article-content">
      <div class="article-meta">
        <router-link to="/blog" class="article-back">← Zurück zum Blog</router-link>
        <div class="article-tags">
          <span class="article-tag">Compliance</span>
          <span class="article-date">21. April 2026</span>
          <span class="article-read">10 Min. Lesezeit</span>
        </div>
      </div>

      <h1>DSGVO-konformes IT-Asset-Management: Anforderungen & Best Practices</h1>

      <p class="article-lead">
        IT-Assets enthalten personenbezogene Daten — von Mitarbeiternamen auf Zuordnungen bis zu Login-Daten
        auf Geräten. Die DSGVO stellt klare Anforderungen an die Verwaltung dieser Daten. Dieser Artikel zeigt,
        was IT-Teams beachten müssen und wie moderne ITAM-Software dabei hilft.
      </p>

      <h2>Warum DSGVO und IT-Asset-Management zusammengehören</h2>

      <p>
        Viele IT-Abteilungen betrachten DSGVO-Compliance als Thema der Rechtsabteilung.
        Doch die Verordnung betrifft direkt die tägliche Arbeit jedes IT-Administrators:
      </p>

      <ul class="article-list">
        <li><strong>Mitarbeiterdaten in der Inventarverwaltung:</strong> Name, E-Mail, Abteilung, Standort — alles personenbezogene Daten nach Art. 4 DSGVO</li>
        <li><strong>Gerätezuordnungen:</strong> Die Zuordnung „Laptop X gehört Mitarbeiter Y" ist ein personenbezogenes Datum</li>
        <li><strong>Audit-Trails:</strong> Wer hat wann welches Gerät erhalten oder zurückgegeben? Protokolldaten unterliegen der DSGVO</li>
        <li><strong>Daten auf Geräten:</strong> Beim Offboarding müssen Gerätedaten DSGVO-konform gelöscht werden</li>
      </ul>

      <h2>Die 5 DSGVO-Anforderungen an IT-Asset-Management</h2>

      <ol class="article-list">
        <li>
          <strong>Rechtsgrundlage (Art. 6 DSGVO):</strong> Verarbeitung basiert auf Vertragserfüllung (Art. 6 Abs. 1 lit. b),
          berechtigtem Interesse (Art. 6 Abs. 1 lit. f) oder gesetzlicher Pflicht (Art. 6 Abs. 1 lit. c).
        </li>
        <li>
          <strong>Datenminimierung (Art. 5 Abs. 1 lit. c):</strong> Nur die für die IT-Verwaltung notwendigen Daten erfassen.
          Name, E-Mail, Abteilung und Standort reichen für die Zuordnung.
        </li>
        <li>
          <strong>Speicherbegrenzung (Art. 5 Abs. 1 lit. e):</strong> Nach dem Austritt müssen Mitarbeiterdaten
          innerhalb der Aufbewahrungsfristen gelöscht werden — mit Ausnahme steuerlich relevanter Asset-Daten (6–10 Jahre HGB/AO).
        </li>
        <li>
          <strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Mitarbeiter haben das Recht zu erfahren, welche Daten gespeichert sind.
          Ihr ITAM-System muss alle zugeordneten Assets und Protokolldaten schnell zusammenstellen können.
        </li>
        <li>
          <strong>Auftragsverarbeitung (Art. 28 DSGVO):</strong> Bei cloudbasiertem ITAM muss ein Auftragsverarbeitungsvertrag (AVV)
          vorliegen und die Datenverarbeitung in der EU stattfinden.
        </li>
      </ol>

      <div class="article-callout">
        <i class="pi pi-shield" />
        <div>
          <strong>Praxistipp:</strong> Prüfen Sie bei jedem ITAM-Anbieter, ob ein AVV (Auftragsverarbeitungsvertrag)
          verfügbar ist und wo die Server stehen. US-Cloud-Anbieter sind nach dem Schrems-II-Urteil problematisch.
        </div>
      </div>

      <h2>Excel vs. ITAM-Software: DSGVO-Perspektive</h2>

      <div class="article-comparison">
        <h3>DSGVO-Konformität im Vergleich</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Kriterium</th>
              <th>Excel / Google Sheets</th>
              <th>ITAM-Software</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Zugriffsprotokollierung</td>
              <td class="text-warn">❌ Nicht vorhanden</td>
              <td class="text-good">✅ Vollständiger Audit-Trail</td>
            </tr>
            <tr>
              <td>Löschfristen</td>
              <td class="text-warn">❌ Manuell verwalten</td>
              <td class="text-good">✅ Automatische Bereinigung</td>
            </tr>
            <tr>
              <td>Datenkontrolle</td>
              <td class="text-warn">❌ Lokale Kopien per E-Mail</td>
              <td class="text-good">✅ Zentrale Datenhaltung</td>
            </tr>
            <tr>
              <td>Verschlüsselung</td>
              <td class="text-warn">❌ Oft unverschlüsselt</td>
              <td class="text-good">✅ TLS + at-rest Encryption</td>
            </tr>
            <tr>
              <td>Rollenbasierte Zugriffskontrolle</td>
              <td class="text-warn">❌ Nicht möglich</td>
              <td class="text-good">✅ Admin, Manager, Mitarbeiter</td>
            </tr>
            <tr>
              <td>Auskunftsanfragen (Art. 15)</td>
              <td class="text-warn">⚠️ Manuell zusammenstellen</td>
              <td class="text-good">✅ Export per Klick</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Checkliste: Ist Ihre IT-Inventarverwaltung DSGVO-konform?</h2>

      <ul class="article-list">
        <li>Rechtsgrundlage für die Datenverarbeitung dokumentiert?</li>
        <li>Verarbeitungsverzeichnis nach Art. 30 DSGVO geführt?</li>
        <li>Auftragsverarbeitungsvertrag mit ITAM-Anbieter abgeschlossen?</li>
        <li>Datenverarbeitung in der EU (nicht US)?</li>
        <li>Zugriffsprotokollierung (Audit-Trail) aktiv?</li>
        <li>Löschkonzept für ausgeschiedene Mitarbeiter definiert?</li>
        <li>Auskunftsanfragen nach Art. 15 innerhalb von 30 Tagen beantwortbar?</li>
        <li>Technische und organisatorische Maßnahmen (TOMs) dokumentiert?</li>
      </ul>

      <h2>Wie AssetNode DSGVO-Compliance sicherstellt</h2>

      <ul class="article-list">
        <li><strong>Hosting in Deutschland:</strong> Alle Daten werden auf Hetzner-Servern in Deutschland gespeichert — kein US-Cloud-Transfer</li>
        <li><strong>Vollständiger Audit-Trail:</strong> Jede Änderung an Assets, Zuordnungen und Mitarbeiterdaten wird protokolliert</li>
        <li><strong>Rollenbasierte Zugriffskontrolle:</strong> Admin, Manager und Mitarbeiter-Rollen mit klar definierten Berechtigungen</li>
        <li><strong>Datenexport:</strong> Alle Daten können jederzeit als CSV exportiert werden (Datenportabilität, Art. 20)</li>
        <li><strong>Löschkonzept:</strong> Mitarbeiterdaten können bei Austritt systematisch bereinigt werden</li>
      </ul>

      <h2>Fazit</h2>

      <p>
        DSGVO-konformes IT-Asset-Management ist keine Option — es ist Pflicht.
        Wer 2026 noch mit Excel arbeitet, riskiert nicht nur Bußgelder,
        sondern auch den Verlust von Mitarbeitervertrauen.
        Mit einer modernen ITAM-Plattform wie AssetNode schaffen Sie die technischen
        Voraussetzungen für compliance-konforme IT-Verwaltung.
      </p>

      <div class="article-cta">
        <h3>DSGVO-konformes ITAM testen</h3>
        <p>Kostenlos für bis zu 100 Assets. Hosting in Deutschland, keine Kreditkarte nötig.</p>
        <Button label="Jetzt kostenlos starten" icon="pi pi-arrow-right" @click="router.push('/sign-up')" />
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
