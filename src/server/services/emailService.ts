import * as nodemailer from 'nodemailer'



let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    })
  }
  return transporter
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'AssetNode <noreply@asset-node.com>'
const APP_NAME = 'AssetNode'

function escapeEmailHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}


function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1117">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#161b22;border-radius:12px;border:1px solid #30363d;overflow:hidden">
        <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)">
          <p style="margin:0;color:#34d399;font-size:14px;font-weight:700;letter-spacing:0.5px">${APP_NAME}</p>
        </td></tr>
        <tr><td style="padding:32px;color:#c9d1d9;font-size:15px;line-height:1.7">
          ${content}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #30363d">
          <p style="margin:0;color:#484f58;font-size:12px;line-height:1.5">
            ${APP_NAME} · IT-Asset-Management<br>
            Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}


export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<boolean> {
  const greeting = userName ? `Hallo ${userName},` : 'Hallo,'

  const subject = `${APP_NAME} — Passwort zurücksetzen`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Passwort zurücksetzen</h2>
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px">
      Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.
      Klicken Sie auf den Button, um ein neues Passwort festzulegen:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px">
      <tr><td style="background:#34d399;border-radius:8px;padding:14px 32px">
        <a href="${resetUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Neues Passwort festlegen
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;color:#8b949e;font-size:13px">
      Dieser Link ist <strong style="color:#c9d1d9">1 Stunde</strong> gültig.
    </p>
    <p style="margin:0 0 24px;color:#8b949e;font-size:13px">
      Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
      Ihr Passwort bleibt unverändert.
    </p>
    <p style="margin:0;color:#484f58;font-size:12px;word-break:break-all">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br>
      <a href="${resetUrl}" style="color:#58a6ff;font-size:12px">${resetUrl}</a>
    </p>
  `)

  const text = `${greeting}\n\nSie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\nKlicken Sie auf diesen Link: ${resetUrl}\n\nDieser Link ist 1 Stunde gültig.\n\nWenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.`

  return sendEmail(to, subject, html, text)
}


export async function sendWorkflowApprovalEmail(
  to: string,
  params: { title: string; message: string; approveUrl: string; rejectUrl: string }
): Promise<boolean> {
  const subject = `${APP_NAME} — Freigabe erforderlich: ${params.title}`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Freigabe erforderlich ✋</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">${escapeEmailHtml(params.title)}</p>
    <p style="margin:0 0 24px;color:#8b949e;font-size:14px;line-height:1.6">${escapeEmailHtml(params.message).replace(/\n/g, '<br>')}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px">
      <tr>
        <td style="background:#34d399;border-radius:8px;padding:12px 28px">
          <a href="${params.approveUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">Genehmigen</a>
        </td>
        <td style="width:12px"></td>
        <td style="background:#f85149;border-radius:8px;padding:12px 28px">
          <a href="${params.rejectUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">Ablehnen</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#484f58;font-size:12px">
      Diese Freigabe-Links sind einmalig gültig. Der Workflow läuft nach Ihrer Entscheidung automatisch weiter.
    </p>
  `)

  const text = [
    `Freigabe erforderlich: ${params.title}`,
    '',
    params.message,
    '',
    `Genehmigen: ${params.approveUrl}`,
    `Ablehnen: ${params.rejectUrl}`,
  ].join('\n')

  return sendEmail(to, subject, html, text)
}

export async function sendWelcomeEmail(
  to: string,
  userName: string,
  loginUrl?: string
): Promise<boolean> {
  const url = loginUrl || process.env.APP_URL || 'https://app.asset-node.com/sign-in'

  const subject = `Willkommen bei ${APP_NAME}!`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Willkommen bei ${APP_NAME}!</h2>
    <p style="margin:0 0 16px">Hallo ${userName},</p>
    <p style="margin:0 0 24px">
      Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt anmelden und
      mit der Verwaltung Ihrer IT-Assets beginnen.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px">
      <tr><td style="background:#34d399;border-radius:8px;padding:14px 32px">
        <a href="${url}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Jetzt anmelden
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Bei Fragen können Sie sich jederzeit an unser Support-Team wenden.
    </p>
  `)

  const text = `Hallo ${userName},\n\nIhr ${APP_NAME}-Konto wurde erfolgreich erstellt.\n\nJetzt anmelden: ${url}`

  return sendEmail(to, subject, html, text)
}


export async function sendTrialStartedEmail(
  to: string,
  userName: string,
  planName: string,
  trialDays: number
): Promise<boolean> {
  const subject = `${APP_NAME} — Ihre ${planName}-Testphase hat begonnen`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Testphase gestartet 🚀</h2>
    <p style="margin:0 0 16px">Hallo ${userName},</p>
    <p style="margin:0 0 24px">
      Ihre <strong style="color:#34d399">${planName}</strong>-Testphase ist jetzt aktiv.
      Sie haben <strong style="color:#c9d1d9">${trialDays} Tage</strong>, um alle Premium-Funktionen kostenlos zu testen.
    </p>
    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 24px">
      <p style="margin:0;color:#8b949e;font-size:13px">Was ist enthalten:</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#c9d1d9;font-size:14px;line-height:1.8">
        <li>Alle ${planName}-Features freigeschaltet</li>
        <li>Erweiterte Asset- und Nutzerlimits</li>
        <li>Keine Kreditkarte erforderlich</li>
      </ul>
    </div>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Nach Ablauf der Testphase können Sie jederzeit upgraden oder zum kostenlosen Plan zurückkehren.
    </p>
  `)

  const text = `Hallo ${userName},\n\nIhre ${planName}-Testphase ist jetzt aktiv. Sie haben ${trialDays} Tage, um alle Premium-Funktionen kostenlos zu testen.\n\nNach Ablauf können Sie jederzeit upgraden oder zum kostenlosen Plan zurückkehren.`

  return sendEmail(to, subject, html, text)
}


