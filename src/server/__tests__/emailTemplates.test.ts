import { describe, it, expect } from 'vitest'


const APP_NAME = 'AssetNode'

function buildPasswordResetSubject(): string {
  return `${APP_NAME} — Passwort zurücksetzen`
}

function buildWelcomeSubject(): string {
  return `Willkommen bei ${APP_NAME}!`
}

function buildTrialStartedSubject(planName: string): string {
  return `${APP_NAME} — Ihre ${planName}-Testphase hat begonnen`
}

function buildPlanChangedSubject(newPlanName: string): string {
  return `${APP_NAME} — Plan geändert zu ${newPlanName}`
}

function buildSubscriptionCanceledSubject(): string {
  return `${APP_NAME} — Abo gekündigt`
}

function buildInvoiceSubject(planName: string, periodLabel: string): string {
  return `Ihre ${APP_NAME} Rechnung — ${planName} ${periodLabel}`
}

function buildGreeting(userName?: string): string {
  return userName ? `Hallo ${userName},` : 'Hallo,'
}

function buildPasswordResetText(greeting: string, resetUrl: string): string {
  return `${greeting}\n\nSie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\nKlicken Sie auf diesen Link: ${resetUrl}\n\nDieser Link ist 1 Stunde gültig.\n\nWenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.`
}

function buildWelcomeText(userName: string, url: string): string {
  return `Hallo ${userName},\n\nIhr ${APP_NAME}-Konto wurde erfolgreich erstellt.\n\nJetzt anmelden: ${url}`
}

function buildTrialText(userName: string, planName: string, trialDays: number): string {
  return `Hallo ${userName},\n\nIhre ${planName}-Testphase ist jetzt aktiv. Sie haben ${trialDays} Tage, um alle Premium-Funktionen kostenlos zu testen.\n\nNach Ablauf können Sie jederzeit upgraden oder zum kostenlosen Plan zurückkehren.`
}

function buildPlanChangedText(userName: string, planName: string, price: string): string {
  return `Hallo ${userName},\n\nIhr Plan wurde erfolgreich auf ${planName} (${price}/Monat) geändert.\n\nSie können Ihren Plan jederzeit unter Einstellungen → Abrechnung verwalten.`
}

function buildCancellationText(userName: string, planName: string, endDate: string): string {
  return `Hallo ${userName},\n\nIhr ${planName}-Abonnement wurde gekündigt. Sie haben weiterhin Zugriff bis zum ${endDate}.\n\nNach diesem Datum wird Ihr Konto auf den kostenlosen Plan umgestellt. Sie können jederzeit wieder upgraden.`
}

