
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createMosyleDevice } from '../factories/employees'
import { getScenario } from '../scenarios'

export const mosyleHandlers = [
  http.post('https://managerapi.mosyle.com/v2/listdevices', async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ status: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ status: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ status: 'ERROR' }, { status: 500 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'mosyle_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { status: 'TOO_MANY_REQUESTS' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    let page = 0
    try {
      const body = await request.json() as any
      page = body?.options?.page || 0
    } catch {  }

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 3000 : 60
    const pageSize = 100
    const remaining = Math.max(0, totalCount - page * pageSize)
    const devices = createBatch(createMosyleDevice, Math.min(pageSize, remaining))

    await delay(150)
    return HttpResponse.json({
      status: 'OK',
      response: [{
        status: 'OK',
        devices
      }]
    })
  })
]