export async function sendPlanChangedEmail(
  to: string,
  userName: string,
  newPlanName: string,
  price: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Plan geändert zu ${newPlanName}`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Plan aktualisiert</h2>
    <p style="margin:0 0 16px">Hallo ${userName},</p>
    <p style="margin:0 0 24px">
      Ihr Plan wurde erfolgreich auf <strong style="color:#34d399">${newPlanName}</strong> geändert.
    </p>
    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 24px">
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:4px 0">Neuer Plan</td>
          <td style="color:#c9d1d9;font-size:13px;padding:4px 0;text-align:right;font-weight:700">${newPlanName}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:4px 0">Monatlicher Preis</td>
          <td style="color:#34d399;font-size:13px;padding:4px 0;text-align:right;font-weight:700">${price}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Sie können Ihren Plan jederzeit unter Einstellungen → Abrechnung verwalten.
    </p>
  `)

  const text = `Hallo ${userName},\n\nIhr Plan wurde erfolgreich auf ${newPlanName} (${price}/Monat) geändert.\n\nSie können Ihren Plan jederzeit unter Einstellungen → Abrechnung verwalten.`

  return sendEmail(to, subject, html, text)
}


export async function sendSubscriptionCanceledEmail(
  to: string,
  userName: string,
  planName: string,
  endDate: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Abo gekündigt`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Abonnement gekündigt</h2>
    <p style="margin:0 0 16px">Hallo ${userName},</p>
    <p style="margin:0 0 24px">
      Ihr <strong style="color:#c9d1d9">${planName}</strong>-Abonnement wurde gekündigt.
      Sie haben weiterhin Zugriff bis zum <strong style="color:#c9d1d9">${endDate}</strong>.
    </p>
    <p style="margin:0 0 24px;color:#8b949e;font-size:14px">
      Nach diesem Datum wird Ihr Konto automatisch auf den kostenlosen Plan umgestellt.
      Ihre Daten bleiben erhalten — Sie können jederzeit wieder upgraden.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px">
      <tr><td style="background:#34d399;border-radius:8px;padding:14px 32px">
        <a href="${process.env.APP_URL || 'https://app.asset-node.com'}/billing" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Abo reaktivieren
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Fragen? Antworten Sie einfach auf diese E-Mail.
    </p>
  `)

  const text = `Hallo ${userName},\n\nIhr ${planName}-Abonnement wurde gekündigt. Sie haben weiterhin Zugriff bis zum ${endDate}.\n\nNach diesem Datum wird Ihr Konto auf den kostenlosen Plan umgestellt. Sie können jederzeit wieder upgraden.`

  return sendEmail(to, subject, html, text)
}


interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType?: string
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  const smtp = getTransporter()

  if (!smtp) {
    console.log(`\n📧 EMAIL (dev mode — no SMTP configured):`)
    console.log(`   To:      ${to}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Text:    ${text.substring(0, 200)}…`)
    if (attachments?.length) {
      console.log(`   📎 Attachments: ${attachments.map(a => `${a.filename} (${typeof a.content === 'string' ? a.content.length : a.content.length} bytes)`).join(', ')}`)
    }
    console.log(``)
    return true
  }

  try {
    await smtp.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType
      }))
    })
    return true
  } catch (err) {
    console.error(`[EmailService] Failed to send "${subject}" to ${to}:`, err)
    return false
  }
}


