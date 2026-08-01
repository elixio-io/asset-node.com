
import { http, HttpResponse, delay } from 'msw'
import {
  createBatch,
  createPersonioPerson,
  createPersonioEmployment,
  type PersonioPerson
} from '../factories/employees'
import { getScenario } from '../scenarios'

let cachedPersons: PersonioPerson[] = []

export const personioHandlers = [
  http.post('https://api.personio.de/v2/auth/token', async () => {
    const scenario = getScenario()

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ error: 'invalid_client' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    await delay(100)
    return HttpResponse.json({
      access_token: 'mock-personio-access-token-' + Date.now(),
      token_type: 'Bearer',
      expires_in: 300
    })
  }),

  http.get('https://api.personio.de/v2/persons', async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'personio_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: 'rate_limit_exceeded' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 500 : 45

    if (!cursor) {
      cachedPersons = createBatch(createPersonioPerson, totalCount)
    }

    const startIndex = cursor ? parseInt(cursor, 10) : 0
    const pageData = cachedPersons.slice(startIndex, startIndex + limit)
    const nextIndex = startIndex + limit
    const hasMore = nextIndex < cachedPersons.length

    await delay(150)
    return HttpResponse.json({
      data: pageData,
      pagination: hasMore ? { cursor: String(nextIndex) } : {}
    })
  }),

  http.get(/https:\/\/api\.personio\.de\/v2\/persons\/\d+\/employments/, async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const status = scenario === 'PARTIAL_DATA'
      ? (Math.random() > 0.7 ? 'INACTIVE' : 'ACTIVE')
      : 'ACTIVE'

    await delay(50)
    return HttpResponse.json({
      data: [createPersonioEmployment(status as any)],
      pagination: {}
    })
  })
]
