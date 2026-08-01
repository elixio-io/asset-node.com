
import { http, HttpResponse, delay } from 'msw'
import { createBatch, createAutopilotDevice } from '../factories/devices'
import { getScenario } from '../scenarios'

export const autopilotHandlers = [
  http.get(
    'https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities',
    async ({ request }) => {
      const scenario = getScenario()

      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json({ error: { code: 'Unauthorized', message: 'No auth token' } }, { status: 401 })
      }

      if (scenario === 'AUTH_FAILURE') {
        return HttpResponse.json(
          { error: { code: 'InvalidAuthenticationToken', message: 'Access token is invalid.' } },
          { status: 401 }
        )
      }

      if (scenario === 'SERVER_ERROR') {
        return HttpResponse.json(
          { error: { code: 'ServiceNotAvailable', message: 'Service unavailable' } },
          { status: 503 }
        )
      }

      if (scenario === 'RATE_LIMITED') {
        const count = ((globalThis as any).autopilot_rate_limit_count || 0) as number
          ; (globalThis as any).autopilot_rate_limit_count = count + 1

        if (count < 2) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '1' }
          })
        }
      }

      const url = new URL(request.url)
      const top = parseInt(url.searchParams.get('$top') || '100', 10)
      const skip = parseInt(url.searchParams.get('$skip') || '0', 10)

      const totalCount = scenario === 'LARGE_PAYLOAD' ? 3000 : 45
      const pageSize = Math.min(top, totalCount - skip)

      let devices
      if (scenario === 'PARTIAL_DATA') {
        devices = createBatch(createAutopilotDevice, Math.max(pageSize, 0)).map((d, i) => {
          if (i % 3 === 0) return { ...d, serialNumber: '', manufacturer: null }
          if (i % 5 === 0) return { ...d, model: '' }
          return d
        })
      } else {
        devices = createBatch(createAutopilotDevice, Math.max(pageSize, 0))
      }

      const hasMore = skip + pageSize < totalCount
      const response: any = { value: devices }
      if (hasMore) {
        response['@odata.nextLink'] =
          `https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities?$top=${top}&$skip=${skip + pageSize}`
      }

      await delay(150)
      return HttpResponse.json(response)
    }
  )
]
