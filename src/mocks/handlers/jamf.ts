
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createJamfProComputer, createJamfSchoolDevice } from '../factories/devices'
import { getScenario } from '../scenarios'

function checkJamfAuth(request: Request): boolean {
  const auth = request.headers.get('Authorization')
  return !!(auth && (auth.startsWith('Basic ') || auth.startsWith('Bearer ')))
}

export const jamfHandlers = [
  http.post(/https?:\/\/.*\/api\/v1\/auth\/token/, async () => {
    const scenario = getScenario()
    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ httpStatus: 401, errors: [{ description: 'Invalid credentials' }] }, { status: 401 })
    }
    await delay(150)
    return HttpResponse.json({
      token: `mock_jamf_token_${Date.now()}`,
      expires: new Date(Date.now() + 1800000).toISOString()
    })
  }),

  http.get(/https?:\/\/.*\/JSSResource\/computers/, async ({ request }) => {
    const scenario = getScenario()

    if (!checkJamfAuth(request)) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      return HttpResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 4000 : 60
    const computers = createBatch(createJamfProComputer, totalCount)

    await delay(200)
    return HttpResponse.json({
      computers: computers.map(c => ({
        id: c.id,
        name: c.name,
        managed: c.managed,
        username: c.username,
        model: c.model,
        department: c.department,
        building: c.building,
        mac_address: c.mac_address,
        udid: c.udid,
        serial_number: c.serial_number,
        os_version: c.os_version,
        platform: c.platform
      }))
    })
  }),

  http.get(/https?:\/\/.*\/api\/v1\/computers-inventory/, async ({ request }) => {
    const scenario = getScenario()

    if (!checkJamfAuth(request)) {
      return HttpResponse.json({ httpStatus: 401, errors: [{ description: 'Unauthorized' }] }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      return HttpResponse.json({ httpStatus: 500, errors: [{ description: 'Internal error' }] }, { status: 500 })
    }

    const url = new URL(request.url)
    const pageSize = parseInt(url.searchParams.get('page-size') || '100', 10)
    const page = parseInt(url.searchParams.get('page') || '0', 10)

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 4000 : 60
    const count = Math.min(pageSize, totalCount - page * pageSize)
    const computers = createBatch(createJamfProComputer, Math.max(count, 0))

    await delay(200)
    return HttpResponse.json({
      totalCount,
      results: computers
    })
  }),

  http.get(/https?:\/\/.*\/api\/devices/, async ({ request }) => {
    const scenario = getScenario()

    const apiKey = request.headers.get('X-Server-Protocol-Version') ||
      request.headers.get('Authorization')
    if (!apiKey) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      return HttpResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 2000 : 40
    const devices = createBatch(createJamfSchoolDevice, totalCount)

    await delay(150)
    return HttpResponse.json({
      count: totalCount,
      devices
    })
  })
]