export async function sendInvoiceEmail(
  to: string,
  firstName: string,
  planName: string,
  amountEur: string,
  periodLabel: string,
  downloadUrl?: string
): Promise<boolean> {
  const downloadBlock = downloadUrl
    ? `<tr><td style="padding:0 32px 24px">
        <a href="${downloadUrl}" style="display:inline-block;padding:12px 24px;background:#34d399;color:#0d1117;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          PDF herunterladen
        </a>
      </td></tr>`
    : ''

  const subject = `Ihre ${APP_NAME} Rechnung — ${planName} ${periodLabel}`
  const html = wrapHtml(`
    <tr><td style="padding:32px 32px 8px">
      <h2 style="margin:0;color:#e6edf3;font-size:20px">Neue Rechnung</h2>
    </td></tr>
    <tr><td style="padding:8px 32px 24px;color:#8b949e;font-size:15px;line-height:1.6">
      Hallo ${firstName},<br><br>
      wir haben eine neue Rechnung für Ihr <strong style="color:#e6edf3">${APP_NAME} ${planName}</strong> Abonnement erstellt.
    </td></tr>
    <tr><td style="padding:0 32px 24px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1117;border-radius:8px;border:1px solid #30363d">
        <tr>
          <td style="padding:16px 20px;color:#8b949e;font-size:14px">Plan</td>
          <td style="padding:16px 20px;color:#e6edf3;font-size:14px;text-align:right;font-weight:600">${planName} (${periodLabel})</td>
        </tr>
        <tr>
          <td style="padding:16px 20px;color:#8b949e;font-size:14px;border-top:1px solid #30363d">Betrag</td>
          <td style="padding:16px 20px;color:#34d399;font-size:18px;text-align:right;font-weight:700;border-top:1px solid #30363d">${amountEur} €</td>
        </tr>
        <tr>
          <td style="padding:16px 20px;color:#8b949e;font-size:14px;border-top:1px solid #30363d">Zahlung</td>
          <td style="padding:16px 20px;color:#e6edf3;font-size:14px;text-align:right;border-top:1px solid #30363d">SEPA-Überweisung</td>
        </tr>
      </table>
    </td></tr>
    ${downloadBlock}
    <tr><td style="padding:0 32px 32px;color:#8b949e;font-size:13px;line-height:1.5">
      Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf das in der Rechnung angegebene Konto.<br>
      Bei Fragen antworten Sie einfach auf diese E-Mail.
    </td></tr>
  `)

  const text = `Hallo ${firstName}, wir haben eine neue Rechnung für Ihr ${APP_NAME} ${planName} Abonnement über ${amountEur} € erstellt. Bitte überweisen Sie innerhalb von 14 Tagen.${downloadUrl ? ` PDF: ${downloadUrl}` : ''}`

  return sendEmail(to, subject, html, text)
}


export interface BuybackEmailAsset {
  model: string
  serialNumber?: string
  category: string
  condition: string
  purchasePrice?: number
  purchaseDate?: string | Date
  estimatedValue: number
}

export interface BuybackEmailData {
  partnerName: string
  partnerEmail: string
  orgName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
  assets: BuybackEmailAsset[]
  totalEstimatedValue: number
  quoteRef: string
}

