
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createHiBobEmployee } from '../factories/employees'
import { getScenario } from '../scenarios'

export const hibobHandlers = [
  http.get('https://api.hibob.com/v1/people', async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'hibob_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 1500 : 40
    const employees = createBatch(createHiBobEmployee, totalCount)

    if (scenario === 'PARTIAL_DATA') {
      for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * employees.length)
        employees[idx].email = ''
      }
    }

    await delay(150)
    return HttpResponse.json({
      employees
    })
  })
]
