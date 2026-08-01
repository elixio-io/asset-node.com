import { describe, it, expect } from 'vitest'


const APP_NAME = 'AssetNode'

function wrapHtml(content: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head><body>${content}</body></html>`
}

function buildPasswordResetEmail(resetUrl: string, userName?: string) {
  const greeting = userName ? `Hallo ${userName},` : 'Hallo,'
  const subject = `${APP_NAME} — Passwort zurücksetzen`
  const html = wrapHtml(`<h2>Passwort zurücksetzen</h2><p>${greeting}</p><a href="${resetUrl}">Neues Passwort festlegen</a>`)
  const text = `${greeting}\n\nKlicken Sie auf diesen Link: ${resetUrl}\n\nDieser Link ist 1 Stunde gültig.`
  return { subject, html, text }
}

function buildWelcomeEmail(userName: string, loginUrl?: string) {
  const url = loginUrl || 'https://app.asset-node.com/sign-in'
  const subject = `Willkommen bei ${APP_NAME}!`
  const html = wrapHtml(`<h2>Willkommen bei ${APP_NAME}!</h2><p>Hallo ${userName},</p><a href="${url}">Jetzt anmelden</a>`)
  const text = `Hallo ${userName},\n\nIhr ${APP_NAME}-Konto wurde erfolgreich erstellt.\n\nJetzt anmelden: ${url}`
  return { subject, html, text }
}

function buildTrialStartedEmail(userName: string, planName: string, trialDays: number) {
  const subject = `${APP_NAME} — Ihre ${planName}-Testphase hat begonnen`
  const text = `Hallo ${userName},\n\nIhre ${planName}-Testphase ist jetzt aktiv. Sie haben ${trialDays} Tage.`
  return { subject, text }
}

function buildCancellationEmail(userName: string, planName: string, endDate: string) {
  const subject = `${APP_NAME} — Abo gekündigt`
  const text = `Hallo ${userName},\n\nIhr ${planName}-Abonnement wurde gekündigt. Zugriff bis ${endDate}.`
  return { subject, text }
}

function buildInvoiceEmail(firstName: string, planName: string, amountEur: string, periodLabel: string) {
  const subject = `Ihre ${APP_NAME} Rechnung — ${planName} ${periodLabel}`
  const text = `Hallo ${firstName}, Rechnung für ${APP_NAME} ${planName} über ${amountEur} €.`
  return { subject, text }
}


describe('Email Service — Template Builder', () => {
  describe('Password Reset', () => {
    it('should use personalized greeting when name provided', () => {
      const email = buildPasswordResetEmail('https://app.example.com/reset/abc', 'Max')
      expect(email.text).toContain('Hallo Max,')
    })

    it('should use generic greeting when no name', () => {
      const email = buildPasswordResetEmail('https://app.example.com/reset/abc')
      expect(email.text).toContain('Hallo,')
    })

    it('should include reset URL in text and HTML', () => {
      const url = 'https://app.example.com/reset/token-123'
      const email = buildPasswordResetEmail(url, 'Max')
      expect(email.text).toContain(url)
      expect(email.html).toContain(url)
    })

    it('should include 1 hour expiry note', () => {
      const email = buildPasswordResetEmail('https://x.com/reset', 'Max')
      expect(email.text).toContain('1 Stunde')
    })

    it('should have proper subject line', () => {
      const email = buildPasswordResetEmail('https://x.com/reset')
      expect(email.subject).toBe('AssetNode — Passwort zurücksetzen')
    })
  })

  describe('Welcome Email', () => {
    it('should greet the user by name', () => {
      const email = buildWelcomeEmail('Sarah')
      expect(email.text).toContain('Hallo Sarah,')
    })

    it('should use default login URL when none provided', () => {
      const email = buildWelcomeEmail('Sarah')
      expect(email.text).toContain('https://app.asset-node.com/sign-in')
    })

    it('should use custom login URL when provided', () => {
      const email = buildWelcomeEmail('Sarah', 'https://custom.app.com/login')
      expect(email.text).toContain('https://custom.app.com/login')
      expect(email.html).toContain('https://custom.app.com/login')
    })

    it('should have proper subject line', () => {
      const email = buildWelcomeEmail('Sarah')
      expect(email.subject).toBe('Willkommen bei AssetNode!')
    })
  })

  describe('Trial Started Email', () => {
    it('should include plan name and trial days', () => {
      const email = buildTrialStartedEmail('Max', 'Pro', 14)
      expect(email.text).toContain('Pro')
      expect(email.text).toContain('14 Tage')
    })

    it('should have proper subject with plan name', () => {
      const email = buildTrialStartedEmail('Max', 'Starter', 14)
      expect(email.subject).toBe('AssetNode — Ihre Starter-Testphase hat begonnen')
    })
  })

  describe('Cancellation Email', () => {
    it('should include plan name and end date', () => {
      const email = buildCancellationEmail('Max', 'Pro', '31. Dezember 2026')
      expect(email.text).toContain('Pro')
      expect(email.text).toContain('31. Dezember 2026')
    })

    it('should have correct subject', () => {
      const email = buildCancellationEmail('Max', 'Pro', '31.12.2026')
      expect(email.subject).toBe('AssetNode — Abo gekündigt')
    })
  })

  describe('Invoice Email', () => {
    it('should include plan name and amount', () => {
      const email = buildInvoiceEmail('Max', 'Pro', '50.00', 'Monatsabonnement')
      expect(email.text).toContain('Pro')
      expect(email.text).toContain('50.00')
    })

    it('should include period label in subject', () => {
      const email = buildInvoiceEmail('Max', 'Starter', '20.00', 'Jahresabonnement')
      expect(email.subject).toContain('Jahresabonnement')
    })

    it('should include app name in subject', () => {
      const email = buildInvoiceEmail('Max', 'Pro', '50.00', 'Monatsabonnement')
      expect(email.subject).toContain('AssetNode')
    })
  })

  describe('HTML Wrapper', () => {
    it('should produce valid HTML document', () => {
      const html = wrapHtml('<p>Test content</p>')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="de">')
      expect(html).toContain('Test content')
    })

    it('should include charset meta', () => {
      const html = wrapHtml('')
      expect(html).toContain('charset="utf-8"')
    })
  })
})
