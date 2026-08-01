
import crypto from 'crypto'
import { Organization } from '../../models/Organization'
import { decrypt } from './encryption'

export const SSO_LOGIN_AVAILABLE = false

export interface SamlConfig {
  entityId: string
  ssoUrl: string
  certificate: string
  callbackUrl: string
}

export interface SsoConfigurationInput {
  enabled?: boolean
  provider?: string
  entityId?: string
  ssoUrl?: string
  certificate?: string
  forceSso?: boolean
  allowedDomains?: string[]
}

export type SsoConfigurationValidation =
  | { valid: true; normalizedDomains: string[] }
  | { valid: false; error: string }

const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function validateSsoConfiguration(input: SsoConfigurationInput): SsoConfigurationValidation {
  if (input.provider !== 'saml') {
    return { valid: false, error: 'Only the SAML provider is supported.' }
  }

  if (!input.entityId?.trim()) {
    return { valid: false, error: 'The IdP entity ID is required.' }
  }

  try {
    const url = new URL(input.ssoUrl || '')
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return { valid: false, error: 'The SSO URL must be an HTTPS URL without embedded credentials.' }
    }
  } catch {
    return { valid: false, error: 'The SSO URL must be a valid HTTPS URL.' }
  }

  const certificate = input.certificate?.trim() || ''
  if (!certificate.startsWith('-----BEGIN CERTIFICATE-----') || !certificate.endsWith('-----END CERTIFICATE-----')) {
    return { valid: false, error: 'A PEM-encoded IdP X.509 certificate is required.' }
  }
  try {


    new crypto.X509Certificate(certificate)
  } catch {
    return { valid: false, error: 'The IdP certificate is not a valid X.509 certificate.' }
  }

  const normalizedDomains = [...new Set((input.allowedDomains || []).map((domain) => domain.trim().toLowerCase()).filter(Boolean))]
  if (normalizedDomains.length === 0) {
    return { valid: false, error: 'At least one allowed email domain is required.' }
  }
  if (normalizedDomains.some((domain) => !DOMAIN_RE.test(domain))) {
    return { valid: false, error: 'Allowed domains must be exact DNS domain names; wildcards are not supported.' }
  }

  return { valid: true, normalizedDomains }
}

export async function buildSamlConfig(ssoSlug: string): Promise<{ config: SamlConfig; orgId: string } | null> {
  const org = await Organization.findOne({ ssoSlug, isActive: true })
  if (!org) return null

  const sso = (org.settings as any)?.integrations?.sso as SsoConfigurationInput | undefined
  if (!sso?.enabled) return null

  const certificate = sso.certificate ? decrypt(sso.certificate) : ''
  const validation = validateSsoConfiguration({ ...sso, certificate })
  if (!validation.valid) return null

  const appUrl = process.env.APP_URL
  if (!appUrl) return null

  let origin: string
  try {
    const parsed = new URL(appUrl)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null
    origin = parsed.origin
  } catch {
    return null
  }

  return {
    config: {
      entityId: `${origin}/api/auth/sso/metadata/${ssoSlug}`,
      ssoUrl: sso.ssoUrl!,
      certificate,
      callbackUrl: `${origin}/api/auth/sso/callback`
    },
    orgId: String(org._id)
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateSpMetadata(config: SamlConfig): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${escapeXml(config.entityId)}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${escapeXml(config.callbackUrl)}"
      index="0"
      isDefault="true" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
}

export function isDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (!allowedDomains?.length) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return Boolean(domain && allowedDomains.some((allowed) => allowed.trim().toLowerCase() === domain))
}
