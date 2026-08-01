import 'dotenv/config'

try { globalThis.localStorage } catch {
  const _store = new Map<string, string>()
    ; (globalThis as any).localStorage = {
      getItem: (k: string) => _store.get(k) ?? null,
      setItem: (k: string, v: string) => _store.set(k, v),
      removeItem: (k: string) => _store.delete(k),
      clear: () => _store.clear(),
      get length() { return _store.size },
      key: (i: number) => [..._store.keys()][i] ?? null
    }
}

if (process.env.MOCK_INTEGRATIONS === 'true') {
  const { startMockServer } = await import('../mocks/server.js')
  startMockServer()
}

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { connectDB } from '../db/connection'
import sanitizePlugin from './middleware/sanitize'
import { authenticate, requireSuperAdmin } from './middleware/auth'
import requestContextPlugin from './middleware/requestContext'

import hardwareRoutes from './routes/hardware'
import assignmentRoutes from './routes/assignments'
import peripheralRoutes from './routes/peripherals'
import maintenanceRoutes from './routes/maintenance'
import aiLogRoutes from './routes/aiLogs'
import dashboardRoutes from './routes/dashboard'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import locationRoutes from './routes/locations'
import reportRoutes from './routes/reports'
import labelRoutes from './routes/labels'
import auditWorkflowRoutes from './routes/audits'
import orgSettingsRoutes from './routes/orgSettings'
import myItemsRoutes from './routes/myItems'
import directReportsRoutes from './routes/directReports'
import onboardingRoutes from './routes/onboarding'
import licenseRoutes from './routes/licenses'
import consumableRoutes from './routes/consumables'
import gdprRoutes from './routes/gdpr'
import notificationRoutes from './routes/notifications'
import webhookRoutes from './routes/webhooks'
import apiKeyRoutes from './routes/apiKeys'
import manufacturerRoutes from './routes/manufacturers'
import supplierRoutes from './routes/suppliers'
import kitRoutes from './routes/kits'
import componentRoutes from './routes/components'
import importRoutes from './routes/import'
import recycleBinRoutes from './routes/recycleBin'
import categoryRoutes from './routes/categories'
import statusRoutes from './routes/statuses'
import departmentRoutes from './routes/departments'
import depreciationRoutes from './routes/depreciations'
import customFieldRoutes from './routes/customFields'
import getStartedRoutes from './routes/getStarted'
import scimRoutes from './routes/scim'
import integrationRoutes from './routes/integrations'
import marketplaceRoutes from './routes/marketplace'
import auditLogRoutes from './routes/auditLog'
import superAdminRoutes from './routes/superAdmin'
import workflowRoutes from './routes/workflows'
import webhookTriggerRoutes from './routes/webhookTriggers'
import approvalRoutes from './routes/approvals'
import publicStatsRoutes from './routes/publicStats'
import billingRoutes from './routes/billing'
import procurementRoutes from './routes/procurement'
import inviteRoutes from './routes/invites'
import supportTicketRoutes from './routes/supportTickets'
import marketPricingRoutes from './routes/marketPricing'

