import { describe, expect, it } from 'vitest'
import { auditableOrganizationSettings, publicOrganization } from '../routes/orgSettings'
import { scrubSupportText, scrubSupportUrl } from '../routes/supportTickets'
import { resolveMaintainerEmail } from '../services/emailService'

describe('support and organization privacy boundaries', () => {
  it('removes query strings and fragments from support URLs', () => {
    expect(scrubSupportUrl('/reset-password?token=secret#form')).toBe('/reset-password')
    expect(scrubSupportUrl('https://app.asset-node.com/invite?token=secret#accept'))
      .toBe('https://app.asset-node.com/invite')
  })

  it('removes embedded URL credentials and authorization values from client logs', () => {
    const input = JSON.stringify([
      { kind: 'route', message: '/reset-password?token=secret#form → /dashboard' },
      { kind: 'api', message: 'GET https://api.example.com/callback?code=oauth-code&state=oauth-state → 401' },
      { kind: 'error', message: 'Authorization: Bearer abc.def.ghi' }
    ])
    const scrubbed = scrubSupportText(input)

    expect(scrubbed).not.toContain('secret')
    expect(scrubbed).not.toContain('oauth-code')
    expect(scrubbed).not.toContain('oauth-state')
    expect(scrubbed).not.toContain('abc.def.ghi')
    expect(scrubbed).toContain('/reset-password')
  })

  it('routes fallback mail to the maintainer inbox before sender fallbacks', () => {
    expect(resolveMaintainerEmail({
      MAINTAINER_EMAIL: 'maintainer@example.com',
      SMTP_USER: 'smtp@example.com',
      SMTP_FROM: 'AssetNode <noreply@example.com>'
    } as NodeJS.ProcessEnv)).toBe('maintainer@example.com')
    expect(resolveMaintainerEmail({
      SMTP_USER: 'smtp@example.com',
      SMTP_FROM: 'AssetNode <noreply@example.com>'
    } as NodeJS.ProcessEnv)).toBe('smtp@example.com')
    expect(resolveMaintainerEmail({
      SMTP_FROM: 'AssetNode <noreply@example.com>'
    } as NodeJS.ProcessEnv)).toBe('noreply@example.com')
  })

  it('never exposes integration credentials through organization settings', () => {
    const source = {
      name: 'Acme',
      settings: {
        defaultCurrency: 'EUR',
        integrations: {
          helpdesk: { apiToken: 'encrypted-secret' },
          sso: { certificate: 'encrypted-certificate' }
        }
      }
    }
    const publicValue = publicOrganization(source)

    expect(publicValue.settings.defaultCurrency).toBe('EUR')
    expect(publicValue.settings.integrations).toBeUndefined()
    expect(source.settings.integrations.helpdesk.apiToken).toBe('encrypted-secret')
  })

  it('keeps integration secrets out of audit snapshots', () => {
    const snapshot = auditableOrganizationSettings({
      name: 'Acme',
      settings: {
        defaultCurrency: 'EUR',
        integrations: { helpdesk: { apiToken: 'encrypted-secret' } },
        smartAutomations: { returnReminders: { enabled: true, daysBefore: 7 } }
      }
    })

    expect(snapshot).toEqual({
      name: 'Acme',
      settings: {
        defaultCurrency: 'EUR',
        depreciationYears: undefined,
        lowStockThreshold: undefined,
        smartAutomations: {
          returnReminders: { enabled: true, daysBefore: 7 },
          onboardingEmails: undefined,
          offboardingCleanup: undefined
        }
      }
    })
    expect(JSON.stringify(snapshot)).not.toContain('encrypted-secret')
  })
})
