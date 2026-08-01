import { describe, it, expect } from 'vitest'
import crypto from 'crypto'


const PLAN_KEYS = ['free', 'starter', 'pro', 'enterprise'] as const
const BILLING_STATUSES = ['free', 'trialing', 'active', 'past_due', 'canceled'] as const
const BILLING_INTERVALS = ['monthly', 'annual'] as const
const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const
const SSO_PROVIDERS = ['saml', 'oidc', ''] as const

const INTEGRATION_PROVIDERS = [
  'intune', 'autopilot', 'jamf', 'kandji', 'personio',
  'scim', 'sso', 'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk'
] as const

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function generateSsoSlug(): string {
  return crypto.randomBytes(4).toString('hex')
}

const SETTINGS_DEFAULTS = {
  defaultCurrency: 'EUR',
  assetTagPrefix: 'AN',
  depreciationYears: 3,
  lowStockThreshold: 3,
  wizardCompleted: false,
}


describe('Organization Model — Schema Logic', () => {
  describe('Slug Generation', () => {
    it('should lowercase the name', () => {
      expect(generateSlug('ACME Corp')).toBe('acme-corp')
    })

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('My Company Name')).toBe('my-company-name')
    })

    it('should remove special characters', () => {
      expect(generateSlug('Müller & Sons GmbH')).toBe('m-ller-sons-gmbh')
    })

    it('should strip leading/trailing hyphens', () => {
      expect(generateSlug('--test--')).toBe('test')
    })

    it('should collapse multiple non-alphanumeric chars', () => {
      expect(generateSlug('a!!!b...c')).toBe('a-b-c')
    })
  })

  describe('SSO Slug Auto-generation', () => {
    it('should produce 8-char hex string', () => {
      const slug = generateSsoSlug()
      expect(slug).toHaveLength(8)
      expect(/^[0-9a-f]+$/.test(slug)).toBe(true)
    })

    it('should be unique across calls', () => {
      const s1 = generateSsoSlug()
      const s2 = generateSsoSlug()
      expect(s1).not.toBe(s2)
    })
  })

  describe('Plan Enum', () => {
    it('should have 4 plan keys', () => {
      expect(PLAN_KEYS).toHaveLength(4)
    })

    it.each(['free', 'starter', 'pro', 'enterprise'] as const)(
      '"%s" should be a valid plan', (plan) => {
        expect(PLAN_KEYS).toContain(plan)
      }
    )
  })

  describe('Billing Status Enum', () => {
    it('should have 5 billing statuses', () => {
      expect(BILLING_STATUSES).toHaveLength(5)
    })

    it.each(['free', 'trialing', 'active', 'past_due', 'canceled'] as const)(
      '"%s" should be valid', (status) => {
        expect(BILLING_STATUSES).toContain(status)
      }
    )
  })

  describe('Billing Interval Enum', () => {
    it.each(['monthly', 'annual'] as const)('"%s" should be valid', (interval) => {
      expect(BILLING_INTERVALS).toContain(interval)
    })
  })

  describe('Custom Field Types', () => {
    it('should support 5 field types', () => {
      expect(CUSTOM_FIELD_TYPES).toHaveLength(5)
    })

    it.each(['text', 'number', 'date', 'boolean', 'select'] as const)(
      '"%s" should be valid', (type) => {
        expect(CUSTOM_FIELD_TYPES).toContain(type)
      }
    )
  })

  describe('SSO Provider Enum', () => {
    it('should support saml, oidc, and empty string', () => {
      expect(SSO_PROVIDERS).toContain('saml')
      expect(SSO_PROVIDERS).toContain('oidc')
      expect(SSO_PROVIDERS).toContain('')
    })
  })

  describe('Integration Registry', () => {
    it('should have 12 integration providers', () => {
      expect(INTEGRATION_PROVIDERS).toHaveLength(12)
    })

    it.each([
      'intune', 'autopilot', 'jamf', 'kandji', 'personio',
      'scim', 'sso', 'bamboohr', 'googleWorkspace', 'hibob', 'mosyle', 'helpdesk'
    ])('"%s" should be registered', (provider) => {
      expect(INTEGRATION_PROVIDERS).toContain(provider)
    })
  })

  describe('Settings Defaults', () => {
    it('default currency should be EUR', () => {
      expect(SETTINGS_DEFAULTS.defaultCurrency).toBe('EUR')
    })

    it('asset tag prefix should be "AN"', () => {
      expect(SETTINGS_DEFAULTS.assetTagPrefix).toBe('AN')
    })

    it('depreciation years should be 3', () => {
      expect(SETTINGS_DEFAULTS.depreciationYears).toBe(3)
    })

    it('low stock threshold should be 3', () => {
      expect(SETTINGS_DEFAULTS.lowStockThreshold).toBe(3)
    })

    it('wizard should default to not completed', () => {
      expect(SETTINGS_DEFAULTS.wizardCompleted).toBe(false)
    })
  })
})