function generateAssetCsv(assets: BuybackEmailAsset[]): string {
  const BOM = '\uFEFF'
  const header = 'Modell;Seriennummer;Kategorie;Zustand;Kaufpreis (EUR);Kaufdatum;Schaetzwert (EUR)'
  const rows = assets.map(a => {
    const purchaseDate = a.purchaseDate
      ? new Date(a.purchaseDate).toLocaleDateString('de-DE')
      : ''
    return [
      `"${(a.model || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      `"${a.category}"`,
      a.condition,
      a.purchasePrice?.toFixed(2) || '',
      purchaseDate,
      a.estimatedValue.toFixed(2)
    ].join(';')
  })

  const totalRow = `;;;;;;${assets.reduce((s, a) => s + a.estimatedValue, 0).toFixed(2)}`
  const summaryLabel = ';;;;;"GESAMT";'

  return BOM + [header, ...rows, '', summaryLabel, totalRow].join('\n')
}

export async function sendBuybackQuoteToPartner(
  data: BuybackEmailData
): Promise<boolean> {
  const { partnerName, partnerEmail, orgName, contactName, contactEmail, contactPhone, notes, assets, totalEstimatedValue, quoteRef } = data
  const assetCount = assets.length
  const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const contactBlock = [
    contactName ? `Ansprechpartner: ${contactName}` : null,
    contactEmail ? `E-Mail: ${contactEmail}` : null,
    contactPhone ? `Telefon: ${contactPhone}` : null
  ].filter(Boolean).join(' | ')

  const catCounts: Record<string, number> = {}
  assets.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1 })
  const catSummary = Object.entries(catCounts).map(([k, v]) => `${v}× ${k}`).join(', ')

  const subject = `Ankaufsanfrage — ${orgName} — ${assetCount} Geräte (Ref: ${quoteRef})`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Ankaufsanfrage</h2>
    <p style="margin:0 0 16px">Sehr geehrtes Team von ${partnerName},</p>
    <p style="margin:0 0 20px">
      das Unternehmen <strong style="color:#e6edf3">${orgName}</strong> möchte
      <strong style="color:#34d399">${assetCount} Geräte</strong> zur Verwertung anbieten.
    </p>

    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 20px">
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Referenz</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right;font-weight:700">${quoteRef}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Anzahl Geräte</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right;font-weight:700">${assetCount}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Kategorien</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right">${catSummary}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Geschätzter Gesamtwert</td>
          <td style="color:#34d399;font-size:15px;padding:6px 0;text-align:right;font-weight:700">€${totalEstimatedValue.toLocaleString('de-DE')}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Datum</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right">${dateStr}</td>
        </tr>
      </table>
    </div>

    ${contactBlock ? `<p style="margin:0 0 12px;color:#c9d1d9;font-size:13px">${contactBlock}</p>` : ''}
    ${notes ? `<p style="margin:0 0 20px;color:#8b949e;font-size:13px;font-style:italic">Anmerkung: ${notes}</p>` : ''}

    <p style="margin:0 0 8px;color:#c9d1d9;font-size:14px">
      Die detaillierte Geräteliste finden Sie als <strong>CSV-Anhang</strong> (kompatibel mit Excel).
    </p>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Bitte senden Sie Ihr Angebot an die oben genannte Kontaktadresse.
      Diese Anfrage wurde automatisch über ${APP_NAME} erstellt.
    </p>
  `)

  const text = [
    `Ankaufsanfrage — ${orgName}`,
    ``,
    `Sehr geehrtes Team von ${partnerName},`,
    ``,
    `${orgName} möchte ${assetCount} Geräte zur Verwertung anbieten.`,
    ``,
    `Referenz: ${quoteRef}`,
    `Geräte: ${assetCount} (${catSummary})`,
    `Geschätzter Gesamtwert: €${totalEstimatedValue.toLocaleString('de-DE')}`,
    `Datum: ${dateStr}`,
    contactBlock ? `\nKontakt: ${contactBlock}` : '',
    notes ? `Anmerkung: ${notes}` : '',
    ``,
    `Die Geräteliste ist als CSV-Anhang beigefügt.`,
    `Bitte senden Sie Ihr Angebot an die genannte Kontaktadresse.`,
    ``,
    `— Automatisch erstellt über ${APP_NAME}`
  ].filter(l => l !== undefined).join('\n')

  const csv = generateAssetCsv(assets)
  const csvFilename = `AssetNode_Ankaufsanfrage_${quoteRef}_${dateStr.replace(/\./g, '-')}.csv`

  return sendEmail(partnerEmail, subject, html, text, [
    { filename: csvFilename, content: csv, contentType: 'text/csv; charset=utf-8' }
  ])
}

export async function sendBuybackConfirmationEmail(
  to: string,
  userName: string,
  data: Pick<BuybackEmailData, 'partnerName' | 'assets' | 'totalEstimatedValue' | 'quoteRef'>
): Promise<boolean> {
  const { partnerName, assets, totalEstimatedValue, quoteRef } = data

  const subject = `${APP_NAME} — Ankaufsanfrage ${quoteRef} an ${partnerName} gesendet`

  const assetLines = assets.slice(0, 5).map(a =>
    `<tr><td style="padding:4px 8px;color:#c9d1d9;font-size:13px">${a.model}</td>` +
    `<td style="padding:4px 8px;color:#8b949e;font-size:13px">${a.category}</td>` +
    `<td style="padding:4px 8px;color:#34d399;font-size:13px;text-align:right;font-weight:600">€${a.estimatedValue.toLocaleString('de-DE')}</td></tr>`
  ).join('')
  const moreCount = assets.length - 5
  const moreRow = moreCount > 0
    ? `<tr><td colspan="3" style="padding:4px 8px;color:#8b949e;font-size:12px">… und ${moreCount} weitere Geräte</td></tr>`
    : ''

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Ankaufsanfrage gesendet ✉️</h2>
    <p style="margin:0 0 16px">Hallo ${userName},</p>
    <p style="margin:0 0 20px">
      Ihre Ankaufsanfrage wurde erfolgreich an
      <strong style="color:#34d399">${partnerName}</strong> gesendet.
    </p>

    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 20px">
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Referenz</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right;font-weight:700">${quoteRef}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Partner</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right">${partnerName}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Geräte</td>
          <td style="color:#e6edf3;font-size:13px;padding:6px 0;text-align:right">${assets.length}</td>
        </tr>
        <tr>
          <td style="color:#8b949e;font-size:13px;padding:6px 0">Geschätzter Wert</td>
          <td style="color:#34d399;font-size:15px;padding:6px 0;text-align:right;font-weight:700">€${totalEstimatedValue.toLocaleString('de-DE')}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;color:#8b949e;font-size:12px">Enthaltene Geräte:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 20px">
      ${assetLines}
      ${moreRow}
      <tr style="border-top:1px solid #30363d">
        <td colspan="2" style="padding:8px 8px 4px;color:#8b949e;font-size:13px;font-weight:600">Gesamt</td>
        <td style="padding:8px 8px 4px;color:#34d399;font-size:15px;text-align:right;font-weight:700">€${totalEstimatedValue.toLocaleString('de-DE')}</td>
      </tr>
    </table>

    <p style="margin:0 0 12px;color:#c9d1d9;font-size:14px">
      <strong>Nächste Schritte:</strong>
    </p>
    <ol style="margin:0 0 20px;padding-left:20px;color:#c9d1d9;font-size:13px;line-height:1.8">
      <li>${partnerName} prüft Ihre Anfrage und erstellt ein verbindliches Angebot</li>
      <li>Sie erhalten das Angebot per E-Mail (in der Regel innerhalb von 1–3 Werktagen)</li>
      <li>Nach Annahme organisiert der Partner Abholung und zertifizierte Datenlöschung</li>
    </ol>

    <p style="margin:0;color:#8b949e;font-size:13px">
      Den Status Ihrer Anfrage können Sie jederzeit im
      <a href="${process.env.APP_URL || 'https://app.asset-node.com'}/marketplace" style="color:#58a6ff">Marktplatz</a>
      einsehen.
    </p>
  `)

  const text = [
    `Hallo ${userName},`,
    ``,
    `Ihre Ankaufsanfrage (${quoteRef}) wurde an ${partnerName} gesendet.`,
    ``,
    `${assets.length} Geräte — Geschätzter Gesamtwert: €${totalEstimatedValue.toLocaleString('de-DE')}`,
    ``,
    `Nächste Schritte:`,
    `1. ${partnerName} prüft Ihre Anfrage`,
    `2. Sie erhalten ein Angebot per E-Mail (1–3 Werktage)`,
    `3. Nach Annahme: Abholung + zertifizierte Datenlöschung`,
    ``,
    `Status einsehen: ${process.env.APP_URL || 'https://app.asset-node.com'}/marketplace`
  ].join('\n')

  return sendEmail(to, subject, html, text)
}


export interface GuidanceEmailStep {
  subject: { de: string; en: string }
  heading: { de: string; en: string }
  blocks: { de: string[]; en: string[] }
}

export async function sendGuidanceStepEmail(
  to: string,
  userName: string,
  step: GuidanceEmailStep,
  planName: string,
  daysRemaining: number
): Promise<boolean> {
  const subject = `${step.subject.de} / ${step.subject.en}`

  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'
  const daysLine = daysRemaining > 0
    ? `<p style="margin:0 0 8px;color:#8b949e;font-size:12px">${APP_NAME} ${planName} · Noch ${daysRemaining} Tag${daysRemaining === 1 ? '' : 'e'} / ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left</p>`
    : ''

  const renderBlocks = (blocks: string[]) =>
    blocks.map(b => `<p style="margin:0 0 14px;color:#c9d1d9;font-size:14px;line-height:1.6">${b}</p>`).join('')

  const de = `
    ${daysLine}
    <h2 style="margin:0 0 14px;color:#e6edf3;font-size:22px;font-weight:700">${step.heading.de}</h2>
    <p style="margin:0 0 14px;color:#c9d1d9">Hallo ${userName},</p>
    ${renderBlocks(step.blocks.de)}
    <p style="margin:16px 0 0;color:#8b949e;font-size:12px">
      <a href="${appUrl}" style="color:#58a6ff">App öffnen</a>
    </p>
  `

  const en = `
    <h3 style="margin:0 0 12px;color:#c9d1d9;font-size:18px;font-weight:600">${step.heading.en}</h3>
    <p style="margin:0 0 12px">Hello ${userName},</p>
    ${renderBlocks(step.blocks.en)}
    <p style="margin:16px 0 0;color:#8b949e;font-size:12px">
      <a href="${appUrl}" style="color:#58a6ff">Open app</a>
    </p>
  `

  const html = wrapHtml(bilingualBlock(de, en))

  const text = [
    `Hallo ${userName},`,
    step.heading.de,
    ...step.blocks.de.map(b => b.replace(/<[^>]+>/g, '')),
    ``,
    `Hello ${userName},`,
    step.heading.en,
    ...step.blocks.en.map(b => b.replace(/<[^>]+>/g, '')),
  ].join('\n')

  return sendEmail(to, subject, html, text)
}


function bilingualBlock(de: string, en: string): string {
  return `
    <div style="margin:0 0 20px">${de}</div>
    <div style="margin:20px 0;border-top:1px solid #30363d"></div>
    <div style="margin:0 0 20px;color:#8b949e;font-size:14px">${en}</div>
  `
}


export async function sendSupportTicketConfirmation(
  to: string,
  userName: string,
  ticketRef: string,
  subject: string
): Promise<boolean> {
  const mailSubject = `${APP_NAME} — Support-Ticket ${ticketRef} erhalten / received`

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Support-Ticket erhalten ✉️</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 12px;color:#c9d1d9">
      vielen Dank für Ihre Meldung. Ihr Ticket
      <strong style="color:#34d399">${ticketRef}</strong> wurde erfolgreich erfasst
      und zur sicheren Zustellung an unser Support-Team vorgemerkt.
    </p>
    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin:0 0 12px">
      <p style="margin:0 0 4px;color:#8b949e;font-size:12px">Betreff</p>
      <p style="margin:0;color:#e6edf3;font-size:14px">${subject}</p>
    </div>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Sie erhalten eine Antwort an diese E-Mail-Adresse, sobald wir Ihr Anliegen bearbeitet haben.
    </p>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Support ticket received</h3>
    <p style="margin:0 0 10px">Hello ${userName},</p>
    <p style="margin:0 0 10px">
      Thanks for reaching out. Your ticket <strong>${ticketRef}</strong>
      has been recorded and queued for reliable delivery to our support team.
    </p>
    <p style="margin:0">
      We'll reply to this email address once we've had a look.
    </p>
  `

  const html = wrapHtml(bilingualBlock(de, en))
  const text = [
    `Hallo ${userName},`,
    `Ihr Support-Ticket ${ticketRef} ist eingegangen. Betreff: ${subject}`,
    ``,
    `Hello ${userName},`,
    `Your support ticket ${ticketRef} has been received. Subject: ${subject}`,
  ].join('\n')

  return sendEmail(to, mailSubject, html, text)
}


export interface SupportTicketNotificationData {
  ticketRef: string
  subject: string
  description: string
  category: string
  priority: string
  userName: string
  userEmail: string
  orgName: string
}

export function resolveMaintainerEmail(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.MAINTAINER_EMAIL?.trim()
  if (explicit) return explicit

  const smtpUser = env.SMTP_USER?.trim()
  if (smtpUser?.includes('@')) return smtpUser

  const from = env.SMTP_FROM?.trim()
  if (!from) return undefined
  const bracketAddress = from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]
  if (bracketAddress) return bracketAddress
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) ? from : undefined
}

