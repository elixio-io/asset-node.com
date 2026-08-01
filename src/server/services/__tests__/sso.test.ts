import { describe, it, expect } from 'vitest'
import zlib from 'zlib'
import crypto from 'crypto'


interface SamlConfig {
  entityId: string; ssoUrl: string; certificate: string; callbackUrl: string
}

interface SamlUserAttributes {
  email: string; firstName?: string; lastName?: string; nameId: string
}

function buildAuthnRequest(config: SamlConfig, relayState: string): { redirectUrl: string } {
  const id = `_${crypto.randomBytes(16).toString('hex')}`
  const issueInstant = new Date().toISOString()

  const request = `
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.ssoUrl}"
  AssertionConsumerServiceURL="${config.callbackUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.entityId}</saml:Issuer>
  <samlp:NameIDPolicy
    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    AllowCreate="true" />
</samlp:AuthnRequest>`.trim()

  const deflated = zlib.deflateRawSync(Buffer.from(request, 'utf-8'))
  const encodedRequest = encodeURIComponent(deflated.toString('base64'))
  const encodedRelayState = encodeURIComponent(relayState)
  const separator = config.ssoUrl.includes('?') ? '&' : '?'
  return { redirectUrl: `${config.ssoUrl}${separator}SAMLRequest=${encodedRequest}&RelayState=${encodedRelayState}` }
}

function parseSamlResponse(samlResponseB64: string): SamlUserAttributes | null {
  try {
    const xml = Buffer.from(samlResponseB64, 'base64').toString('utf-8')
    const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/)
    if (notOnOrAfterMatch) {
      const expiry = new Date(notOnOrAfterMatch[1])
      if (expiry < new Date()) return null
    }
    const nameIdMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/i)
    if (!nameIdMatch) return null
    const nameId = nameIdMatch[1]
    const getAttr = (name: string): string | undefined => {
      const re2 = new RegExp(`<saml2:Attribute[^>]*Name="${name}"[^>]*>\\s*<saml2:AttributeValue[^>]*>([^<]+)</saml2:AttributeValue>`, 'i')
      const m2 = xml.match(re2); if (m2?.[1]) return m2[1]
      const re = new RegExp(`<saml:Attribute[^>]*Name="${name}"[^>]*>\\s*<saml:AttributeValue[^>]*>([^<]+)</saml:AttributeValue>`, 'i')
      const m = xml.match(re); if (m?.[1]) return m[1]
      return undefined
    }
    const email = getAttr('email') || getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') || nameId
    if (!email || !email.includes('@')) return null
    return {
      nameId, email,
      firstName: getAttr('firstName') || getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'),
      lastName: getAttr('lastName') || getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'),
    }
  } catch { return null }
}

function generateSpMetadata(config: SamlConfig): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${config.entityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${config.callbackUrl}"
      index="0"
      isDefault="true" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
}

function isDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true
  const domain = email.split('@')[1]?.toLowerCase()
  return allowedDomains.some(d => d.toLowerCase() === domain)
}


function buildTestSamlXml(opts: {
  nameId: string; email?: string; firstName?: string; lastName?: string
  notOnOrAfter?: string; namespace?: 'saml' | 'saml2'
}): string {
  const ns = opts.namespace || 'saml'
  const attrs: string[] = []
  if (opts.email) {
    attrs.push(`<${ns}:Attribute Name="email"><${ns}:AttributeValue>${opts.email}</${ns}:AttributeValue></${ns}:Attribute>`)
  }
  if (opts.firstName) {
    attrs.push(`<${ns}:Attribute Name="firstName"><${ns}:AttributeValue>${opts.firstName}</${ns}:AttributeValue></${ns}:Attribute>`)
  }
  if (opts.lastName) {
    attrs.push(`<${ns}:Attribute Name="lastName"><${ns}:AttributeValue>${opts.lastName}</${ns}:AttributeValue></${ns}:Attribute>`)
  }
  const conditions = opts.notOnOrAfter ? `<Conditions NotOnOrAfter="${opts.notOnOrAfter}"/>` : ''
  return `<samlp:Response><${ns}:Assertion>${conditions}<${ns}:Subject><${ns}:NameID>${opts.nameId}</${ns}:NameID></${ns}:Subject><${ns}:AttributeStatement>${attrs.join('')}</${ns}:AttributeStatement></${ns}:Assertion></samlp:Response>`
}

const testConfig: SamlConfig = {
  entityId: 'https://app.asset-node.com/saml/metadata/abc123',
  ssoUrl: 'https://idp.example.com/sso/login',
  certificate: 'MIIC...',
  callbackUrl: 'https://app.asset-node.com/api/auth/sso/callback',
}


