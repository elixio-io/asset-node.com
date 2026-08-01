import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthChallenge } from '../../models/AuthChallenge'
import { User } from '../../models/User'
import authSecurityRoutes from '../routes/authSecurity'
import { verifySecurityChallenge } from '../services/authSecurity'

describe('auth security routes', () => {
  const app = Fastify({ logger: false })

  beforeEach(async () => {
    process.env.JWT_SECRET = 'route-test-signing-secret-with-sufficient-entropy'
    process.env.WEBAUTHN_ORIGIN = 'https://app.asset-node.test'
    process.env.WEBAUTHN_RP_ID = 'asset-node.test'
    vi.spyOn(AuthChallenge, 'create').mockResolvedValue({} as any)
    if (!app.hasRoute({ method: 'POST', url: '/passkeys/login/options' })) {
      await app.register(authSecurityRoutes)
      await app.ready()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.WEBAUTHN_ORIGIN
    delete process.env.WEBAUTHN_RP_ID
  })

  it('starts a usernameless passkey ceremony without account-identifying input', async () => {
    const response = await app.inject({ method: 'POST', url: '/passkeys/login/options' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.options.rpId).toBe('asset-node.test')
    expect(body.options.userVerification).toBe('required')
    expect(body.options.allowCredentials).toBeUndefined()
    expect(verifySecurityChallenge(body.ceremonyToken, 'passkey-login').challenge)
      .toBe(body.options.challenge)
  })

  it('rejects ambiguous MFA submissions before any credential lookup', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/login/mfa',
      payload: { challengeToken: 'unused', code: '123456', recoveryCode: 'AAAA-BBBB-CCCC' }
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('INVALID_MFA_INPUT')
  })

  it.each([
    null,
    {},
    { id: 'credential-without-response' },
    { id: 'credential', response: { userHandle: 'handle' } }
  ])('rejects malformed passkey assertions without a server error', async (malformedResponse) => {
    const lookup = vi.spyOn(User, 'findOne')
    const response = await app.inject({
      method: 'POST',
      url: '/passkeys/login/verify',
      payload: { ceremonyToken: 'untrusted', response: malformedResponse }
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_PASSKEY' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('protects status and organization-admin recovery endpoints', async () => {
    const statusResponse = await app.inject({ method: 'GET', url: '/security' })
    expect(statusResponse.statusCode).toBe(401)
    expect(statusResponse.json().code).toBe('AUTH_REQUIRED')

    const resetResponse = await app.inject({
      method: 'POST',
      url: '/admin/users/507f1f77bcf86cd799439011/mfa/reset',
      payload: { currentPassword: 'password' }
    })
    expect(resetResponse.statusCode).toBe(401)
    expect(resetResponse.json().code).toBe('AUTH_REQUIRED')
  })
})