export async function sendSupportTicketNotification(
  data: SupportTicketNotificationData
): Promise<boolean> {
  const to = resolveMaintainerEmail()
  if (!to) return false

  const mailSubject = `[${APP_NAME}] ${data.priority.toUpperCase()} · Ticket ${data.ticketRef} · ${data.subject}`

  const rows = [
    ['Ticket', data.ticketRef],
    ['Org', data.orgName],
    ['User', `${data.userName} <${data.userEmail}>`],
    ['Kategorie / Category', data.category],
    ['Priorität / Priority', data.priority],
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#8b949e;font-size:13px;white-space:nowrap">${k}</td><td style="padding:6px 0;color:#c9d1d9;font-size:13px">${v}</td></tr>`
  ).join('')

  const escapedDescription = data.description
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  const html = wrapHtml(`
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:20px;font-weight:700">Support-Ticket ${data.ticketRef}</h2>
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px">Fallback-Benachrichtigung / Fallback notification</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 16px">${rows}</table>
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px">
      <p style="margin:0 0 6px;color:#8b949e;font-size:12px">${data.subject}</p>
      <p style="margin:0;color:#c9d1d9;font-size:13px;line-height:1.5">${escapedDescription}</p>
    </div>
  `)

  const text = [
    `Ticket ${data.ticketRef} — ${data.subject}`,
    `Org: ${data.orgName}`,
    `User: ${data.userName} <${data.userEmail}>`,
    `Category: ${data.category}  Priority: ${data.priority}`,
    ``,
    data.description,
  ].join('\n')

  return sendEmail(to, mailSubject, html, text)
}


