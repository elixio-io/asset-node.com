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
  headline: 'IT-Offboarding Checkliste: So sichern Sie den Mitarbeiteraustritt ab',
  datePublished: '2026-04-21',
  description: 'IT-Offboarding Checkliste: 7 Schritte für einen sicheren Mitarbeiteraustritt. Geräterückgabe, Zugänge deaktivieren, Lizenzen freigeben.',
  slug: 'it-offboarding-checkliste'
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="article-content">
      <div class="article-meta">
        <router-link to="/blog" class="article-back">← Zurück zum Blog</router-link>
        <div class="article-tags">
          <span class="article-tag">Best Practice</span>
          <span class="article-date">21. April 2026</span>
          <span class="article-read">8 Min. Lesezeit</span>
        </div>
      </div>

      <h1>IT-Offboarding Checkliste: So sichern Sie den Mitarbeiteraustritt ab</h1>

      <p class="article-lead">
        Wenn Mitarbeiter das Unternehmen verlassen, stehen IT-Teams vor einer kritischen Aufgabe: Alle Geräte müssen
        zurückgegeben, Zugänge deaktiviert und Lizenzen neu zugeordnet werden. Ein unvollständiges IT-Offboarding
        gefährdet nicht nur die Sicherheit, sondern kostet bares Geld.
      </p>

      <h2>Warum IT-Offboarding so wichtig ist</h2>

      <p>
        Laut einer Studie von Oomnitza gehen Unternehmen pro Mitarbeiteraustritt durchschnittlich
        <strong>$1.200 an IT-Hardware</strong> und Lizenzen verloren — weil kein systematischer Prozess existiert.
        Im deutschen Mittelstand ist die Lage ähnlich: Excel-Listen, mündliche Absprachen und fehlende Übergabeprotokolle
        führen dazu, dass Geräte verschwinden und Zugänge aktiv bleiben.
      </p>

      <p>Ein professioneller IT-Offboarding-Prozess schützt vor:</p>

      <ul class="article-list">
        <li><strong>Sicherheitsrisiken:</strong> Ehemalige Mitarbeiter behalten Zugang zu E-Mail, Cloud-Speicher und internen Systemen</li>
        <li><strong>Compliance-Verstößen:</strong> Die DSGVO verlangt, dass personenbezogene Daten nach dem Austritt korrekt behandelt werden</li>
        <li><strong>Vermögensverlust:</strong> Nicht zurückgegebene Laptops, Monitore und Peripheriegeräte summieren sich schnell</li>
        <li><strong>Lizenzverschwendung:</strong> Software-Lizenzen bleiben inaktiven Nutzern zugeordnet</li>
      </ul>

      <h2>Die 7-Punkte IT-Offboarding-Checkliste</h2>

      <ol class="article-list">
        <li>
          <strong>Geräteinventur erstellen:</strong> Verschaffen Sie sich einen vollständigen Überblick über alle dem Mitarbeiter zugeordneten Assets —
          Laptop, Smartphone, Headset, Monitor, Docking Station, Ladekabel. Mit einer ITAM-Software wie AssetNode sehen Sie alle Zuordnungen auf einen Blick.
        </li>
        <li>
          <strong>Rückgabetermin planen:</strong> Legen Sie einen konkreten Termin für die Geräterückgabe fest — idealerweise am letzten Arbeitstag.
          Erstellen Sie ein Übergabeprotokoll mit Seriennummern und Zustandsdokumentation.
        </li>
        <li>
          <strong>Zugänge deaktivieren:</strong> E-Mail-Konto (Microsoft 365, Google Workspace), MDM-Profile (Intune, Jamf, Kandji),
          VPN-Zugänge, Passwort-Manager und SCIM-provisioned Accounts systematisch deaktivieren.
        </li>
        <li>
          <strong>Lizenzen neu zuordnen:</strong> Prüfen Sie, welche Software-Lizenzen dem Mitarbeiter zugeordnet waren.
          Übertragen Sie diese auf den Nachfolger oder setzen Sie sie frei.
        </li>
        <li>
          <strong>Daten sichern und bereinigen:</strong> Relevante Arbeitsdaten vor dem Geräte-Wipe sichern.
          Personenbezogene Daten DSGVO-konform löschen und im Audit-Log dokumentieren.
        </li>
        <li>
          <strong>Gerät zurücksetzen:</strong> Werksreset durchführen — bei MDM-verwalteten Geräten remote über Intune oder Jamf.
          Anschließend dem neuen Mitarbeiter zuordnen oder im Marktplatz zur Disposition freigeben.
        </li>
        <li>
          <strong>Offboarding dokumentieren:</strong> Rückgabedatum, Gerätezustand, deaktivierte Zugänge und
          freigegebene Lizenzen im Audit-Trail festhalten. Für ISO 27001-zertifizierte Unternehmen ist das Pflicht.
        </li>
      </ol>

      <div class="article-callout">
        <i class="pi pi-exclamation-triangle" />
        <div>
          <strong>Wichtig:</strong> Wenn Ihr Unternehmen SCIM 2.0 nutzt, kann die Deprovisionierung automatisch erfolgen —
          AssetNode unterstützt SCIM-basierte Deaktivierung über Okta, Azure AD und OneLogin.
        </div>
      </div>

      <h2>Was kostet ein schlechtes IT-Offboarding?</h2>

      <p>Die Kosten eines unstrukturierten Offboardings lassen sich konkret beziffern:</p>

      <div class="article-comparison">
        <h3>Typische Verluste pro Mitarbeiteraustritt</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Kostenfaktor</th>
              <th>Durchschnittliche Kosten</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nicht zurückgegebene Hardware</td>
              <td class="text-warn">€800–1.500 pro Laptop</td>
            </tr>
            <tr>
              <td>Ungenutzte Lizenzen</td>
              <td class="text-warn">€50–200/Monat pro Mitarbeiter</td>
            </tr>
            <tr>
              <td>Sicherheitsvorfälle</td>
              <td class="text-warn">Ø €4.35 Mio. pro Data Breach</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>Ein einziger vergessener Admin-Zugang kann ausreichen, um die gesamte IT-Infrastruktur zu gefährden.</p>

      <h2>Wie AssetNode IT-Offboarding automatisiert</h2>

      <p>AssetNode vereinfacht den Offboarding-Prozess durch drei Kernfunktionen:</p>

      <ul class="article-list">
        <li><strong>Zentrale Zuordnungsübersicht:</strong> Alle einem Mitarbeiter zugeordneten Assets (Hardware, Lizenzen, Peripherie) auf einen Blick</li>
        <li><strong>Automatische MDM-Synchronisation:</strong> Gerätestatus wird in Echtzeit aus Intune, Jamf & Kandji aktualisiert</li>
        <li><strong>Audit-Trail:</strong> Jede Geräterückgabe und Zustandsänderung wird automatisch protokolliert</li>
      </ul>

      <h2>Fazit</h2>

      <p>
        IT-Offboarding ist kein Nice-to-have — es ist ein kritischer Sicherheits- und Compliance-Prozess.
        Mit einer klaren Checkliste und der richtigen ITAM-Software stellen Sie sicher, dass beim Mitarbeiteraustritt
        kein Gerät verloren geht, kein Zugang aktiv bleibt und keine Lizenz verschwendet wird.
      </p>

      <div class="article-cta">
        <h3>IT-Offboarding professionell absichern</h3>
        <p>Kostenlos für bis zu 100 Assets. Keine Kreditkarte, kein Server-Setup nötig.</p>
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
