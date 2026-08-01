import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { resumeWorkflowApproval } from '../services/workflowEngine'

// Public (unauthenticated) approve/reject endpoint — the token in the link is
// the bearer credential, mirroring the inbound webhook receiver. Opened from
// the email/Slack approval request; resumes the paused workflow branch.
//
// The decision is made over TWO steps on purpose:
//   GET  /:token  → renders a read-only confirmation page (NO state change).
//   POST /:token  → actually resumes the workflow.
// Corporate mail security gateways and chat unfurlers routinely pre-fetch links
// with GET. Since the token is single-use, a GET that resumed directly could be
// silently auto-consumed (auto-approving/rejecting, or burning the link) before
// the human ever clicks. A confirmation page + POST requires a real human click.
const tokenSchema = Type.Object({
  token: Type.String({ minLength: 16, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' })
})
const decisionQuerySchema = Type.Object({
  decision: Type.Optional(Type.Union([Type.Literal('approve'), Type.Literal('reject')]))
})
const decisionBodySchema = Type.Object({
  decision: Type.Union([Type.Literal('approve'), Type.Literal('reject')])
})
const rateLimit = { max: 30, timeWindow: '1 minute', keyGenerator: (request: any) => request.params.token }

const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  // Read-only: show a confirmation page. Safe for link scanners/prefetch.
  fastify.get('/:token', {
    schema: { params: tokenSchema, querystring: decisionQuerySchema },
    config: { rateLimit }
  }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const { decision } = request.query as { decision?: 'approve' | 'reject' }
    return reply.type('text/html').send(confirmPage(token, decision))
  })

  // State-changing: resume the workflow. Scanners/prefetchers don't POST.
  fastify.post('/:token', {
    schema: { params: tokenSchema, body: decisionBodySchema },
    config: { rateLimit }
  }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const { decision } = request.body as { decision: 'approve' | 'reject' }

    let result: { status: string } | null = null
    try {
      result = await resumeWorkflowApproval(token, decision)
    } catch (err: any) {
      request.log.error({ err: err.message }, '[Approval] resume failed')
      return reply.code(500).type('text/html').send(resultPage('Something went wrong', 'The workflow could not be resumed. Please contact your administrator.', '#f85149'))
    }

    if (!result) {
      return reply.code(404).type('text/html').send(resultPage('Already decided', 'This approval link is no longer valid — it may have been used already.', '#8b949e'))
    }

    const approved = result.status === 'approved'
    return reply.type('text/html').send(resultPage(
      approved ? 'Approved ✓' : 'Rejected ✗',
      approved ? 'The workflow will now continue along the approved path.' : 'The workflow will continue along the rejected path.',
      approved ? '#34d399' : '#f85149'
    ))
  })
}

function shell(inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workflow approval</title></head>
<body style="margin:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="max-width:440px;padding:40px 32px;background:#161b22;border:1px solid #30363d;border-radius:12px;text-align:center">
${inner}
  </div>
</body></html>`
}

// Confirmation page. `token` is a validated safe-charset string (schema-enforced),
// so it is safe to inline into the form action.
function confirmPage(token: string, preselected?: 'approve' | 'reject'): string {
  const button = (decision: 'approve' | 'reject', label: string, color: string, primary: boolean) => `
    <form method="post" action="./${token}" style="display:inline-block;margin:6px">
      <input type="hidden" name="decision" value="${decision}">
      <button type="submit" style="cursor:pointer;border:1px solid ${color};background:${primary ? color : 'transparent'};color:${primary ? '#0d1117' : color};font-size:15px;font-weight:600;padding:11px 26px;border-radius:8px">${label}</button>
    </form>`
  const approveFirst = preselected !== 'reject'
  return shell(`    <h1 style="margin:0 0 10px;color:#e6edf3;font-size:22px">Confirm your decision</h1>
    <p style="margin:0 0 24px;color:#8b949e;font-size:15px;line-height:1.6">A workflow is paused waiting for your review. Choose how it should continue. This link can only be used once.</p>
    <div>${approveFirst
      ? button('approve', 'Approve', '#34d399', true) + button('reject', 'Reject', '#f85149', false)
      : button('reject', 'Reject', '#f85149', true) + button('approve', 'Approve', '#34d399', false)}</div>`)
}

function resultPage(heading: string, body: string, color: string): string {
  return shell(`    <h1 style="margin:0 0 12px;color:${color};font-size:24px">${heading}</h1>
    <p style="margin:0;color:#8b949e;font-size:15px;line-height:1.6">${body}</p>`)
}

export default approvalRoutes