export async function sendTrialExpiringEmail(
  to: string,
  userName: string,
  planName: string,
  daysRemaining: number
): Promise<boolean> {
  const subject = `${APP_NAME} — Testphase läuft bald ab / Trial ending soon (${daysRemaining} ${daysRemaining === 1 ? 'Tag/day' : 'Tage/days'})`

  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'
  const billingUrl = `${appUrl}/billing`

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Ihre Testphase endet in ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tagen'} ⏳</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      Ihre <strong style="color:#34d399">${planName}</strong>-Testphase endet bald.
      Danach wird Ihr Konto automatisch auf den kostenlosen Plan umgestellt.
      Ihre Daten bleiben vollständig erhalten.
    </p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      Möchten Sie weiter von allen Premium-Funktionen profitieren?
      Upgraden Sie jetzt unter <em>Einstellungen → Abrechnung</em>.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${billingUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Jetzt upgraden
        </a>
      </td></tr>
    </table>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Your trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}</h3>
    <p style="margin:0 0 12px">Hello ${userName},</p>
    <p style="margin:0 0 12px">
      Your <strong style="color:#34d399">${planName}</strong> trial is ending soon.
      Your account will automatically switch to the free plan — all your data stays intact.
    </p>
    <p style="margin:0 0 12px">
      Want to keep all premium features? Upgrade now in <em>Settings → Billing</em>.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${billingUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Upgrade now
        </a>
      </td></tr>
    </table>
  `

  const html = wrapHtml(bilingualBlock(de, en))

  const text = [
    `Hallo ${userName},`,
    `Ihre ${planName}-Testphase endet in ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tagen'}. Upgraden unter: ${billingUrl}`,
    ``,
    `Hello ${userName},`,
    `Your ${planName} trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Upgrade: ${billingUrl}`,
  ].join('\n')

  return sendEmail(to, subject, html, text)
}


