
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import type { SyncResult } from './syncKandji'
import type { IntuneDevice } from '../../mocks/factories/devices'
import { decrypt } from './encryption'
import { resolveStatusId } from './statusResolver'


async function getIntuneToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Intune OAuth error: ${err.error_description || err.error || res.status}`)
  }

  const data = await res.json()
  return data.access_token
}


function mapOsToCategory(os: string, model: string): string {
  const lModel = model.toLowerCase()
  if (os === 'macOS') {
    if (lModel.includes('imac') || lModel.includes('mac mini') || lModel.includes('mac studio') || lModel.includes('mac pro')) return 'desktop'
    return 'laptop'
  }
  if (os === 'iOS') return 'phone'
  if (os === 'iPadOS') return 'tablet'
  if (os === 'Windows') {
    if (lModel.includes('surface pro') || lModel.includes('surface go')) return 'tablet'
    if (lModel.includes('optiplex') || lModel.includes('thinkstation') || lModel.includes('prodesk')) return 'desktop'
    return 'laptop'
  }
  return 'other'
}


async function fetchGraphWithRetry(url: string, token: string, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })

    if (res.ok) return res.json()

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`⏳ Graph API rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`Graph API error ${res.status}: ${body}`)
  }
  throw new Error('Graph API: max retries exceeded')
}


export async function syncIntune(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'intune', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = org.settings?.integrations?.intune
  if (!config?.enabled) throw new Error('Intune integration is not enabled')

  const token = await getIntuneToken(config.tenantId!, config.clientId!, decrypt(config.clientSecret!))

  const allDevices: IntuneDevice[] = []
  let url: string | null = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=100'

  while (url) {
    const data = await fetchGraphWithRetry(url, token)
    if (data.value) allDevices.push(...data.value)
    url = data['@odata.nextLink'] || null
  }

  console.log(`💻 Intune: fetched ${allDevices.length} managed devices`)

  const availableStatusId = await resolveStatusId(orgId, 'available')
  const defectiveStatusId = await resolveStatusId(orgId, 'defective')

  for (const device of allDevices) {
    try {
      if (!device.serialNumber) {
        result.errors.push(`Device ${device.id}: missing serial number, skipped`)
        continue
      }

      const category = mapOsToCategory(device.operatingSystem, device.model)
      const existing = await Hardware.findOne({ orgId, serialNumber: device.serialNumber })

      if (existing) {
        ;(existing as any).model = device.model
        ;(existing as any).manufacturer = device.manufacturer
        ;(existing as any).category = category
        existing.tags = [...new Set([...(existing.tags || []), 'intune-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'intune')
        existing.customFields.set('mdmDeviceId', device.id)
        existing.customFields.set('osVersion', device.osVersion)
        existing.customFields.set('complianceState', device.complianceState)
        existing.customFields.set('lastSyncDateTime', device.lastSyncDateTime)
        existing.customFields.set('ownerType', device.managedDeviceOwnerType)
        await existing.save()
        result.updated++
      } else {
        await Hardware.create({
          orgId,
          serialNumber: device.serialNumber,
          model: device.model,
          category,
          manufacturer: device.manufacturer,
          statusId: device.complianceState === 'noncompliant' ? defectiveStatusId : availableStatusId,
          purchaseDate: new Date(device.enrolledDateTime),
          tags: ['intune-synced'],
          customFields: new Map([
            ['mdmProvider', 'intune'],
            ['mdmDeviceId', device.id],
            ['osVersion', device.osVersion],
            ['complianceState', device.complianceState],
            ['lastSyncDateTime', device.lastSyncDateTime],
            ['ownerType', device.managedDeviceOwnerType]
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
    { $set: { 'settings.integrations.intune.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Intune sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
