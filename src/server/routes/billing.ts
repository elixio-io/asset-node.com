import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { authenticate, requireRole } from '../middleware/auth'
import { getOrgId } from '../middleware/tenantScope'
import { getPublicPlans, type PlanKey, PLANS } from '../config/plans'
import {
  startTrial,
  ensureQontoClient,
  generateInvoice,
  cancelSubscription,
  reactivateSubscription,
  getBillingStatus,
  getInvoiceHistory,
  getInvoiceDownloadUrl,
  downgradeExpiredTrials,
  sendTrialWarningEmails,
  verifyInvoiceToken,
} from '../services/billingService'
import {
  sendTrialStartedEmail,
  sendSubscriptionCanceledEmail,
} from '../services/emailService'

const billingRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/plans', async () => {
    return getPublicPlans()
  })

  fastify.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', authenticate)
    protectedScope.addHook('preHandler', requireRole('admin'))

    protectedScope.get('/status', async (request) => {
      const orgId = getOrgId(request)
      return await getBillingStatus(orgId)
    })

    protectedScope.post('/start-trial', {
      schema: {
        body: Type.Object({
          plan: Type.Union([
            Type.Literal('starter'),
            Type.Literal('pro'),
            Type.Literal('enterprise'),
          ]),
          interval: Type.Optional(Type.Union([
            Type.Literal('monthly'),
            Type.Literal('annual'),
          ])),
        }),
      },
    }, async (request, reply) => {
      const orgId = getOrgId(request)
      const { plan, interval } = request.body as { plan: PlanKey; interval?: 'monthly' | 'annual' }

      try {
        const result = await startTrial(orgId, plan, interval)

        const { User } = await import('../../models/User')
        const adminUser = await User.findById(request.user?.userId).lean() as any
        if (adminUser?.email) {
          const planConfig = PLANS[plan]
          sendTrialStartedEmail(
            adminUser.email,
            adminUser.firstName || 'Nutzer',
            planConfig?.name || plan,
            planConfig.trialDays
          ).catch(err => request.log.error({ err }, 'Trial started email failed'))
        }

        return result
      } catch (err: any) {
        return reply.code(400).send({ error: err.message })
      }
    })

    protectedScope.post('/subscribe', {
      schema: {
        body: Type.Object({
          plan: Type.Union([
            Type.Literal('starter'),
            Type.Literal('pro'),
            Type.Literal('enterprise'),
          ]),
          interval: Type.Optional(Type.Union([
            Type.Literal('monthly'),
            Type.Literal('annual'),
          ])),
          billingAddress: Type.Object({
            companyName: Type.String({ minLength: 1 }),
            street: Type.String({ minLength: 1 }),
            city: Type.String({ minLength: 1 }),
            zipCode: Type.String({ minLength: 1 }),
            countryCode: Type.String({ minLength: 2, maxLength: 2 }),
            vatNumber: Type.Optional(Type.String()),
          }),
        }),
      },
    }, async (request, reply) => {
      const orgId = getOrgId(request)
      const { plan, interval, billingAddress } = request.body as {
        plan: PlanKey
        interval?: 'monthly' | 'annual'
        billingAddress: {
          companyName: string
          street: string
          city: string
          zipCode: string
          countryCode: string
          vatNumber?: string
        }
      }

      try {
        const { User } = await import('../../models/User')
        const adminUser = await User.findById(request.user?.userId).lean() as any
        const adminEmail = adminUser?.email
        if (!adminEmail) throw new Error('Billing contact email is missing.')

        const qontoClientId = await ensureQontoClient(orgId, {
          companyName: billingAddress.companyName,
          email: adminEmail,
          street: billingAddress.street,
          city: billingAddress.city,
          zipCode: billingAddress.zipCode,
          countryCode: billingAddress.countryCode,
          vatNumber: billingAddress.vatNumber,
        })
        if (!qontoClientId) throw new Error('Qonto client creation failed. No subscription was changed.')



        const result = await generateInvoice(orgId, {
          plan: plan as Exclude<PlanKey, 'free'>,
          interval: interval || 'monthly',
        })
        return result
      } catch (err: any) {
        return reply.code(400).send({ error: err.message })
      }
    })

    protectedScope.post('/cancel', async (request, reply) => {
      const orgId = getOrgId(request)
      try {
        const result = await cancelSubscription(orgId)

        const { User } = await import('../../models/User')
        const { Organization } = await import('../../models/Organization')
        const adminUser = await User.findById(request.user?.userId).lean() as any
        const org = await Organization.findById(orgId).lean() as any
        if (adminUser?.email && org?.billing) {
          const planConfig = PLANS[(org.plan as PlanKey) || 'free']
          const endDate = org.billing.currentPeriodEnd
            ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(org.billing.currentPeriodEnd))
            : 'Ende der Laufzeit'
          sendSubscriptionCanceledEmail(
            adminUser.email,
            adminUser.firstName || 'Nutzer',
            planConfig?.name || org.plan || 'Plan',
            endDate
          ).catch(err => request.log.error({ err }, 'Cancellation email failed'))
        }

        return result
      } catch (err: any) {
        return reply.code(400).send({ error: err.message })
      }
    })

    protectedScope.post('/reactivate', async (request, reply) => {
      const orgId = getOrgId(request)
      try {
        const result = await reactivateSubscription(orgId)
        return result
      } catch (err: any) {
        return reply.code(400).send({ error: err.message })
      }
    })

    protectedScope.get('/invoices', async (request) => {
      const orgId = getOrgId(request)
      return await getInvoiceHistory(orgId)
    })





    protectedScope.get('/invoices/:invoiceToken/download', {
      schema: {
        params: Type.Object({
          invoiceToken: Type.String(),
        }),
      },
    }, async (request, reply) => {
      const orgId = getOrgId(request)
      const { invoiceToken } = request.params as { invoiceToken: string }

      const invoiceId = verifyInvoiceToken(invoiceToken, orgId)
      if (!invoiceId) {
        return reply.code(403).send({ error: 'Invalid or expired invoice token', code: 'FORBIDDEN' })
      }

      const downloadUrl = await getInvoiceDownloadUrl(invoiceId)

      if (!downloadUrl) {
        return reply.code(404).send({ error: 'Invoice PDF not available' })
      }

      return reply.redirect(downloadUrl)
    })
  })

  const TRIAL_CHECK_INTERVAL = 60 * 60 * 1000
  setInterval(async () => {
    try {
      await downgradeExpiredTrials()
    } catch (err) {
      console.error('[Billing] Trial expiry check failed:', err)
    }
  }, TRIAL_CHECK_INTERVAL)



  const TRIAL_WARNING_INTERVAL = 24 * 60 * 60 * 1000
  setInterval(async () => {
    try {
      await sendTrialWarningEmails()
    } catch (err) {
      console.error('[Billing] Trial-warning run failed:', err)
    }
  }, TRIAL_WARNING_INTERVAL)
}

export default billingRoutes