export async function sendTrialExpiredEmail(
  to: string,
  userName: string,
  planName: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Testphase beendet / Trial ended`

  const appUrl = process.env.APP_URL || 'https://app.asset-node.com'
  const billingUrl = `${appUrl}/billing`

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Ihre Testphase ist beendet</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      Ihre <strong style="color:#c9d1d9">${planName}</strong>-Testphase ist abgelaufen.
      Ihr Konto wurde automatisch auf den kostenlosen Plan umgestellt —
      alle Ihre Daten bleiben erhalten.
    </p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      Sie können jederzeit auf einen kostenpflichtigen Plan upgraden und
      die Premium-Funktionen wieder freischalten.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${billingUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Plan auswählen
        </a>
      </td></tr>
    </table>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Your trial has ended</h3>
    <p style="margin:0 0 12px">Hello ${userName},</p>
    <p style="margin:0 0 12px">
      Your <strong>${planName}</strong> trial has expired and your account has been moved to the free plan.
      All your data is preserved.
    </p>
    <p style="margin:0 0 12px">
      You can upgrade to a paid plan anytime to unlock premium features again.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${billingUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Choose a plan
        </a>
      </td></tr>
    </table>
  `

  const html = wrapHtml(bilingualBlock(de, en))

  const text = [
    `Hallo ${userName},`,
    `Ihre ${planName}-Testphase ist beendet. Konto auf Free-Plan umgestellt. Upgrade: ${billingUrl}`,
    ``,
    `Hello ${userName},`,
    `Your ${planName} trial ended. Account moved to free plan. Upgrade: ${billingUrl}`,
  ].join('\n')

  return sendEmail(to, subject, html, text)
}


export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName?: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Einladung zu ${orgName}`

  const inviterLine = inviterName
    ? `<p style="margin:0 0 16px">${inviterName} hat Sie eingeladen, der Organisation <strong>${orgName}</strong> beizutreten.</p>`
    : `<p style="margin:0 0 16px">Sie wurden eingeladen, der Organisation <strong>${orgName}</strong> beizutreten.</p>`

  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:700">Einladung zu ${APP_NAME}</h2>
    <p style="margin:0 0 16px">Hallo,</p>
    ${inviterLine}
    <p style="margin:0 0 24px">
      Klicken Sie auf den Button, um Ihr Konto zu erstellen und dem Team beizutreten:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px">
      <tr><td style="background:#34d399;border-radius:8px;padding:14px 32px">
        <a href="${inviteUrl}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Einladung annehmen
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;color:#8b949e;font-size:13px">
      Dieser Link ist <strong>7 Tage</strong> gültig.
    </p>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br>
      <a href="${inviteUrl}" style="color:#58a6ff;word-break:break-all">${inviteUrl}</a>
    </p>
  `)

  const text = [
    `Hallo,`,
    ``,
    inviterName
      ? `${inviterName} hat Sie eingeladen, der Organisation "${orgName}" auf ${APP_NAME} beizutreten.`
      : `Sie wurden eingeladen, der Organisation "${orgName}" auf ${APP_NAME} beizutreten.`,
    ``,
    `Einladung annehmen: ${inviteUrl}`,
    ``,
    `Dieser Link ist 7 Tage gültig.`
  ].join('\n')

  return sendEmail(to, subject, html, text)
}


export async function sendReturnReminderEmail(
  to: string,
  userName: string,
  assetName: string,
  expectedReturnDate: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Erinnerung: Hardware-Rückgabe / Hardware return reminder`

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Erinnerung: Hardware-Rückgabe</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      bitte denken Sie daran, das folgende Gerät bis zum <strong>${expectedReturnDate}</strong> zurückzugeben:
    </p>
    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin:0 0 12px">
      <p style="margin:0;color:#34d399;font-size:14px;font-weight:600">${assetName}</p>
    </div>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Bei Fragen oder Problemen wenden Sie sich bitte an Ihre IT-Abteilung.
    </p>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Hardware return reminder</h3>
    <p style="margin:0 0 10px">Hello ${userName},</p>
    <p style="margin:0 0 10px">
      Please remember to return the following device by <strong>${expectedReturnDate}</strong>:
    </p>
    <div style="background:#1c2333;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin:0 0 12px">
      <p style="margin:0;color:#34d399;font-size:14px;font-weight:600">${assetName}</p>
    </div>
    <p style="margin:0;color:#8b949e;font-size:13px">
      If you have any questions or issues, please contact your IT department.
    </p>
  `

  const html = wrapHtml(bilingualBlock(de, en))
  const text = [
    `Hallo ${userName},`,
    `Erinnerung: Bitte geben Sie "${assetName}" bis zum ${expectedReturnDate} zurück.`,
    ``,
    `Hello ${userName},`,
    `Reminder: Please return "${assetName}" by ${expectedReturnDate}.`
  ].join('\n')

  return sendEmail(to, subject, html, text)
}

