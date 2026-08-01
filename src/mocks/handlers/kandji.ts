
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createKandjiDevice } from '../factories/devices'
import { getScenario } from '../scenarios'

const KANDJI_PATTERN = /https:\/\/.*\.clients\..*\.kandji\.io\/api\/v1\/devices/

export const kandjiHandlers = [
  http.get(KANDJI_PATTERN, async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ error: 'Invalid API token' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'kandji_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '300', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 5000 : 75
    const devices = createBatch(createKandjiDevice, Math.min(limit, totalCount - offset))

    await delay(150)
    return HttpResponse.json(devices)
  })
]
