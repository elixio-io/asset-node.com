
import { http, HttpResponse, delay } from 'msw'
import {
  createBatch,
  createGoogleWorkspaceUser,
  type GoogleWorkspaceUser
} from '../factories/employees'
import { getScenario } from '../scenarios'

let cachedUsers: GoogleWorkspaceUser[] = []

export const googleWorkspaceHandlers = [
  http.post('https://oauth2.googleapis.com/token', async () => {
    const scenario = getScenario()

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({
        error: 'invalid_grant',
        error_description: 'Invalid JWT Signature.'
      }, { status: 400 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ error: 'internal_failure' }, { status: 500 })
    }

    await delay(100)
    return HttpResponse.json({
      access_token: 'mock-google-access-token-' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600
    })
  }),

  http.get('https://admin.googleapis.com/admin/directory/v1/users', async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: { message: 'Request is missing required authentication credential.' } }, { status: 401 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'google_workspace_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: { message: 'Rate Limit Exceeded' } },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const url = new URL(request.url)
    const pageToken = url.searchParams.get('pageToken')
    const maxResults = parseInt(url.searchParams.get('maxResults') || '500', 10)
    const domain = url.searchParams.get('domain') || 'acme.com'

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 2500 : 70

    if (!pageToken) {
      cachedUsers = createBatch(() => createGoogleWorkspaceUser(domain), totalCount)

      if (scenario !== 'PARTIAL_DATA') {
        for (let i = 0; i < 5; i++) {
          cachedUsers[Math.floor(Math.random() * cachedUsers.length)].suspended = true
        }
      }
    }

    const startIndex = pageToken ? parseInt(pageToken, 10) : 0
    const pageUsers = cachedUsers.slice(startIndex, startIndex + maxResults)
    const nextIndex = startIndex + maxResults
    const hasMore = nextIndex < cachedUsers.length

    await delay(150)
    const response: Record<string, any> = {
      users: pageUsers,
      kind: 'admin#directory#users'
    }
    if (hasMore) {
      response.nextPageToken = String(nextIndex)
    }

    return HttpResponse.json(response)
  })
]
