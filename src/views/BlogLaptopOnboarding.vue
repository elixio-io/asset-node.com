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
  headline: 'Laptop-Onboarding automatisieren: Neue Mitarbeiter in Minuten ausstatten',
  datePublished: '2026-04-21',
  description: 'Laptop-Onboarding automatisieren: So statten IT-Teams neue Mitarbeiter mit Hardware aus — mit HR-Sync, MDM-Integration und Onboarding-Kits.',
  slug: 'laptop-onboarding-automatisieren'
})
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="article-content">
      <div class="article-meta">
        <router-link to="/blog" class="article-back">← Zurück zum Blog</router-link>
        <div class="article-tags">
          <span class="article-tag">Automatisierung</span>
          <span class="article-date">21. April 2026</span>
          <span class="article-read">7 Min. Lesezeit</span>
        </div>
      </div>

      <h1>Laptop-Onboarding automatisieren: Neue Mitarbeiter in Minuten ausstatten</h1>

      <p class="article-lead">
        Der erste Arbeitstag entscheidet über den ersten Eindruck. Wenn ein neuer Mitarbeiter am Schreibtisch
        sitzt und kein Laptop bereit liegt, kein Monitor angeschlossen ist und die Zugänge noch nicht eingerichtet
        sind, fängt die Employee Experience schlecht an. So automatisieren IT-Teams das Laptop-Onboarding.
      </p>

      <h2>Das Problem: Manuelles Onboarding skaliert nicht</h2>

      <p>
        In vielen Unternehmen läuft das Hardware-Onboarding so ab: HR schickt eine E-Mail an IT,
        IT sucht ein verfügbares Gerät, richtet es manuell ein, erstellt Zugänge und hofft, dass
        alles rechtzeitig fertig wird. Bei <strong>5 Neueinstellungen pro Monat</strong> funktioniert das.
        Bei 20 nicht mehr.
      </p>

      <p>Die häufigsten Probleme:</p>

      <ul class="article-list">
        <li><strong>Kein Überblick über verfügbare Geräte:</strong> Welche Laptops sind auf Lager? Welche sind gerade in Wartung?</li>
        <li><strong>Manuelle Kommunikation:</strong> Teams, E-Mail, Slack-Nachrichten als „Ticketsystem"</li>
        <li><strong>Vergessene Peripherie:</strong> Laptop ist da, aber Maus, Headset und Docking Station fehlen</li>
        <li><strong>MDM-Enrollment verzögert:</strong> Intune- oder Jamf-Profile werden erst nach dem ersten Login installiert</li>
      </ul>

      <div class="article-callout">
        <i class="pi pi-clock" />
        <div>
          <strong>Benchmark:</strong> Laut einer Studie von Rippling verbringen IT-Teams durchschnittlich
          <strong>3–5 Stunden</strong> pro neuem Mitarbeiter mit dem manuellen Hardware-Onboarding.
          Bei einem Stundensatz von 65 € sind das ~250 € pro Onboarding — nur für die IT-Seite.
        </div>
      </div>

      <h2>Die 4 Bausteine eines automatisierten Laptop-Onboardings</h2>

      <ol class="article-list">
        <li>
          <strong>HR-Sync:</strong> Neue Mitarbeiter werden automatisch aus dem HR-System (Personio, BambooHR, HiBob)
          importiert — mit Startdatum, Abteilung und Standort. Kein manuelles Anlegen.
        </li>
        <li>
          <strong>Onboarding-Kits:</strong> Vordefinierte Gerätepakete pro Rolle: „Entwickler-Kit" (MacBook Pro + 27" Monitor +
          USB-C Hub), „Sales-Kit" (ThinkPad + Headset + Webcam). Ein Klick statt fünf Einzelzuweisungen.
        </li>
        <li>
          <strong>MDM-Integration:</strong> Sobald ein Gerät zugewiesen wird, wird das MDM-Profil (Intune, Jamf, Kandji)
          automatisch gepusht. Zero-Touch Enrollment statt manueller Konfiguration.
        </li>
        <li>
          <strong>Automatische Benachrichtigungen:</strong> IT-Manager wird informiert, wenn ein Kit zugewiesen wurde.
          Der neue Mitarbeiter erhält eine Willkommens-E-Mail mit Gerätedetails und Setup-Anleitung.
        </li>
      </ol>

      <h2>Manuell vs. Automatisiert: Der Vergleich</h2>

      <div class="article-comparison">
        <h3>Onboarding-Workflow im Vergleich</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Schritt</th>
              <th>Manuell</th>
              <th>Automatisiert (ITAM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mitarbeiter anlegen</td>
              <td class="text-warn">Manuell in Excel</td>
              <td class="text-good">✅ HR-Sync (Personio)</td>
            </tr>
            <tr>
              <td>Verfügbares Gerät finden</td>
              <td class="text-warn">Excel durchsuchen</td>
              <td class="text-good">✅ Statusfilter im ITAM</td>
            </tr>
            <tr>
              <td>Peripherie zuweisen</td>
              <td class="text-warn">Einzeln per Mail</td>
              <td class="text-good">✅ Onboarding-Kit</td>
            </tr>
            <tr>
              <td>MDM-Enrollment</td>
              <td class="text-warn">Manuell starten</td>
              <td class="text-good">✅ Zero-Touch</td>
            </tr>
            <tr>
              <td>Dokumentation</td>
              <td class="text-warn">Screenshot + E-Mail</td>
              <td class="text-good">✅ Automatischer Audit-Trail</td>
            </tr>
            <tr>
              <td>Zeitaufwand</td>
              <td class="text-warn">3–5 Stunden</td>
              <td class="text-good">~15 Minuten</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Wie AssetNode Laptop-Onboarding automatisiert</h2>

      <ul class="article-list">
        <li><strong>HR-Synchronisation:</strong> Neue Mitarbeiter werden automatisch aus Personio, BambooHR oder über SCIM importiert</li>
        <li><strong>Onboarding-Kits:</strong> Vordefinierte Gerätepakete — ein Klick weist Laptop, Monitor, Peripherie und Lizenzen gleichzeitig zu</li>
        <li><strong>MDM-Integration:</strong> Intune, Jamf und Kandji werden automatisch synchronisiert — Gerätestatus in Echtzeit</li>
        <li><strong>Audit-Trail:</strong> Wer hat wann welches Gerät erhalten? Lückenlos dokumentiert für Compliance</li>
      </ul>

      <h2>Fazit</h2>

      <p>
        Manuelles Laptop-Onboarding ist teuer, fehleranfällig und hinterlässt bei neuen Mitarbeitern keinen guten
        ersten Eindruck. Mit der richtigen ITAM-Software lässt sich der gesamte Prozess — von der HR-Meldung bis zum
        fertig eingerichteten Gerät am Schreibtisch — in Minuten statt Stunden abwickeln.
      </p>

      <div class="article-cta">
        <h3>Onboarding automatisieren</h3>
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