export async function sendOnboardingEmail(
  to: string,
  userName: string,
  startDate: string,
  orgName: string,
  assignedAssets?: { name: string, type: string }[]
): Promise<boolean> {
  const subject = `${APP_NAME} — Willkommen bei ${orgName} / Welcome to ${orgName}`

  let assetsHtmlDe = ''
  let assetsHtmlEn = ''

  if (assignedAssets && assignedAssets.length > 0) {
    const listItems = assignedAssets.map(a => `<li>${a.name}</li>`).join('')
    assetsHtmlDe = `
    <p style="margin:0 0 8px;color:#c9d1d9">Folgende Ausstattung wurde für Sie vorbereitet:</p>
    <ul style="margin:0 0 16px;color:#c9d1d9;padding-left:20px;">
      ${listItems}
    </ul>`
    assetsHtmlEn = `
    <p style="margin:0 0 8px;color:#c9d1d9">The following equipment has been prepared for you:</p>
    <ul style="margin:0 0 16px;color:#c9d1d9;padding-left:20px;">
      ${listItems}
    </ul>`
  }

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Willkommen an Bord! 🚀</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      wir freuen uns, Sie ab dem <strong>${startDate}</strong> bei <strong>${orgName}</strong> begrüßen zu dürfen.
    </p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      Ihre IT-Ausstattung wird derzeit für Sie vorbereitet und pünktlich zu Ihrem Start zur Verfügung gestellt.
    </p>
    ${assetsHtmlDe}
    <p style="margin:0;color:#8b949e;font-size:13px">
      Ihre IT-Abteilung
    </p>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Welcome aboard! 🚀</h3>
    <p style="margin:0 0 10px">Hello ${userName},</p>
    <p style="margin:0 0 10px">
      We are excited to welcome you to <strong>${orgName}</strong> starting <strong>${startDate}</strong>.
    </p>
    <p style="margin:0 0 10px">
      Your IT equipment is currently being prepared and will be ready for you on your first day.
    </p>
    ${assetsHtmlEn}
    <p style="margin:0;color:#8b949e;font-size:13px">
      Your IT Department
    </p>
  `

  const html = wrapHtml(bilingualBlock(de, en))
  const text = [
    `Hallo ${userName},`,
    `Willkommen bei ${orgName}! Ihr Startdatum ist der ${startDate}. Ihre IT-Ausstattung wird vorbereitet.`,
    assignedAssets?.length ? `Ausstattung:\n${assignedAssets.map(a => '- ' + a.name).join('\n')}` : '',
    ``,
    `Hello ${userName},`,
    `Welcome to ${orgName}! Your start date is ${startDate}. Your IT equipment is being prepared.`,
    assignedAssets?.length ? `Equipment:\n${assignedAssets.map(a => '- ' + a.name).join('\n')}` : ''
  ].filter(Boolean).join('\n')

  return sendEmail(to, subject, html, text)
}

export async function sendAssetAuditEmail(
  to: string,
  userName: string,
  magicLink: string
): Promise<boolean> {
  const subject = `${APP_NAME} — Hardware Check-in / Hardware Check-in`

  const de = `
    <h2 style="margin:0 0 12px;color:#e6edf3;font-size:22px;font-weight:700">Hardware Check-in 🛡️</h2>
    <p style="margin:0 0 12px;color:#c9d1d9">Hallo ${userName},</p>
    <p style="margin:0 0 16px;color:#c9d1d9">
      es ist Zeit für Ihren regelmäßigen Hardware Check-in. Bitte bestätigen Sie, dass Sie die Ihnen zugewiesenen Geräte noch besitzen und diese in gutem Zustand sind.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${magicLink}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Hardware bestätigen
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#8b949e;font-size:13px">
      Dieser Link ist 7 Tage gültig.
    </p>
  `

  const en = `
    <h3 style="margin:0 0 10px;color:#c9d1d9;font-size:18px;font-weight:600">Hardware Check-in 🛡️</h3>
    <p style="margin:0 0 10px">Hello ${userName},</p>
    <p style="margin:0 0 10px">
      It is time for your periodic hardware check-in. Please confirm that you still have your assigned devices and that they are in good condition.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px">
      <tr><td style="background:#34d399;border-radius:8px;padding:12px 28px">
        <a href="${magicLink}" style="color:#0d1117;text-decoration:none;font-weight:700;font-size:15px">
          Confirm Hardware
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#8b949e;font-size:13px">
      This link is valid for 7 days.
    </p>
  `

  const html = wrapHtml(bilingualBlock(de, en))
  const text = [
    `Hallo ${userName},`,
    `Bitte bestätigen Sie Ihre Hardware: ${magicLink}`,
    ``,
    `Hello ${userName},`,
    `Please confirm your hardware: ${magicLink}`
  ].join('\n')

  return sendEmail(to, subject, html, text)
}
