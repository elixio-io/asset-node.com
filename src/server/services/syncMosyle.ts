
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import { resolveStatusId } from './statusResolver'
import { decrypt } from './encryption'
import type { SyncResult } from './syncKandji'


function mapDeviceTypeToCategory(deviceType: string, model: string): string {
  const dt = deviceType?.toLowerCase() || ''
  const m = model?.toLowerCase() || ''

  if (dt === 'iphone' || dt.includes('phone')) return 'phone'
  if (dt === 'ipad' || dt.includes('tablet')) return 'tablet'
  if (dt === 'appletv' || dt.includes('tv')) return 'other'
  if (m.includes('imac') || m.includes('mac mini') || m.includes('mac studio') || m.includes('mac pro')) {
    return 'desktop'
  }
  return 'laptop'
}


async function fetchWithRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, opts)

    if (res.ok) return res

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10)
      console.warn(`⏳ Mosyle rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`Mosyle API error ${res.status}: ${body}`)
  }
  throw new Error('Mosyle API: max retries exceeded')
}


interface MosyleDevice {
  serial_number: string
  device_model: string
  device_name: string
  os_version: string
  device_type: string
  userid: string
  date_last_beat: string
  asset_tag?: string
  tags?: string[]
}

interface MosyleListResponse {
  status: string
  response: Array<{
    status: string
    devices: MosyleDevice[]
  }>
}


export async function syncMosyle(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'mosyle', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = (org.settings as any)?.integrations?.mosyle
  if (!config?.enabled) throw new Error('Mosyle integration is not enabled')

  const apiToken = decrypt(config.apiToken!)
  if (!apiToken) throw new Error('Mosyle API token is required')

  const allDevices: MosyleDevice[] = []
  let page = 0

  while (true) {
    const res = await fetchWithRetry('https://managerapi.mosyle.com/v2/listdevices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        os: 'mac',
        page
      })
    })

    const data: MosyleListResponse = await res.json()
    const devices = data.response?.[0]?.devices || []

    if (devices.length === 0) break
    allDevices.push(...devices)
    page++

    if (allDevices.length > 10000) break
  }

  console.log(`📱 Mosyle: fetched ${allDevices.length} devices`)

  const availableStatusId = await resolveStatusId(orgId, 'available')

  for (const device of allDevices) {
    try {
      if (!device.serial_number) {
        result.errors.push(`Device "${device.device_name}": no serial number, skipping`)
        continue
      }

      const category = mapDeviceTypeToCategory(device.device_type, device.device_model)
      const existing = await Hardware.findOne({ orgId, serialNumber: device.serial_number })

      if (existing) {
        ;(existing as any).model = device.device_model
        ;(existing as any).manufacturer = 'Apple'
        ;(existing as any).category = category
        existing.tags = [...new Set([...(existing.tags || []), 'mosyle-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'mosyle')
        existing.customFields.set('osVersion', device.os_version)
        existing.customFields.set('deviceName', device.device_name)
        existing.customFields.set('lastCheckIn', device.date_last_beat)
        if (device.asset_tag) existing.customFields.set('assetTag', device.asset_tag)
        await existing.save()
        result.updated++
      } else {
        await Hardware.create({
          orgId,
          serialNumber: device.serial_number,
          model: device.device_model,
          category,
          manufacturer: 'Apple',
          statusId: availableStatusId,
          tags: ['mosyle-synced'],
          customFields: new Map([
            ['mdmProvider', 'mosyle'],
            ['osVersion', device.os_version],
            ['deviceName', device.device_name],
            ['lastCheckIn', device.date_last_beat],
            ...(device.asset_tag ? [['assetTag', device.asset_tag] as [string, string]] : [])
          ])
        })
        result.created++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`Device ${device.serial_number}: ${message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.mosyle.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Mosyle sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
