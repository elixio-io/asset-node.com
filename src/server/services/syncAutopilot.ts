
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import { resolveStatusId } from './statusResolver'
import type { SyncResult } from './syncKandji'
import type { AutopilotDevice } from '../../mocks/factories/devices'
import { decrypt } from './encryption'


async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    }).toString()
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`OAuth error: ${err.error_description || res.status}`)
  }

  return (await res.json()).access_token
}


function mapManufacturer(model: string): string {
  const lModel = model.toLowerCase()
  if (lModel.includes('surface')) return 'Microsoft Corporation'
  if (lModel.includes('thinkpad') || lModel.includes('thinkstation') || lModel.includes('lenovo')) return 'Lenovo'
  if (lModel.includes('dell') || lModel.includes('latitude') || lModel.includes('xps') || lModel.includes('optiplex')) return 'Dell Inc.'
  if (lModel.includes('hp') || lModel.includes('elitebook') || lModel.includes('zbook') || lModel.includes('prodesk')) return 'HP'
  return 'Unknown'
}


export async function syncAutopilot(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'autopilot', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)


  async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<any> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(url, { headers })

      if (res.ok) return res.json()

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
        console.warn(`⏳ Autopilot rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        continue
      }

      const body = await res.text()
      throw new Error(`Autopilot API error ${res.status}: ${body}`)
    }
    throw new Error('Autopilot API: max retries exceeded')
  }

  const config = org.settings?.integrations?.autopilot
  if (!config?.enabled) throw new Error('Autopilot integration is not enabled')

  const token = await getGraphToken(config.tenantId!, config.clientId!, decrypt(config.clientSecret!))

  const allDevices: AutopilotDevice[] = []
  let url: string | null = 'https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities?$top=100'

  while (url) {
    const data = await fetchWithRetry(url, {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    })
    if (data.value) allDevices.push(...data.value)
    url = data['@odata.nextLink'] || null
  }

  console.log(`🪟 Autopilot: fetched ${allDevices.length} device identities`)

  const availableStatusId = await resolveStatusId(orgId, 'available')

  for (const device of allDevices) {
    try {
      const manufacturer = device.manufacturer || mapManufacturer(device.model)
      const existing = await Hardware.findOne({ orgId, serialNumber: device.serialNumber })

      if (existing) {
        ;(existing as any).model = device.model
        ;(existing as any).manufacturer = manufacturer
        existing.tags = [...new Set([...(existing.tags || []), 'autopilot-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'autopilot')
        existing.customFields.set('autopilotId', device.id)
        existing.customFields.set('groupTag', device.groupTag || '')
        existing.customFields.set('purchaseOrder', device.purchaseOrderIdentifier || '')
        existing.customFields.set('enrollmentState', device.enrollmentState?.value || 'unknown')
        await existing.save()
        result.updated++
      } else {
        const lModel = device.model.toLowerCase()
        const category = (lModel.includes('surface pro') || lModel.includes('surface go')) ? 'tablet'
          : (lModel.includes('optiplex') || lModel.includes('thinkstation')) ? 'desktop'
            : 'laptop'

        await Hardware.create({
          orgId,
          serialNumber: device.serialNumber,
          model: device.model,
          category,
          manufacturer,
          statusId: availableStatusId,
          purchaseDate: new Date(device.lastContactedDateTime || Date.now()),
          tags: ['autopilot-synced'],
          customFields: new Map([
            ['mdmProvider', 'autopilot'],
            ['autopilotId', device.id],
            ['groupTag', device.groupTag || ''],
            ['purchaseOrder', device.purchaseOrderIdentifier || ''],
            ['enrollmentState', device.enrollmentState?.value || 'unknown']
          ])
        })
        result.created++
      }
    } catch (err: any) {
      result.errors.push(`Device ${device.serialNumber}: ${err.message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.autopilot.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Autopilot sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
