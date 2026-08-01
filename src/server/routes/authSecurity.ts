import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import crypto from 'crypto'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON
} from '@simplewebauthn/server'
import QRCode from 'qrcode'
import { User } from '../../models/User'
import { authenticate, requireRole } from '../middleware/auth'
import { createAuditEntry } from '../middleware/auditLog'
import { decrypt, encrypt } from '../services/encryption'
import { assertSessionIssuanceAllowed, AuthSessionPolicyError, issueUserSession } from '../services/authSession'
import { confirmMfaStepUp, hasRecentStrongAuthentication } from '../services/authStepUp'
import {
  buildTotpUri,
  consumeSecurityChallenge,
  createSecurityChallenge,
  generateRecoveryCodes,
  generateTotpSecret,
  getWebAuthnConfig,
  hashRecoveryCode,
  verifySecurityChallenge,
  verifyTotp
} from '../services/authSecurity'

const passwordConfirmationSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 })
})
const factorChangeConfirmationSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 }),
  code: Type.Optional(Type.String({ minLength: 6, maxLength: 8 }))
})
function securityRateLimitKey(request: any) {
  const bodyToken = request.body?.challengeToken || request.body?.ceremonyToken
  let challengedUserId: string | undefined
  if (request.body?.challengeToken) {
    try {
      challengedUserId = verifySecurityChallenge(request.body.challengeToken, 'mfa-login').userId
    } catch {
    }
  }
  const identity = request.user?.userId
    || challengedUserId
    || (request.body?.challengeToken ? undefined : bodyToken)
    || request.headers.authorization
    || request.ip
  return crypto.createHash('sha256').update(String(identity)).digest('hex')
}

const sensitiveActionLimit = {
  rateLimit: {
    max: 6,
    timeWindow: '5 minutes',
    hook: 'preHandler' as const,
    keyGenerator: securityRateLimitKey
  }
}

function authVersionCondition(authVersion: number): Record<string, unknown> {
  return authVersion === 0
    ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
    : { authVersion }
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  if (!value || typeof value !== 'object') return false
  const assertion = value as Record<string, unknown>
  const assertionResponse = assertion.response
  if (!assertionResponse || typeof assertionResponse !== 'object') return false
  const response = assertionResponse as Record<string, unknown>
  const boundedString = (candidate: unknown, maxLength = 16_384) =>
    typeof candidate === 'string' && candidate.length > 0 && candidate.length <= maxLength

  return boundedString(assertion.id, 2_048)
    && boundedString(assertion.rawId, 2_048)
    && assertion.type === 'public-key'
    && boundedString(response.clientDataJSON)
    && boundedString(response.authenticatorData)
    && boundedString(response.signature)
    && boundedString(response.userHandle, 2_048)
    && Boolean(assertion.clientExtensionResults)
    && typeof assertion.clientExtensionResults === 'object'
}

