
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createBambooHREmployee } from '../factories/employees'
import { getScenario } from '../scenarios'

const BAMBOO_PATTERN = /https:\/\/api\.bamboohr\.com\/api\/gateway\.php\/[^/]+\/v1\/employees\/directory/

export const bamboohrHandlers = [
  http.get(BAMBOO_PATTERN, async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'bamboohr_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 2000 : 55
    const employees = createBatch(createBambooHREmployee, totalCount)

    if (scenario === 'PARTIAL_DATA') {
      for (let i = 0; i < 5; i++) {
        const idx = Math.floor(Math.random() * employees.length)
        employees[idx].workEmail = ''
      }
    }

    await delay(200)
    return HttpResponse.json({
      fields: [
        { id: 'displayName', type: 'text', name: 'Display Name' },
        { id: 'firstName', type: 'text', name: 'First Name' },
        { id: 'lastName', type: 'text', name: 'Last Name' },
        { id: 'workEmail', type: 'email', name: 'Work Email' },
        { id: 'department', type: 'list', name: 'Department' },
        { id: 'jobTitle', type: 'list', name: 'Job Title' },
        { id: 'location', type: 'list', name: 'Location' }
      ],
      employees
    })
  })
]
