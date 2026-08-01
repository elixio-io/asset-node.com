import { createServiceLogger } from './logger'
import { Organization } from '../../models/Organization'
import { User } from '../../models/User'
import type { PlanKey } from '../config/plans'
import { PLANS } from '../config/plans'


const log = createServiceLogger('TrialGuidance')


export interface GuidanceStep {
  key: string
  triggerDay: number
  subject: { de: string; en: string }
  heading: { de: string; en: string }
  blocks: { de: string[]; en: string[] }
}

const GUIDANCE_STEPS: GuidanceStep[] = [
  {
    key: 'welcome',
    triggerDay: 1,
    subject: {
      de: 'Willkommen bei AssetNode — Erste Schritte',
      en: 'Welcome to AssetNode — Getting started',
    },
    heading: {
      de: 'Willkommen bei Ihrer Testphase! 🎉',
      en: 'Welcome to your trial! 🎉',
    },
    blocks: {
      de: [
        'Ihr AssetNode-Konto ist eingerichtet. Hier sind die ersten Schritte, um Ihre IT-Assets effizient zu verwalten:',
        '<strong>1. Dashboard erkunden</strong><br>Ihr Dashboard zeigt Ihnen eine Übersicht aller Assets, Zuweisungen und anstehender Wartungen auf einen Blick.',
        '<strong>2. Erstes Gerät anlegen</strong><br>Gehen Sie zu <em>Hardware → Neues Gerät</em> und erfassen Sie Ihr erstes IT-Asset. Sie können Seriennummer, Modell, Kaufdatum und mehr hinterlegen.',
        '<strong>3. Mitarbeiter importieren</strong><br>Unter <em>Mitarbeiter</em> können Sie Ihr Team manuell anlegen oder per CSV importieren. Danach können Sie Geräte direkt zuweisen.',
      ],
      en: [
        'Your AssetNode account is set up. Here are the first steps to manage your IT assets efficiently:',
        '<strong>1. Explore the dashboard</strong><br>Your dashboard gives you an overview of assets, assignments, and upcoming maintenance at a glance.',
        '<strong>2. Add your first device</strong><br>Go to <em>Hardware → New Device</em> and record your first IT asset — serial number, model, purchase date, and more.',
        '<strong>3. Import employees</strong><br>Under <em>Employees</em>, add your team manually or via CSV. Then you can assign devices directly.',
      ],
    },
  },
  {
    key: 'import',
    triggerDay: 3,
    subject: {
      de: 'AssetNode — Geräte schnell importieren',
      en: 'AssetNode — Import your devices quickly',
    },
    heading: {
      de: 'Alle Geräte auf einmal importieren 📦',
      en: 'Import all your devices at once 📦',
    },
    blocks: {
      de: [
        'Sie haben bereits erste Geräte angelegt? Perfekt! Jetzt wird es Zeit, den Rest zu importieren.',
        '<strong>CSV-Import</strong><br>Exportieren Sie Ihre bestehende Geräteliste als CSV-Datei und importieren Sie diese unter <em>Einstellungen → Import</em>. AssetNode erkennt Spalten automatisch.',
        '<strong>MDM-Integration</strong><br>Nutzen Sie Microsoft Intune, Jamf oder Kandji? Verbinden Sie Ihren MDM-Dienst unter <em>Einstellungen → Integrationen</em> — Geräte werden automatisch synchronisiert.',
        '<strong>SCIM-Provisioning</strong><br>Für große Teams: Verbinden Sie Ihren Identity Provider (Azure AD, Okta) per SCIM, um Mitarbeiter automatisch anzulegen und zu aktualisieren.',
      ],
      en: [
        'Already added your first devices? Great — now it\'s time to import the rest.',
        '<strong>CSV import</strong><br>Export your existing device list as a CSV and import it under <em>Settings → Import</em>. AssetNode auto-detects columns.',
        '<strong>MDM integration</strong><br>Using Microsoft Intune, Jamf, or Kandji? Connect your MDM under <em>Settings → Integrations</em> — devices sync automatically.',
        '<strong>SCIM provisioning</strong><br>For larger teams: connect your identity provider (Azure AD, Okta) via SCIM to auto-create and update employees.',
      ],
    },
  },
  {
    key: 'automation',
    triggerDay: 7,
    subject: {
      de: 'AssetNode — Automationen entdecken',
      en: 'AssetNode — Discover automations',
    },
    heading: {
      de: 'Automationen für Ihre Testphase nutzen ⚡',
      en: 'Unlock automations during your trial ⚡',
    },
    blocks: {
      de: [
        'Sie sind jetzt eine Woche dabei! Zeit, die mächtigen Automatisierungen von AssetNode zu entdecken.',
        '<strong>Workflows</strong><br>Unter <em>Automationen → Workflows</em> können Sie Regeln erstellen: z.B. "Wenn ein Gerät zurückgegeben wird, erstelle automatisch einen Wartungsauftrag".',
        '<strong>Benachrichtigungen</strong><br>Konfigurieren Sie unter <em>Einstellungen → Benachrichtigungen</em> Alerts per E-Mail, Slack oder Teams — für Garantieablauf, niedrigen Bestand und mehr.',
        '<strong>Webhooks</strong><br>Verbinden Sie AssetNode mit n8n, Make oder Ihren eigenen Systemen über unsere Webhook-Integration.',
      ],
      en: [
        'You\'ve been on board for a week — time to discover AssetNode\'s powerful automations.',
        '<strong>Workflows</strong><br>Under <em>Automations → Workflows</em>, create rules like: "When a device is returned, automatically open a maintenance ticket."',
        '<strong>Notifications</strong><br>Configure alerts via email, Slack, or Teams under <em>Settings → Notifications</em> — for warranty expiry, low stock, and more.',
        '<strong>Webhooks</strong><br>Connect AssetNode to n8n, Make, or your own systems through our webhook integration.',
      ],
    },
  },
  {
    key: 'upgrade',
    triggerDay: 12,
    subject: {
      de: 'AssetNode — Noch 2 Tage Testphase',
      en: 'AssetNode — 2 days left on your trial',
    },
    heading: {
      de: 'Ihre Testphase endet bald — jetzt upgraden 🚀',
      en: 'Your trial is ending soon — upgrade now 🚀',
    },
    blocks: {
      de: [
        'Ihre Testphase endet in 2 Tagen. Alle Ihre Daten bleiben erhalten — Sie können jederzeit upgraden.',
        '<strong>Was passiert nach Ablauf?</strong><br>Ihr Konto wird automatisch auf den kostenlosen Plan umgestellt. Alle Daten bleiben gespeichert, aber Premium-Funktionen werden eingeschränkt.',
        '<strong>Jetzt upgraden</strong><br>Gehen Sie zu <em>Einstellungen → Abrechnung</em> und wählen Sie Ihren Plan. Die Zahlung erfolgt bequem per SEPA-Überweisung.',
        '<strong>Fragen?</strong><br>Antworten Sie einfach auf diese E-Mail oder nutzen Sie den "Problem melden"-Button in der App. Wir helfen gerne!',
      ],
      en: [
        'Your trial ends in 2 days. All your data is preserved — you can upgrade anytime.',
        '<strong>What happens next?</strong><br>Your account is automatically moved to the free plan. All data stays intact, but premium features become limited.',
        '<strong>Upgrade now</strong><br>Go to <em>Settings → Billing</em> and choose your plan. Payment is via SEPA transfer.',
        '<strong>Questions?</strong><br>Reply to this email or use the "Report issue" button in the app — we\'re happy to help!',
      ],
    },
  },
]


