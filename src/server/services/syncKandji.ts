
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import type { KandjiDevice } from '../../mocks/factories/devices'
import { decrypt } from './encryption'
import { resolveStatusId } from './statusResolver'


function mapPlatformToCategory(platform: string, model: string): string {
  if (platform === 'iPhone') return 'phone'
  if (platform === 'iPad') return 'tablet'
  if (platform === 'AppleTV') return 'other'
  if (model.toLowerCase().includes('imac') || model.toLowerCase().includes('mac mini') ||
    model.toLowerCase().includes('mac studio') || model.toLowerCase().includes('mac pro')) {
    return 'desktop'
  }
  return 'laptop'
}


async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers })

    if (res.ok) return res.json()

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`⏳ Kandji rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`Kandji API error ${res.status}: ${body}`)
  }
  throw new Error('Kandji API: max retries exceeded')
}


export interface SyncResult {
  provider: string
  created: number
  updated: number
  errors: string[]
  duration: number
}

export async function syncKandji(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'kandji', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = org.settings?.integrations?.kandji
  if (!config?.enabled) throw new Error('Kandji integration is not enabled')

  const baseUrl = `https://${config.subdomain}.clients.us-1.kandji.io/api/v1`
  const headers = { Authorization: `Bearer ${decrypt(config.apiToken!)}`, 'Content-Type': 'application/json' }

  const allDevices: KandjiDevice[] = []
  let offset = 0
  const limit = 300

  while (true) {
    const batch = await fetchWithRetry(`${baseUrl}/devices?limit=${limit}&offset=${offset}`, headers)
    if (!Array.isArray(batch) || batch.length === 0) break
    allDevices.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }

  console.log(`📱 Kandji: fetched ${allDevices.length} devices`)

  const availableStatusId = await resolveStatusId(orgId, 'available')
  const lostStatusId = await resolveStatusId(orgId, 'lost')

  for (const device of allDevices) {
    try {
      const category = mapPlatformToCategory(device.platform, device.model)
      const existing = await Hardware.findOne({ orgId, serialNumber: device.serial_number })

      if (existing) {
        ;(existing as any).model = device.model
        ;(existing as any).manufacturer = 'Apple'
        ;(existing as any).category = category
        existing.tags = [...new Set([...(existing.tags || []), 'kandji-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'kandji')
        existing.customFields.set('mdmDeviceId', device.device_id)
        existing.customFields.set('osVersion', device.os_version)
        existing.customFields.set('blueprintName', device.blueprint_name)
        existing.customFields.set('lastCheckIn', device.last_check_in)
        if (device.asset_tag) existing.customFields.set('assetTag', device.asset_tag)
        await existing.save()
        result.updated++
      } else {
        await Hardware.create({
          orgId,
          serialNumber: device.serial_number,
          model: device.model,
          category,
          manufacturer: 'Apple',
          statusId: device.is_missing ? lostStatusId : availableStatusId,
          purchaseDate: new Date(device.first_enrollment),
          tags: ['kandji-synced'],
          customFields: new Map([
            ['mdmProvider', 'kandji'],
            ['mdmDeviceId', device.device_id],
            ['osVersion', device.os_version],
            ['blueprintName', device.blueprint_name],
            ['lastCheckIn', device.last_check_in],
            ...(device.asset_tag ? [['assetTag', device.asset_tag] as [string, string]] : [])
          ])
        })
        result.created++
      }
    } catch (err: any) {
      result.errors.push(`Device ${device.serial_number}: ${err.message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.kandji.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Kandji sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