const authSecurityRoutes: FastifyPluginAsync = async (fastify) => {


  fastify.post('/passkeys/login/options', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async () => {
    const config = getWebAuthnConfig()
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: 'required',
      timeout: 60_000
    })
    return {
      options,
      ceremonyToken: await createSecurityChallenge({
        purpose: 'passkey-login',
        challenge: options.challenge
      })
    }
  })

  fastify.post('/passkeys/login/verify', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute', hook: 'preHandler', keyGenerator: securityRateLimitKey } },
    schema: {
      body: Type.Object({
        ceremonyToken: Type.String(),
        response: Type.Any()
      })
    }
  }, async (request, reply) => {
    const { ceremonyToken, response } = request.body as {
      ceremonyToken: string
      response: unknown
    }

    if (!isAuthenticationResponse(response)) {
      return reply.code(400).send({ error: 'Passkey could not be verified', code: 'INVALID_PASSKEY' })
    }

    let ceremony
    try {
      ceremony = verifySecurityChallenge(ceremonyToken, 'passkey-login')
    } catch {
      return reply.code(401).send({ error: 'Passkey request expired. Please try again.', code: 'INVALID_CHALLENGE' })
    }
    if (!ceremony.challenge) {
      return reply.code(401).send({ error: 'Invalid passkey request', code: 'INVALID_CHALLENGE' })
    }

    try {
      const user = await User.findOne({
        isActive: true,
        'passkeys.credentialId': response.id
      }).select('+passkeys +refreshToken +authVersion').exec()
      const passkey = user?.passkeys?.find(item => item.credentialId === response.id)
      if (!user || !passkey) {
        return reply.code(401).send({ error: 'Passkey could not be verified', code: 'INVALID_PASSKEY' })
      }
      if (user.ssoOnly) {
        return reply.code(403).send({ error: 'This account must sign in through SSO', code: 'SSO_REQUIRED' })
      }
      await assertSessionIssuanceAllowed(user, 'passkey')
      const expectedUserHandle = Buffer.from(String(user._id), 'utf8').toString('base64url')
      if (response.response.userHandle !== expectedUserHandle) {
        return reply.code(401).send({ error: 'Passkey could not be verified', code: 'INVALID_PASSKEY' })
      }

      const config = getWebAuthnConfig()
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[]
        }
      })
      if (!verification.verified) throw new Error('Assertion not verified')



      await consumeSecurityChallenge(ceremonyToken, 'passkey-login')

      const updatedUser = await User.findOneAndUpdate({
        _id: user._id,
        passkeys: {
          $elemMatch: {
            credentialId: passkey.credentialId,
            counter: passkey.counter
          }
        }
      }, {
        $set: {
          'passkeys.$.counter': verification.authenticationInfo.newCounter,
          'passkeys.$.backedUp': verification.authenticationInfo.credentialBackedUp,
          'passkeys.$.deviceType': verification.authenticationInfo.credentialDeviceType,
          'passkeys.$.lastUsedAt': new Date()
        }
      }, { new: true }).select('+refreshToken +authVersion').exec()
      if (!updatedUser) throw new Error('Passkey counter changed during verification')



      return await issueUserSession(fastify, request, updatedUser, 'passkey')
    } catch (error) {
      if (error instanceof AuthSessionPolicyError) {
        return reply.code(error.statusCode).send({ error: error.message, code: error.code })
      }
      request.log.warn({ error, credentialId: response.id }, 'Passkey verification failed')
      return reply.code(401).send({ error: 'Passkey could not be verified', code: 'INVALID_PASSKEY' })
    }
  })

  fastify.post('/login/mfa', {
    config: { rateLimit: { max: 8, timeWindow: '5 minutes', hook: 'preHandler', keyGenerator: securityRateLimitKey } },
    schema: {
      body: Type.Object({
        challengeToken: Type.String(),
        code: Type.Optional(Type.String()),
        recoveryCode: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const { challengeToken, code, recoveryCode } = request.body as {
      challengeToken: string
      code?: string
      recoveryCode?: string
    }
    if ((!code && !recoveryCode) || (code && recoveryCode)) {
      return reply.code(400).send({ error: 'Provide one authenticator or recovery code', code: 'INVALID_MFA_INPUT' })
    }

    let challenge
    try {
      challenge = verifySecurityChallenge(challengeToken, 'mfa-login')
    } catch {
      return reply.code(401).send({ error: 'Verification expired. Sign in again.', code: 'INVALID_CHALLENGE' })
    }
    if (!challenge.userId || !Number.isInteger(challenge.authVersion)) {
      return reply.code(401).send({ error: 'Invalid verification request', code: 'INVALID_CHALLENGE' })
    }

    const user = await User.findById(challenge.userId)
      .select('+totpSecretEncrypted +totpLastUsedStep +recoveryCodeHashes +refreshToken +authVersion')
      .exec()
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecretEncrypted
      || (user.authVersion ?? 0) !== challenge.authVersion) {
      return reply.code(401).send({ error: 'Verification failed', code: 'INVALID_MFA_CODE' })
    }

    let loginMethod: 'totp' | 'recovery-code'
    if (code) {
      const step = verifyTotp(decrypt(user.totpSecretEncrypted), code)
      if (step === null || (user.totpLastUsedStep !== undefined && step <= user.totpLastUsedStep)) {
        return reply.code(401).send({ error: 'Invalid or already used authenticator code', code: 'INVALID_MFA_CODE' })
      }
      try {
        await consumeSecurityChallenge(challengeToken, 'mfa-login')
      } catch {
        return reply.code(401).send({ error: 'Verification was already used or expired. Sign in again.', code: 'CHALLENGE_ALREADY_USED' })
      }
      const claimed = await User.findOneAndUpdate({
        _id: user._id,
        isActive: true,
        totpEnabled: true,
        totpSecretEncrypted: user.totpSecretEncrypted,
        $and: [
          authVersionCondition(challenge.authVersion!),
          { $or: [
            { totpLastUsedStep: { $exists: false } },
            { totpLastUsedStep: { $lt: step } }
          ] }
        ]
      }, { $set: { totpLastUsedStep: step } }, { new: true }).select('+refreshToken +authVersion').exec()
      if (!claimed) {
        return reply.code(401).send({ error: 'Authenticator code was already used', code: 'MFA_CODE_REPLAYED' })
      }
      loginMethod = 'totp'
      return await issueUserSession(fastify, request, claimed, loginMethod, challenge.primaryAuthMethod)
    }

    const recoveryHash = hashRecoveryCode(recoveryCode!)
    if (!user.recoveryCodeHashes.includes(recoveryHash)) {
      return reply.code(401).send({ error: 'Invalid or already used recovery code', code: 'INVALID_RECOVERY_CODE' })
    }
    try {
      await consumeSecurityChallenge(challengeToken, 'mfa-login')
    } catch {
      return reply.code(401).send({ error: 'Verification was already used or expired. Sign in again.', code: 'CHALLENGE_ALREADY_USED' })
    }
    const claimed = await User.findOneAndUpdate({
      _id: user._id,
      isActive: true,
      totpEnabled: true,
      totpSecretEncrypted: user.totpSecretEncrypted,
      ...authVersionCondition(challenge.authVersion!),
      recoveryCodeHashes: recoveryHash
    }, {
      $pull: { recoveryCodeHashes: recoveryHash }
    }, { new: true }).select('+refreshToken +authVersion').exec()
    if (!claimed) {
      return reply.code(401).send({ error: 'Invalid or already used recovery code', code: 'INVALID_RECOVERY_CODE' })
    }
    loginMethod = 'recovery-code'
    return await issueUserSession(fastify, request, claimed, loginMethod, challenge.primaryAuthMethod)
  })

  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate)

    protectedRoutes.get('/security', async (request, reply) => {
      const user = await User.findById(request.user!.userId)
        .select('+passkeys +recoveryCodeHashes')
        .exec()
      if (!user || !user.isActive) {
        return reply.code(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' })
      }
      return {
        ssoOnly: Boolean(user.ssoOnly),
        totpEnabled: user.totpEnabled,
        stepUpRequired: user.totpEnabled && !hasRecentStrongAuthentication(request.user),
        recoveryCodesRemaining: user.totpEnabled ? (user.recoveryCodeHashes || []).length : 0,
        passkeys: (user.passkeys || []).map(passkey => ({
          id: passkey.credentialId,
          name: passkey.name,
          createdAt: passkey.createdAt,
          lastUsedAt: passkey.lastUsedAt,
          backedUp: passkey.backedUp,
          deviceType: passkey.deviceType
        }))
      }
    })

    protectedRoutes.post('/passkeys/register/options', {
      config: sensitiveActionLimit,
      schema: { body: factorChangeConfirmationSchema }
    }, async (request, reply) => {
      const { currentPassword, code } = request.body as { currentPassword: string; code?: string }
      const user = await User.findById(request.user!.userId)
        .select('+hashedPassword +passkeys +totpSecretEncrypted +totpLastUsedStep +authVersion')
        .exec()
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (user.ssoOnly) {
        return reply.code(409).send({ error: 'Passkeys for SSO-only accounts must be managed by your identity provider', code: 'SSO_ONLY' })
      }
      if (!(await user.validatePassword(currentPassword))) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (!(await confirmMfaStepUp(user, request.user, code))) {
        return reply.code(401).send({ error: 'A current authenticator code is required', code: 'MFA_STEP_UP_REQUIRED' })
      }

      const config = getWebAuthnConfig()
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userID: new Uint8Array(Buffer.from(String(user._id), 'utf8')),
        userName: user.email,
        userDisplayName: user.fullName,
        attestationType: 'none',
        timeout: 60_000,
        excludeCredentials: (user.passkeys || []).map(passkey => ({
          id: passkey.credentialId,
          transports: passkey.transports as AuthenticatorTransportFuture[]
        })),
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required'
        }
      })
      return {
        options,
        ceremonyToken: await createSecurityChallenge({
          purpose: 'passkey-registration',
          userId: String(user._id),
          challenge: options.challenge
        })
      }
    })

    protectedRoutes.post('/passkeys/register/verify', {
      config: sensitiveActionLimit,
      schema: {
        body: Type.Object({
          ceremonyToken: Type.String(),
          name: Type.String({ minLength: 1, maxLength: 80 }),
          response: Type.Any()
        })
      }
    }, async (request, reply) => {
      const { ceremonyToken, name, response } = request.body as {
        ceremonyToken: string
        name: string
        response: RegistrationResponseJSON
      }

      let ceremony
      try {
        ceremony = verifySecurityChallenge(ceremonyToken, 'passkey-registration')
      } catch {
        return reply.code(401).send({ error: 'Passkey request expired. Please try again.', code: 'INVALID_CHALLENGE' })
      }
      if (ceremony.userId !== request.user!.userId || !ceremony.challenge) {
        return reply.code(403).send({ error: 'Invalid passkey request', code: 'INVALID_CHALLENGE' })
      }

      try {
        const config = getWebAuthnConfig()
        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: ceremony.challenge,
          expectedOrigin: config.origin,
          expectedRPID: config.rpID,
          requireUserVerification: true
        })
        if (!verification.verified) throw new Error('Registration not verified')

        await consumeSecurityChallenge(ceremonyToken, 'passkey-registration')

        const credentialId = verification.registrationInfo.credential.id
        if (await User.exists({ 'passkeys.credentialId': credentialId })) {
          return reply.code(409).send({ error: 'This passkey is already registered', code: 'PASSKEY_EXISTS' })
        }

        const user = await User.findById(request.user!.userId).select('+passkeys').exec()
        if (!user || !user.isActive) {
          return reply.code(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' })
        }
        user.passkeys.push({
          credentialId,
          publicKey: Buffer.from(verification.registrationInfo.credential.publicKey),
          counter: verification.registrationInfo.credential.counter,
          transports: verification.registrationInfo.credential.transports || [],
          deviceType: verification.registrationInfo.credentialDeviceType,
          backedUp: verification.registrationInfo.credentialBackedUp,
          name: name.trim(),
          createdAt: new Date()
        })
        await user.save()

        await createAuditEntry(request, 'update', 'User', request.user!.userId, {
          after: { passkeyAdded: true, passkeyName: name.trim() }
        })
        return reply.code(201).send({
          id: credentialId,
          name: name.trim(),
          createdAt: user.passkeys[user.passkeys.length - 1].createdAt
        })
      } catch (error) {
        request.log.warn({ error }, 'Passkey registration verification failed')
        return reply.code(400).send({ error: 'Passkey registration could not be verified', code: 'INVALID_PASSKEY' })
      }
    })

    protectedRoutes.delete('/passkeys/:credentialId', {
      config: sensitiveActionLimit,
      schema: {
        params: Type.Object({ credentialId: Type.String() }),
        body: factorChangeConfirmationSchema
      }
    }, async (request, reply) => {
      const { credentialId } = request.params as { credentialId: string }
      const { currentPassword, code } = request.body as { currentPassword: string; code?: string }
      const user = await User.findById(request.user!.userId)
        .select('+hashedPassword +passkeys +totpSecretEncrypted +totpLastUsedStep')
        .exec()
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (user.ssoOnly) {
        return reply.code(409).send({ error: 'Passkeys for SSO-only accounts must be managed by your identity provider', code: 'SSO_ONLY' })
      }
      if (!(await user.validatePassword(currentPassword))) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (!(await confirmMfaStepUp(user, request.user, code))) {
        return reply.code(401).send({ error: 'A current authenticator code is required', code: 'MFA_STEP_UP_REQUIRED' })
      }
      if (!user.passkeys.some(passkey => passkey.credentialId === credentialId)) {
        return reply.code(404).send({ error: 'Passkey not found', code: 'PASSKEY_NOT_FOUND' })
      }

      const authVersion = user.authVersion ?? 0
      const updated = await User.findOneAndUpdate({
        _id: user._id,
        isActive: true,
        'passkeys.credentialId': credentialId,
        ...authVersionCondition(authVersion)
      }, {
        $pull: { passkeys: { credentialId } },
        $inc: { authVersion: 1 },
        $unset: { refreshToken: 1 }
      }, { new: true }).select('+authVersion +passkeys').exec()
      if (!updated) {
        return reply.code(409).send({
          error: 'Security settings changed while removing the passkey. Try again.',
          code: 'PASSKEY_CHANGED'
        })
      }
      await createAuditEntry(request, 'update', 'User', request.user!.userId, {
        after: { passkeyRemoved: true }
      })
      const session = await issueUserSession(fastify, request, updated, 'password', undefined, false)
      return { message: 'Passkey removed', ...session }
    })

    protectedRoutes.post('/mfa/setup', {
      config: sensitiveActionLimit,
      schema: { body: passwordConfirmationSchema }
    }, async (request, reply) => {
      const { currentPassword } = request.body as { currentPassword: string }
      const user = await User.findById(request.user!.userId).select('+hashedPassword').exec()
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (user.ssoOnly) {
        return reply.code(409).send({ error: 'MFA for SSO-only accounts must be managed by your identity provider', code: 'SSO_ONLY' })
      }
      if (!(await user.validatePassword(currentPassword))) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (user.totpEnabled) {
        return reply.code(409).send({ error: 'Two-factor authentication is already enabled', code: 'MFA_ALREADY_ENABLED' })
      }

      const secret = generateTotpSecret()
      user.totpPendingSecretEncrypted = encrypt(secret)
      user.totpPendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await user.save()
      const uri = buildTotpUri(user.email, secret)
      return {
        qrCodeDataUrl: await QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' }),
        manualKey: secret,
        _warning: 'This secret is shown only during setup. Verify a code to finish enrollment.'
      }
    })

    protectedRoutes.post('/mfa/confirm', {
      config: sensitiveActionLimit,
      schema: { body: Type.Object({ code: Type.String({ minLength: 6, maxLength: 8 }) }) }
    }, async (request, reply) => {
      const { code } = request.body as { code: string }
      const user = await User.findById(request.user!.userId)
        .select('+totpPendingSecretEncrypted +totpPendingExpiresAt +authVersion')
        .exec()
      if (!user || !user.isActive || !user.totpPendingSecretEncrypted || !user.totpPendingExpiresAt) {
        return reply.code(400).send({ error: 'Start MFA setup first', code: 'MFA_SETUP_REQUIRED' })
      }
      if (user.totpPendingExpiresAt <= new Date()) {
        await User.updateOne({ _id: user._id }, {
          $unset: { totpPendingSecretEncrypted: 1, totpPendingExpiresAt: 1 }
        })
        return reply.code(400).send({ error: 'MFA setup expired. Start again.', code: 'MFA_SETUP_EXPIRED' })
      }

      const secret = decrypt(user.totpPendingSecretEncrypted)
      const step = verifyTotp(secret, code)
      if (step === null) {
        return reply.code(400).send({ error: 'Authenticator code is invalid', code: 'INVALID_MFA_CODE' })
      }

      const recoveryCodes = generateRecoveryCodes()
      const enrolled = await User.findOneAndUpdate({
        _id: user._id,
        totpEnabled: { $ne: true },
        totpPendingSecretEncrypted: user.totpPendingSecretEncrypted,
        totpPendingExpiresAt: { $gt: new Date() }
      }, {
        $set: {
          totpEnabled: true,
          totpSecretEncrypted: encrypt(secret),
          totpLastUsedStep: step,
          recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
          mfaEnrolledAt: new Date()
        },
        $inc: { authVersion: 1 },
        $unset: { totpPendingSecretEncrypted: 1, totpPendingExpiresAt: 1 }
      }, { new: true }).select('+authVersion').exec()
      if (!enrolled) {
        return reply.code(409).send({ error: 'MFA setup was already completed or replaced', code: 'MFA_SETUP_CHANGED' })
      }

      await createAuditEntry(request, 'update', 'User', request.user!.userId, {
        after: { mfaEnabled: true }
      })
      const session = await issueUserSession(fastify, request, enrolled, 'totp', 'password')
      return {
        recoveryCodes,
        ...session,
        _warning: 'Store these recovery codes securely. They will not be shown again.'
      }
    })

    protectedRoutes.post('/mfa/disable', {
      config: sensitiveActionLimit,
      schema: {
        body: Type.Object({
          currentPassword: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 6, maxLength: 8 })
        })
      }
    }, async (request, reply) => {
      const { currentPassword, code } = request.body as { currentPassword: string; code: string }
      const user = await User.findById(request.user!.userId)
        .select('+hashedPassword +totpSecretEncrypted +totpLastUsedStep +recoveryCodeHashes +authVersion')
        .exec()
      if (!user || !user.isActive || !(await user.validatePassword(currentPassword))) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (!user.totpEnabled || !user.totpSecretEncrypted) {
        return reply.code(409).send({ error: 'Two-factor authentication is not enabled', code: 'MFA_NOT_ENABLED' })
      }
      const step = verifyTotp(decrypt(user.totpSecretEncrypted), code)
      if (step === null || (user.totpLastUsedStep !== undefined && step <= user.totpLastUsedStep)) {
        return reply.code(401).send({ error: 'Invalid or already used authenticator code', code: 'INVALID_MFA_CODE' })
      }

      const disabled = await User.findOneAndUpdate({
        _id: user._id,
        totpEnabled: true,
        $or: [
          { totpLastUsedStep: { $exists: false } },
          { totpLastUsedStep: { $lt: step } }
        ]
      }, {
        $set: { totpEnabled: false, recoveryCodeHashes: [], mfaResetAt: new Date() },
        $inc: { authVersion: 1 },
        $unset: {
          totpSecretEncrypted: 1,
          totpPendingSecretEncrypted: 1,
          totpPendingExpiresAt: 1,
          totpLastUsedStep: 1,
          refreshToken: 1
        }
      }, { new: true }).select('+authVersion').exec()
      if (!disabled) {
        return reply.code(401).send({ error: 'Authenticator code was already used', code: 'MFA_CODE_REPLAYED' })
      }
      await createAuditEntry(request, 'update', 'User', request.user!.userId, {
        after: { mfaEnabled: false, resetBy: 'self' }
      })
      const session = await issueUserSession(fastify, request, disabled, 'totp', 'password', false)
      return { message: 'Two-factor authentication disabled. Other sessions were revoked.', ...session }
    })

    protectedRoutes.post('/mfa/recovery-codes', {
      config: sensitiveActionLimit,
      schema: {
        body: Type.Object({
          currentPassword: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 6, maxLength: 8 })
        })
      }
    }, async (request, reply) => {
      const { currentPassword, code } = request.body as { currentPassword: string; code: string }
      const user = await User.findById(request.user!.userId)
        .select('+hashedPassword +totpSecretEncrypted +totpLastUsedStep +recoveryCodeHashes')
        .exec()
      if (!user || !user.isActive || !(await user.validatePassword(currentPassword))) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (!user.totpEnabled || !user.totpSecretEncrypted) {
        return reply.code(409).send({ error: 'Two-factor authentication is not enabled', code: 'MFA_NOT_ENABLED' })
      }
      const step = verifyTotp(decrypt(user.totpSecretEncrypted), code)
      if (step === null || (user.totpLastUsedStep !== undefined && step <= user.totpLastUsedStep)) {
        return reply.code(401).send({ error: 'Invalid or already used authenticator code', code: 'INVALID_MFA_CODE' })
      }

      const recoveryCodes = generateRecoveryCodes()
      const regenerated = await User.findOneAndUpdate({
        _id: user._id,
        totpEnabled: true,
        $or: [
          { totpLastUsedStep: { $exists: false } },
          { totpLastUsedStep: { $lt: step } }
        ]
      }, {
        $set: {
          totpLastUsedStep: step,
          recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode)
        }
      }, { new: true }).exec()
      if (!regenerated) {
        return reply.code(401).send({ error: 'Authenticator code was already used', code: 'MFA_CODE_REPLAYED' })
      }
      await createAuditEntry(request, 'update', 'User', request.user!.userId, {
        after: { recoveryCodesRegenerated: true }
      })
      return {
        recoveryCodes,
        _warning: 'These codes replace all previous recovery codes and will not be shown again.'
      }
    })

    protectedRoutes.post('/admin/users/:userId/mfa/reset', {
      config: sensitiveActionLimit,
      preHandler: requireRole('admin'),
      schema: {
        params: Type.Object({ userId: Type.String() }),
        body: Type.Object({
          currentPassword: Type.Optional(Type.String({ minLength: 1 })),
          code: Type.Optional(Type.String({ minLength: 6, maxLength: 8 }))
        })
      }
    }, async (request, reply) => {
      const { userId } = request.params as { userId: string }
      const { currentPassword, code } = request.body as { currentPassword?: string; code?: string }
      if (userId === request.user!.userId) {
        return reply.code(400).send({ error: 'Use the self-service MFA controls for your own account', code: 'SELF_RESET_NOT_ALLOWED' })
      }
      const admin = await User.findOne({
        _id: request.user!.userId,
        orgId: request.user!.orgId,
        role: 'admin',
        isActive: true
      }).select('+hashedPassword +totpSecretEncrypted +totpLastUsedStep').exec()
      if (!admin) {
        return reply.code(403).send({ error: 'Administrator role is no longer active', code: 'FORBIDDEN' })
      }
      const recentSso = ['sso', 'totp'].includes(request.user!.authMethod || '')
        && Boolean(request.user!.authTime)
        && request.user!.authTime! >= Math.floor(Date.now() / 1000) - 10 * 60
      const administratorConfirmed = admin.ssoOnly
        ? recentSso
        : Boolean(currentPassword && await admin.validatePassword(currentPassword))
      if (!administratorConfirmed) {
        return reply.code(401).send({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' })
      }
      if (!(await confirmMfaStepUp(admin, request.user, code))) {
        return reply.code(401).send({ error: 'A current authenticator code is required', code: 'MFA_STEP_UP_REQUIRED' })
      }

      const target = await User.findOneAndUpdate({
        _id: userId,
        orgId: request.user!.orgId,
        role: { $ne: 'superAdmin' },
        isActive: true
      }, {
        $set: { totpEnabled: false, mfaResetAt: new Date(), recoveryCodeHashes: [] },
        $inc: { authVersion: 1 },
        $unset: {
          totpSecretEncrypted: 1,
          totpPendingSecretEncrypted: 1,
          totpPendingExpiresAt: 1,
          totpLastUsedStep: 1,
          refreshToken: 1
        }
      }, { new: true }).exec()
      if (!target) {
        return reply.code(404).send({ error: 'User not found in your organization', code: 'USER_NOT_FOUND' })
      }

      await createAuditEntry(request, 'update', 'User', userId, {
        after: { mfaEnabled: false, resetBy: 'organization-admin' }
      })
      return { message: 'Two-factor authentication reset. All existing sessions were revoked immediately.' }
    })
  })
}

export default authSecurityRoutes
