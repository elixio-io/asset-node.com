import { createServiceLogger } from './logger'


const log = createServiceLogger('Support')

interface GitLabConfig {
  apiUrl: string
  projectId: string
  token: string
  configured: boolean
}

function readConfig(): GitLabConfig {
  const apiUrl = (process.env.SUPPORT_GITLAB_API_URL || '').trim()
  const projectId = (process.env.SUPPORT_GITLAB_PROJECT_ID || '').trim()
  const token = (process.env.SUPPORT_GITLAB_ACCESS_TOKEN || '').trim()
  return { apiUrl, projectId, token, configured: !!(apiUrl && projectId && token) }
}

export function isGitLabTicketingConfigured(): boolean {
  return readConfig().configured
}

export interface CreateIssueInput {
  title: string
  description: string
  labels?: string[]
}

export interface CreateIssueResult {
  ok: boolean
  internalIid?: number
}

export async function createGitLabIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
  const cfg = readConfig()
  if (!cfg.configured) {
    log.warn('Ticket sink disabled (config missing)')
    return { ok: false }
  }

  let status = 0
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const base = cfg.apiUrl.replace(/\/$/, '')
    const url = `${base}/projects/${encodeURIComponent(cfg.projectId)}/issues`

    const body = JSON.stringify({
      title: input.title,
      description: input.description,
      labels: (input.labels || []).join(','),
      confidential: true,
    })

    const res = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': cfg.token,
      },
      body,
      signal: controller.signal,
    })
    status = res.status

    if (!res.ok) {
      log.warn({ status }, 'Ticket sink: non-2xx')
      return { ok: false }
    }

    const data = await res.json() as { iid?: number }
    if (typeof data.iid !== 'number') {
      log.warn({ status }, 'Ticket sink: response missing iid')
      return { ok: false }
    }

    log.info({ result: 'created' }, 'Ticket forwarded')
    return { ok: true, internalIid: data.iid }
  } catch (err) {



    log.error(
      { errName: (err as Error)?.name || 'Error', status },
      'Ticket sink threw'
    )
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}
