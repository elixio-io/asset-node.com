import { describe, it, expect } from 'vitest'
import { SSO_LOGIN_AVAILABLE, generateSpMetadata, isDomainAllowed } from '../../server/services/sso'
import type { SamlConfig } from '../../server/services/sso'

const TEST_CONFIG: SamlConfig = {
  entityId: 'https://app.asset-node.com/saml/metadata/test-slug',
  ssoUrl: 'https://login.microsoftonline.com/tenant/saml2',
  certificate: '',
  callbackUrl: 'https://app.asset-node.com/api/auth/sso/callback',
}

describe('SSO / SAML Service', () => {
  describe('interactive SAML login', () => {
    it('should remain disabled until complete assertion verification is available', () => {
      expect(SSO_LOGIN_AVAILABLE).toBe(false)
    })
  })

  describe('generateSpMetadata', () => {
    it('should produce valid XML with entityID', () => {
      const xml = generateSpMetadata(TEST_CONFIG)
      expect(xml).toContain('entityID="https://app.asset-node.com/saml/metadata/test-slug"')
    })

    it('should include ACS endpoint', () => {
      const xml = generateSpMetadata(TEST_CONFIG)
      expect(xml).toContain('Location="https://app.asset-node.com/api/auth/sso/callback"')
    })

    it('should request email NameID format', () => {
      const xml = generateSpMetadata(TEST_CONFIG)
      expect(xml).toContain('emailAddress')
    })

    it('should want signed assertions', () => {
      const xml = generateSpMetadata(TEST_CONFIG)
      expect(xml).toContain('WantAssertionsSigned="true"')
    })
  })

  describe('isDomainAllowed', () => {
    it('should deny email when no domains are configured', () => {
      expect(isDomainAllowed('anyone@example.com', [])).toBe(false)
    })

    it('should allow email from allowed domain', () => {
      expect(isDomainAllowed('john@acme.com', ['acme.com'])).toBe(true)
    })

    it('should reject email from non-allowed domain', () => {
      expect(isDomainAllowed('john@evil.com', ['acme.com', 'company.com'])).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isDomainAllowed('john@ACME.COM', ['acme.com'])).toBe(true)
      expect(isDomainAllowed('john@acme.com', ['ACME.COM'])).toBe(true)
    })

    it('should handle multiple allowed domains', () => {
      const domains = ['acme.com', 'company.org', 'test.dev']
      expect(isDomainAllowed('x@company.org', domains)).toBe(true)
      expect(isDomainAllowed('x@test.dev', domains)).toBe(true)
      expect(isDomainAllowed('x@other.com', domains)).toBe(false)
    })

    it('should deny email when allowed domains are null', () => {
      expect(isDomainAllowed('x@any.com', null as any)).toBe(false)
    })
  })
})