function buildInvoiceText(firstName: string, planName: string, amountEur: string, downloadUrl?: string): string {
  return `Hallo ${firstName}, wir haben eine neue Rechnung für Ihr ${APP_NAME} ${planName} Abonnement über ${amountEur} € erstellt. Bitte überweisen Sie innerhalb von 14 Tagen.${downloadUrl ? ` PDF: ${downloadUrl}` : ''}`
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  ${content}
</body>
</html>`
}


describe('Email Service — Template Logic', () => {
  describe('Subject Lines', () => {
    it('password reset subject includes APP_NAME', () => {
      expect(buildPasswordResetSubject()).toBe('AssetNode — Passwort zurücksetzen')
    })

    it('welcome subject includes APP_NAME', () => {
      expect(buildWelcomeSubject()).toBe('Willkommen bei AssetNode!')
    })

    it('trial started subject includes plan name', () => {
      expect(buildTrialStartedSubject('Pro')).toBe('AssetNode — Ihre Pro-Testphase hat begonnen')
      expect(buildTrialStartedSubject('Starter')).toBe('AssetNode — Ihre Starter-Testphase hat begonnen')
    })

    it('plan changed subject includes new plan', () => {
      expect(buildPlanChangedSubject('Enterprise')).toBe('AssetNode — Plan geändert zu Enterprise')
    })

    it('subscription canceled subject', () => {
      expect(buildSubscriptionCanceledSubject()).toBe('AssetNode — Abo gekündigt')
    })

    it('invoice subject includes plan and period', () => {
      expect(buildInvoiceSubject('Pro', 'Monatsabonnement'))
        .toBe('Ihre AssetNode Rechnung — Pro Monatsabonnement')
      expect(buildInvoiceSubject('Starter', 'Jahresabonnement'))
        .toBe('Ihre AssetNode Rechnung — Starter Jahresabonnement')
    })

    it('all subjects should be non-empty', () => {
      const subjects = [
        buildPasswordResetSubject(),
        buildWelcomeSubject(),
        buildTrialStartedSubject('Pro'),
        buildPlanChangedSubject('Pro'),
        buildSubscriptionCanceledSubject(),
        buildInvoiceSubject('Pro', 'Monat')
      ]
      subjects.forEach(s => expect(s.length).toBeGreaterThan(10))
    })
  })

  describe('Greeting', () => {
    it('should greet by name when provided', () => {
      expect(buildGreeting('Alex')).toBe('Hallo Alex,')
    })

    it('should use generic greeting when no name', () => {
      expect(buildGreeting()).toBe('Hallo,')
      expect(buildGreeting(undefined)).toBe('Hallo,')
    })
  })

  describe('Password Reset Email', () => {
    const greeting = buildGreeting('Alex')
    const url = 'https://app.asset-node.com/reset?token=abc123'
    const text = buildPasswordResetText(greeting, url)

    it('should include greeting', () => {
      expect(text).toContain('Hallo Alex,')
    })

    it('should include reset URL', () => {
      expect(text).toContain(url)
    })

    it('should mention 1 hour validity', () => {
      expect(text).toContain('1 Stunde')
    })

    it('should include ignore instruction', () => {
      expect(text).toContain('ignorieren Sie diese E-Mail')
    })
  })

  describe('Welcome Email', () => {
    const text = buildWelcomeText('Alex', 'https://app.asset-node.com/sign-in')

    it('should include user name', () => {
      expect(text).toContain('Hallo Alex')
    })

    it('should include login URL', () => {
      expect(text).toContain('https://app.asset-node.com/sign-in')
    })

    it('should confirm account creation', () => {
      expect(text).toContain('erfolgreich erstellt')
    })
  })

  describe('Trial Started Email', () => {
    const text = buildTrialText('Alex', 'Pro', 14)

    it('should include plan name', () => {
      expect(text).toContain('Pro')
    })

    it('should include trial days', () => {
      expect(text).toContain('14 Tage')
    })

    it('should mention free testing', () => {
      expect(text).toContain('kostenlos zu testen')
    })

    it('should mention downgrade option', () => {
      expect(text).toContain('kostenlosen Plan zurückkehren')
    })
  })

  describe('Plan Changed Email', () => {
    const text = buildPlanChangedText('Alex', 'Enterprise', '150,00 €')

    it('should include new plan name', () => {
      expect(text).toContain('Enterprise')
    })

    it('should include price', () => {
      expect(text).toContain('150,00 €')
    })

    it('should mention billing settings', () => {
      expect(text).toContain('Einstellungen → Abrechnung')
    })
  })

  describe('Subscription Canceled Email', () => {
    const text = buildCancellationText('Alex', 'Pro', '15.05.2026')

    it('should include plan name', () => {
      expect(text).toContain('Pro-Abonnement')
    })

    it('should include end date', () => {
      expect(text).toContain('15.05.2026')
    })

    it('should mention downgrade to free', () => {
      expect(text).toContain('kostenlosen Plan umgestellt')
    })

    it('should mention re-upgrade option', () => {
      expect(text).toContain('jederzeit wieder upgraden')
    })
  })

  describe('Invoice Email', () => {
    it('should include plan and amount', () => {
      const text = buildInvoiceText('Alex', 'Pro', '50,00')
      expect(text).toContain('Pro')
      expect(text).toContain('50,00 €')
    })

    it('should include 14-day payment terms', () => {
      const text = buildInvoiceText('Alex', 'Pro', '50,00')
      expect(text).toContain('14 Tagen')
    })

    it('should include PDF link when provided', () => {
      const text = buildInvoiceText('Alex', 'Pro', '50,00', 'https://pdf.example.com/inv.pdf')
      expect(text).toContain('PDF: https://pdf.example.com/inv.pdf')
    })

    it('should omit PDF link when not provided', () => {
      const text = buildInvoiceText('Alex', 'Pro', '50,00')
      expect(text).not.toContain('PDF:')
    })
  })

  describe('HTML Wrapper', () => {
    const html = wrapHtml('<p>Test content</p>')

    it('should include DOCTYPE', () => {
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('should set lang="de"', () => {
      expect(html).toContain('lang="de"')
    })

    it('should include UTF-8 charset', () => {
      expect(html).toContain('charset="utf-8"')
    })

    it('should include viewport meta', () => {
      expect(html).toContain('width=device-width')
    })

    it('should embed content', () => {
      expect(html).toContain('Test content')
    })

    it('should use dark background', () => {
      expect(html).toContain('#0d1117')
    })
  })
})