const PORT = parseInt(process.env.PORT || '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

async function startServer() {
  try {
    await connectDB()

    const isProd = process.env.NODE_ENV === 'production'
    if (isProd && !process.env.APP_URL) {
      console.error('❌ APP_URL is required in production. Set the public-facing URL (e.g. https://app.yourcompany.com).')
      process.exit(1)
    }
    if (isProd && !process.env.ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY is required in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
      process.exit(1)
    }
    if (isProd && !process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is required in production.')
      process.exit(1)
    }
    if (isProd && !process.env.JWT_REFRESH_SECRET) {
      console.error('❌ JWT_REFRESH_SECRET is required in production.')
      process.exit(1)
    }
    if (!isProd) {
      if (!process.env.APP_URL) console.warn('⚠️ APP_URL not set — SCIM endpoint URLs will be empty in wizard')
      if (!process.env.ENCRYPTION_KEY) console.warn('⚠️ ENCRYPTION_KEY not set — credentials stored in plaintext (dev mode)')
    }

    const fastify = Fastify({





      logger: {
        level: isProd ? 'info' : 'debug',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'req.headers["x-forwarded-for"]',
            'headers.authorization',
            'headers.cookie',
            '*.password',
            '*.token',
            '*.secret',
            '*.apiKey',
            '*.apiToken',
            '*.accessToken',
            '*.refreshToken',
            '*.clientSecret',
            '*.privateKey',
            '*.serviceAccountKey',
            '*.email',
            '*.userEmail',
            '*.phone',
            '*.gitlabIssueIid',
            '*.gitlabProjectId',
            '*.gitlabAccessToken',
            '*.externalTicketId',
            '*.currentPassword',
            '*.ceremonyToken',
            '*.challengeToken',
            '*.recoveryCode',
            'body.code',
            'body.password',
            'body.currentPassword',
            'body.ceremonyToken',
            'body.challengeToken',
            'body.recoveryCode',
            'body.token',
            'body.apiKey',
            'body.email',
          ],
          censor: '[REDACTED]',
          remove: false,
        },
        serializers: {



          err: (err: Error & { code?: string | number; statusCode?: number }) => {
            const rawMsg = String(err?.message || '').slice(0, 200)
            const safeMsg = rawMsg.replace(
              /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
              '[JWT]'
            )
            return {
              type: err?.name || 'Error',
              message: safeMsg,
              code: err?.code,
              statusCode: err?.statusCode,
              ...(isProd ? {} : { stack: err?.stack }),
            }
          },
        },
      },



      ajv: {
        customOptions: {
          removeAdditional: true
        }
      }
    }).withTypeProvider<TypeBoxTypeProvider>()




    process.on('unhandledRejection', (reason) => {
      const r = reason as Error | undefined
      fastify.log.error(
        {
          errType: r?.name || 'UnhandledRejection',
          errMessage: String(r?.message || '').slice(0, 200),
        },
        'Unhandled promise rejection'
      )
    })
    process.on('uncaughtException', (err) => {
      fastify.log.fatal(
        {
          errType: err?.name || 'UncaughtException',
          errMessage: String(err?.message || '').slice(0, 200),
        },
        'Uncaught exception — shutting down'
      )
      fastify.close().finally(() => process.exit(1))
    })


    await fastify.register(helmet, {
      contentSecurityPolicy: isProd ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://static.cloudflareinsights.com', 'https://assets.calendly.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://assets.calendly.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", CORS_ORIGIN, `https://api.${process.env.BASE_DOMAIN || 'asset-node.com'}`, 'https://calendly.com'],
          frameSrc: ["'self'", 'https://calendly.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'", 'https://accounts.google.com', 'https://login.microsoftonline.com']
        }
      } : false,
      crossOriginEmbedderPolicy: false
    })

    await fastify.register(cors, {
      origin: process.env.NODE_ENV === 'production'
        ? (origin, cb) => {
            const baseDomain = process.env.BASE_DOMAIN || 'asset-node.com'
            const allowed = [
              CORS_ORIGIN,
              `https://${baseDomain}`,
              `https://www.${baseDomain}`
            ]
            cb(null, !origin || allowed.includes(origin))
          }
        : (origin, cb) => {
            if (!origin || origin.startsWith('http://localhost') || /\.asset-node\.com$/.test(new URL(origin).hostname)) {
              cb(null, true)
            } else {
              cb(null, false)
            }
          },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true
    })




    await fastify.register(rateLimit, {
      global: false
    })

    fastify.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
      request.log.error(error)
      const statusCode = error.statusCode ?? 500
      if (statusCode === 429) {
        return reply.code(429).send({
          error: error.message || 'Too Many Requests',
          code: 'RATE_LIMITED'
        })
      }
      if (statusCode >= 500) {
        reply.code(statusCode).send({
          error: 'Internal Server Error',
          code: 'SERVER_ERROR'
        })
      } else {
        reply.code(statusCode).send({
          error: error.message,
          code: error.code || 'REQUEST_ERROR'
        })
      }
    })

    await fastify.register(sanitizePlugin)

    await fastify.register(requestContextPlugin)

    await fastify.register(import('@fastify/formbody'))

    await fastify.register(import('@fastify/multipart'), {
      limits: {
        fileSize: 10 * 1024 * 1024
      }
    })


    fastify.register(authRoutes, { prefix: '/api/auth' })

    fastify.register(hardwareRoutes, { prefix: '/api/hardware' })
    fastify.register(assignmentRoutes, { prefix: '/api/assignments' })
    fastify.register(peripheralRoutes, { prefix: '/api/peripherals' })
    fastify.register(maintenanceRoutes, { prefix: '/api/maintenance' })
    fastify.register(aiLogRoutes, { prefix: '/api/ai-logs' })
    fastify.register(marketPricingRoutes, { prefix: '/api/ai' })
    fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })
    fastify.register(employeeRoutes, { prefix: '/api/employees' })
    fastify.register(locationRoutes, { prefix: '/api/locations' })
    fastify.register(reportRoutes, { prefix: '/api/reports' })
    fastify.register(labelRoutes, { prefix: '/api/labels' })
    fastify.register(auditWorkflowRoutes, { prefix: '/api/audits' })
    fastify.register(orgSettingsRoutes, { prefix: '/api/org-settings' })
    fastify.register(myItemsRoutes, { prefix: '/api/my-items' })
    fastify.register(directReportsRoutes, { prefix: '/api/direct-reports' })
    fastify.register(onboardingRoutes, { prefix: '/api/onboarding' })
    fastify.register(licenseRoutes, { prefix: '/api/licenses' })
    fastify.register(consumableRoutes, { prefix: '/api/consumables' })
    fastify.register(gdprRoutes, { prefix: '/api/gdpr' })
    fastify.register(notificationRoutes, { prefix: '/api/notifications' })
    fastify.register(webhookRoutes, { prefix: '/api/webhooks' })
    fastify.register(apiKeyRoutes, { prefix: '/api/api-keys' })
    fastify.register(manufacturerRoutes, { prefix: '/api/manufacturers' })
    fastify.register(supplierRoutes, { prefix: '/api/suppliers' })
    fastify.register(kitRoutes, { prefix: '/api/kits' })
    fastify.register(componentRoutes, { prefix: '/api/components' })
    fastify.register(importRoutes, { prefix: '/api/import' })
    fastify.register(recycleBinRoutes, { prefix: '/api/recycle-bin' })
    fastify.register(categoryRoutes, { prefix: '/api/categories' })
    fastify.register(statusRoutes, { prefix: '/api/statuses' })
    fastify.register(departmentRoutes, { prefix: '/api/departments' })
    fastify.register(depreciationRoutes, { prefix: '/api/depreciations' })
    fastify.register(customFieldRoutes, { prefix: '/api/custom-fields' })
    fastify.register(getStartedRoutes, { prefix: '/api/get-started' })

    fastify.register(scimRoutes, { prefix: '/api/scim/v2' })
    fastify.register(integrationRoutes, { prefix: '/api/integrations' })
    fastify.register(integrationRoutes, { prefix: '/api/organization/integrations' })
    fastify.register(marketplaceRoutes, { prefix: '/api/marketplace' })
    fastify.register(auditLogRoutes, { prefix: '/api/audit-log' })
    fastify.register(workflowRoutes, { prefix: '/api/workflows' })
    fastify.register(webhookTriggerRoutes, { prefix: '/api/hooks' })
    fastify.register(approvalRoutes, { prefix: '/api/approvals' })

    fastify.register(billingRoutes, { prefix: '/api/billing' })

    fastify.register(procurementRoutes, { prefix: '/api/procurement' })
    fastify.register(inviteRoutes, { prefix: '/api/invites' })

    fastify.register(supportTicketRoutes, { prefix: '/api/support' })

    fastify.register(superAdminRoutes, { prefix: '/api/super-admin' })

    fastify.get('/health', async () => {
      const { default: mongoose } = await import('mongoose')
      const dbReady = mongoose.connection.readyState === 1
      return {
        status: dbReady ? 'ok' : 'degraded',
        db: dbReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      }
    })

    fastify.get('/health/smtp', {
      preHandler: [authenticate, requireSuperAdmin]
    }, async (request, reply) => {
      const { to } = request.query as { to?: string }

      const config = {
        SMTP_HOST: process.env.SMTP_HOST || '(not set)',
        SMTP_PORT: process.env.SMTP_PORT || '(not set)',
        SMTP_SECURE: process.env.SMTP_SECURE || '(not set)',
        SMTP_USER: process.env.SMTP_USER ? '✅ set' : '❌ not set',
        SMTP_PASS: process.env.SMTP_PASS ? '✅ set' : '❌ not set',
        SMTP_FROM: process.env.SMTP_FROM || '(not set)',
      }

      let verifyResult = 'skipped'
      let sendResult = 'skipped'
      try {
        const nodemailer = await import('nodemailer')
        if (!process.env.SMTP_HOST) {
          return { config, verify: 'NO SMTP_HOST — dev mode', send: 'skipped' }
        }
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
        })

        await transporter.verify()
        verifyResult = '✅ SMTP connection verified'

        if (to) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'test@localhost',
            to,
            subject: 'AssetNode SMTP Test',
            text: `SMTP test at ${new Date().toISOString()}. If you see this, email delivery works!`,
            html: `<p>SMTP test at <strong>${new Date().toISOString()}</strong>.</p><p>If you see this, email delivery works! ✅</p>`
          })
          sendResult = `✅ Test email sent to ${to}`
        }
      } catch (err: any) {
        const errorDetail = {
          message: err.message,
          code: err.code,
          command: err.command,
          responseCode: err.responseCode,
          response: err.response,
        }
        if (verifyResult === 'skipped') {
          verifyResult = `❌ SMTP verify failed: ${JSON.stringify(errorDetail)}`
        } else {
          sendResult = `❌ Send failed: ${JSON.stringify(errorDetail)}`
        }
      }

      return { config, verify: verifyResult, send: sendResult }
    })

    fastify.register(publicStatsRoutes, { prefix: '/api/public' })

    fastify.get('/robots.txt', async (_request, reply) => {
      const baseDomain = process.env.BASE_DOMAIN || 'asset-node.com'
      reply.type('text/plain').send([
        'User-agent: *',
        'Crawl-delay: 1',
        'Allow: /',
        '',
        '# Auth pages and authenticated app routes are not indexable',
        'Disallow: /sign-in',
        'Disallow: /sign-up',
        'Disallow: /api/',
        'Disallow: /dashboard',
        'Disallow: /hardware',
        'Disallow: /assignments',
        'Disallow: /available',
        'Disallow: /defective',
        'Disallow: /employees',
        'Disallow: /settings',
        'Disallow: /billing',
        'Disallow: /profile',
        'Disallow: /company-profile',
        'Disallow: /procurement',
        'Disallow: /licenses',
        'Disallow: /consumables',
        'Disallow: /departments',
        'Disallow: /locations',
        'Disallow: /manufacturers',
        'Disallow: /maintenance',
        'Disallow: /audits',
        'Disallow: /recycle-bin',
        'Disallow: /my-items',
        'Disallow: /admin',
        'Disallow: /super-admin',
        '',
        `Sitemap: https://${baseDomain}/sitemap.xml`
      ].join('\n'))
    })

    fastify.get('/sitemap.xml', async (_request, reply) => {
      const baseDomain = process.env.BASE_DOMAIN || 'asset-node.com'
      const baseUrl = `https://${baseDomain}`
      const now = new Date().toISOString().split('T')[0]

      const pages = [
        { loc: '/',                              priority: '1.0', changefreq: 'weekly' },
        { loc: '/pricing',                       priority: '0.9', changefreq: 'weekly' },
        { loc: '/integrations',                  priority: '0.8', changefreq: 'monthly' },
        { loc: '/blog',                          priority: '0.8', changefreq: 'weekly' },
        { loc: '/blog/snipe-it-vs-assetnode',    priority: '0.8', changefreq: 'monthly' },
        { loc: '/blog/bluetally-vs-assetnode',   priority: '0.8', changefreq: 'monthly' },
        { loc: '/blog/excel-vs-itam',            priority: '0.7', changefreq: 'monthly' },
        { loc: '/blog/it-offboarding-checkliste', priority: '0.7', changefreq: 'monthly' },
        { loc: '/blog/dsgvo-it-asset-management', priority: '0.7', changefreq: 'monthly' },
        { loc: '/blog/laptop-onboarding',         priority: '0.7', changefreq: 'monthly' },
        { loc: '/about',                         priority: '0.6', changefreq: 'monthly' },
        { loc: '/faq',                           priority: '0.6', changefreq: 'monthly' },
        { loc: '/api-docs',                      priority: '0.5', changefreq: 'monthly' },
        { loc: '/changelog',                     priority: '0.5', changefreq: 'weekly' },
        { loc: '/careers',                       priority: '0.3', changefreq: 'monthly' },
        { loc: '/privacy-policy',                priority: '0.2', changefreq: 'yearly' },
        { loc: '/terms',                         priority: '0.2', changefreq: 'yearly' },
        { loc: '/imprint',                       priority: '0.2', changefreq: 'yearly' },
      ]

      const urls = pages.map(p => `  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')

      reply.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`)
    })

    if (process.env.NODE_ENV === 'production') {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const distPath = join(__dirname, '..', '..', 'dist')

      await fastify.register(fastifyStatic, {
        root: distPath,
        prefix: '/'
      })



      fastify.setNotFoundHandler(async (request, reply) => {
        const host = request.hostname || ''
        if (host.startsWith('api.') || request.url.startsWith('/api/')) {
          return reply.code(404).send({ error: 'Not found', code: 'NOT_FOUND' })
        }
        return reply.sendFile('index.html')
      })
    }



    try {
      const { migrateTriggerToTriggers } = await import('../db/migrations/triggerToTriggers')
      await migrateTriggerToTriggers()
      const { fixAssetIndexes } = await import('../db/migrations/assetIndexes')
      await fixAssetIndexes()
      const { workflowEventBus, refreshCronWorkflows } = await import('./services/workflowEventBus')
      await workflowEventBus.initialize()
      await refreshCronWorkflows()
      console.log('⚡ Workflow automation engine ready')
    } catch (err) {
      console.warn('⚠️ Workflow engine initialization failed (non-fatal):', err)
    }

    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Server is running on http://localhost:${PORT}`)



    try {
      const { startSupportTicketDeliveryWorker } = await import('./services/supportTicketDelivery')
      startSupportTicketDeliveryWorker()
      console.log('🎫 Support-ticket delivery worker started')
    } catch (err) {
      console.warn('⚠️ Support-ticket delivery worker initialization failed (non-fatal):', err)
    }

    try {
      const { startPaymentMatcher } = await import('./services/paymentMatcher')
      const { startBillingLifecycleCron } = await import('./services/billingService')
      startPaymentMatcher()
      startBillingLifecycleCron()
      console.log('💳 Qonto payment matcher started')
    } catch (err) {
      console.warn('⚠️ Payment matcher initialization failed (non-fatal):', err)
    }

    try {
      const { startTrialGuidanceCron } = await import('./services/trialGuidanceService')
      const { startSmartAutomationsCron } = await import('./services/smartAutomationsWorker')
      startTrialGuidanceCron()
      console.log('📬 Trial guidance drip cron started')
    } catch (err) {
      console.warn('⚠️ Trial guidance cron initialization failed (non-fatal):', err)
    }
  } catch (error) {
    console.error('Error starting server:', error)
    process.exit(1)
  }
}

startServer()