async function sendGuidanceEmail(
  to: string,
  userName: string,
  step: GuidanceStep,
  planName: string,
  daysRemaining: number
): Promise<boolean> {
  const { sendGuidanceStepEmail } = await import('./emailService')
  return sendGuidanceStepEmail(to, userName, step, planName, daysRemaining)
}


export async function processTrialGuidanceEmails(): Promise<number> {
  const now = new Date()
  let sentCount = 0

  const orgs = await Organization.find({
    'billing.status': 'trialing',
    'billing.trialStartedAt': { $exists: true },
  }).lean()

  for (const org of orgs) {
    const billing = (org as any).billing || {}
    const trialStart = new Date(billing.trialStartedAt)
    const daysSinceStart = Math.floor(
      (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null
    const daysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    const alreadySent: string[] = billing.guidanceEmailsSent || []
    const plan = (org as any).plan as PlanKey
    const planDef = PLANS[plan]

    const admin = await User.findOne({
      orgId: org._id,
      role: 'admin',
    }).lean() as any

    if (!admin?.email) continue

    for (const step of GUIDANCE_STEPS) {
      if (alreadySent.includes(step.key)) continue



      const shouldSend = step.key === 'upgrade'
        ? trialEnd !== null && daysRemaining <= 2
        : daysSinceStart >= step.triggerDay

      if (shouldSend) {
        try {
          const success = await sendGuidanceEmail(
            admin.email,
            admin.firstName || 'Nutzer',
            step,
            planDef?.name || plan,
            daysRemaining
          )

          if (success) {
            await Organization.findByIdAndUpdate(org._id, {
              $addToSet: { 'billing.guidanceEmailsSent': step.key },
            })
            sentCount++
            log.info(
              { orgId: String(org._id), step: step.key, daysSinceStart },
              `Guidance email "${step.key}" sent`
            )
          }
        } catch (err) {
          log.error(
            { err, orgId: String(org._id), step: step.key },
            'Failed to send guidance email'
          )
        }
      }
    }
  }

  if (sentCount > 0) {
    log.info({ sentCount }, `Trial guidance: sent ${sentCount} email(s)`)
  }

  return sentCount
}


const GUIDANCE_CRON_INTERVAL = 2 * 60 * 60 * 1000

export function startTrialGuidanceCron(): void {
  setTimeout(() => {
    processTrialGuidanceEmails().catch(err =>
      log.error({ err }, 'Trial guidance cron initial run failed')
    )
  }, 30_000)

  setInterval(() => {
    processTrialGuidanceEmails().catch(err =>
      log.error({ err }, 'Trial guidance cron run failed')
    )
  }, GUIDANCE_CRON_INTERVAL)

  log.info('Trial guidance cron started (every 2h)')
}
