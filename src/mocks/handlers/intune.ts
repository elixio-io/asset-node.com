
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createIntuneDevice } from '../factories/devices'
import { getScenario } from '../scenarios'

export const intuneHandlers = [
  http.post(/https:\/\/login\.microsoftonline\.com\/.*\/oauth2\/v2\.0\/token/, async () => {
    const scenario = getScenario()

    if (scenario === 'AUTH_FAILURE') {
      return HttpResponse.json({
        error: 'invalid_client',
        error_description: 'AADSTS7000215: Invalid client secret provided.'
      }, { status: 401 })
    }

    await delay(200)
    return HttpResponse.json({
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: `mock_access_token_${Date.now()}`
    })
  }),

  http.get('https://graph.microsoft.com/v1.0/deviceManagement/managedDevices', async ({ request }) => {
    const scenario = getScenario()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: { code: 'Unauthorized', message: 'No auth token' } }, { status: 401 })
    }

    if (scenario === 'SERVER_ERROR') {
      await delay(500)
      return HttpResponse.json({
        error: { code: 'ServiceNotAvailable', message: 'Service is temporarily unavailable.' }
      }, { status: 503 })
    }

    if (scenario === 'RATE_LIMITED') {
      const key = 'intune_rate_limit_count'
      const count = ((globalThis as any)[key] || 0) + 1
        ; (globalThis as any)[key] = count
      if (count <= 2) {
        return HttpResponse.json(
          { error: { code: 'TooManyRequests', message: 'Rate limit exceeded' } },
          { status: 429, headers: { 'Retry-After': '3' } }
        )
      }
    }

    const url = new URL(request.url)
    const top = parseInt(url.searchParams.get('$top') || '100', 10)
    const skip = parseInt(url.searchParams.get('$skip') || '0', 10)

    const totalCount = scenario === 'LARGE_PAYLOAD' ? 5000 : 120
    const pageSize = Math.min(top, totalCount - skip)
    const devices = createBatch(createIntuneDevice, Math.max(pageSize, 0))

    const hasMore = skip + pageSize < totalCount
    const response: any = { value: devices }
    if (hasMore) {
      response['@odata.nextLink'] =
        `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=${top}&$skip=${skip + pageSize}`
    }

    await delay(200)
    return HttpResponse.json(response)
  })
]