describe('SSO / SAML Service', () => {
  describe('buildAuthnRequest', () => {
    it('should produce a redirect URL', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/dashboard')
      expect(redirectUrl).toContain(testConfig.ssoUrl)
    })

    it('should include SAMLRequest parameter', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/dashboard')
      expect(redirectUrl).toContain('SAMLRequest=')
    })

    it('should include RelayState parameter', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/dashboard')
      expect(redirectUrl).toContain('RelayState=')
    })

    it('should use ? separator for URLs without query string', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/test')
      expect(redirectUrl).toMatch(/login\?SAMLRequest=/)
    })

    it('should use & separator for URLs with existing query string', () => {
      const config = { ...testConfig, ssoUrl: 'https://idp.example.com/sso?param=1' }
      const { redirectUrl } = buildAuthnRequest(config, '/test')
      expect(redirectUrl).toMatch(/param=1&SAMLRequest=/)
    })

    it('should produce decodable SAML XML', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/test')
      const samlB64 = decodeURIComponent(redirectUrl.split('SAMLRequest=')[1].split('&')[0])
      const deflated = Buffer.from(samlB64, 'base64')
      const xml = zlib.inflateRawSync(deflated).toString('utf-8')
      expect(xml).toContain('samlp:AuthnRequest')
      expect(xml).toContain(testConfig.entityId)
      expect(xml).toContain(testConfig.callbackUrl)
      expect(xml).toContain('Version="2.0"')
    })

    it('should include NameIDPolicy with email format', () => {
      const { redirectUrl } = buildAuthnRequest(testConfig, '/test')
      const samlB64 = decodeURIComponent(redirectUrl.split('SAMLRequest=')[1].split('&')[0])
      const xml = zlib.inflateRawSync(Buffer.from(samlB64, 'base64')).toString('utf-8')
      expect(xml).toContain('nameid-format:emailAddress')
    })
  })

  describe('parseSamlResponse — saml: namespace', () => {
    it('should extract email, firstName, lastName from saml: namespace', () => {
      const xml = buildTestSamlXml({
        nameId: 'user@example.com', email: 'user@example.com',
        firstName: 'John', lastName: 'Doe', namespace: 'saml',
      })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).not.toBeNull()
      expect(result!.email).toBe('user@example.com')
      expect(result!.firstName).toBe('John')
      expect(result!.lastName).toBe('Doe')
      expect(result!.nameId).toBe('user@example.com')
    })
  })

  describe('parseSamlResponse — saml2: namespace (Okta)', () => {
    it('should extract from saml2: namespace', () => {
      const xml = buildTestSamlXml({
        nameId: 'okta-user@corp.com', email: 'okta-user@corp.com',
        firstName: 'Jane', lastName: 'Smith', namespace: 'saml2',
      })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).not.toBeNull()
      expect(result!.email).toBe('okta-user@corp.com')
      expect(result!.firstName).toBe('Jane')
    })
  })

  describe('parseSamlResponse — fallback to NameID', () => {
    it('should use NameID as email when no email attribute exists', () => {
      const xml = buildTestSamlXml({ nameId: 'fallback@example.com' })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).not.toBeNull()
      expect(result!.email).toBe('fallback@example.com')
    })

    it('should reject NameID that is not an email', () => {
      const xml = buildTestSamlXml({ nameId: 'not-an-email' })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).toBeNull()
    })
  })

  describe('parseSamlResponse — timing protection', () => {
    it('should reject expired response (past NotOnOrAfter)', () => {
      const xml = buildTestSamlXml({
        nameId: 'expired@example.com',
        notOnOrAfter: '2020-01-01T00:00:00Z',
      })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).toBeNull()
    })

    it('should accept response with future NotOnOrAfter', () => {
      const xml = buildTestSamlXml({
        nameId: 'valid@example.com',
        notOnOrAfter: '2099-01-01T00:00:00Z',
      })
      const result = parseSamlResponse(Buffer.from(xml).toString('base64'))
      expect(result).not.toBeNull()
    })
  })

  describe('generateSpMetadata', () => {
    const metadata = generateSpMetadata(testConfig)

    it('should produce valid XML declaration', () => {
      expect(metadata).toContain('<?xml version="1.0"')
    })

    it('should include entity ID', () => {
      expect(metadata).toContain(testConfig.entityId)
    })

    it('should include ACS URL', () => {
      expect(metadata).toContain(testConfig.callbackUrl)
    })

    it('should specify HTTP-POST binding', () => {
      expect(metadata).toContain('HTTP-POST')
    })

    it('should want assertions signed', () => {
      expect(metadata).toContain('WantAssertionsSigned="true"')
    })

    it('should specify email NameID format', () => {
      expect(metadata).toContain('nameid-format:emailAddress')
    })
  })

  describe('isDomainAllowed', () => {
    it('should allow all if no domains specified', () => {
      expect(isDomainAllowed('user@any.com', [])).toBe(true)
    })

    it('should allow matching domain', () => {
      expect(isDomainAllowed('user@corp.com', ['corp.com'])).toBe(true)
    })

    it('should reject non-matching domain', () => {
      expect(isDomainAllowed('user@evil.com', ['corp.com'])).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isDomainAllowed('user@Corp.COM', ['corp.com'])).toBe(true)
    })

    it('should support multiple allowed domains', () => {
      const domains = ['corp.com', 'partner.com']
      expect(isDomainAllowed('user@partner.com', domains)).toBe(true)
      expect(isDomainAllowed('user@other.com', domains)).toBe(false)
    })
  })
})
