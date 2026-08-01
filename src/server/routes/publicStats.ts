import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import * as nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const platformPublicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async (_request, reply) => {
    try {
      const [totalAssets, totalOrgs] = await Promise.all([
        Hardware.countDocuments({ deletedAt: null }),
        Organization.countDocuments({ isActive: true })
      ])

      return {
        assets: totalAssets,
        companies: totalOrgs
      }
    } catch (err) {
      reply.code(500).send({ error: 'Failed to fetch platform stats' })
    }
  })

  fastify.post('/contact', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        email: Type.String({ format: 'email', maxLength: 254 }),
        company: Type.Optional(Type.String({ maxLength: 200 })),
        message: Type.String({ minLength: 1, maxLength: 5000 }),
        website: Type.Optional(Type.String()),
      })
    }
  }, async (request, reply) => {
    const { name, email, company, message, website } = request.body as {
      name: string
      email: string
      company?: string
      message: string
      website?: string
    }

    if (website) {
      return { success: true }
    }

    const maintainerEmail = process.env.SMTP_USER
    if (!maintainerEmail) {
      request.log.warn('SMTP_USER not set — contact form submission dropped')
      return reply.code(503).send({ error: 'Contact form is temporarily unavailable.' })
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
      })

      const safeName = escapeHtml(name)
      const safeEmail = escapeHtml(email)
      const safeCompany = escapeHtml(company || '—')
      const safeMessage = escapeHtml(message)

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px">
            <p style="margin:0;color:#a78bfa;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase">AssetNode</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700">New Contact Form Submission</h1>
          </div>
          <div style="padding:28px 32px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;font-weight:600">Name</td><td style="padding:6px 0;font-size:14px;color:#333">${safeName}</td></tr>
              <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;font-weight:600">Email</td><td style="padding:6px 0;font-size:14px;color:#333"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;font-weight:600">Company</td><td style="padding:6px 0;font-size:14px;color:#333">${safeCompany}</td></tr>
            </table>
            <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
              <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${safeMessage}</p>
            </div>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">${new Date().toISOString()}</p>
          </div>
        </div>
      `

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@assetnode.local',
        to: maintainerEmail,
        replyTo: email,
        subject: `[AssetNode] Contact: ${safeName}${company ? ` (${safeCompany})` : ''}`,
        text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || '—'}\n\n${message}`,
        html
      })

      return { success: true }
    } catch (err) {
      request.log.error(err, 'Failed to send contact form email')
      return reply.code(500).send({ error: 'Failed to send message. Please try again.' })
    }
  })
}

export default platformPublicRoutes
