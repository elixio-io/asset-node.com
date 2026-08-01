
import { Hardware } from '../../models/Hardware'
import { Organization } from '../../models/Organization'
import type { SyncResult } from './syncKandji'
import type { JamfProComputer, JamfSchoolDevice } from '../../mocks/factories/devices'
import { decrypt } from './encryption'
import { resolveStatusId } from './statusResolver'


async function getJamfToken(serverUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${serverUrl}/api/v1/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Jamf Pro auth error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.token
}


function mapJamfPlatformToCategory(platform: string, model: string): string {
  if (platform === 'iPhone') return 'phone'
  if (platform === 'iPad') return 'tablet'
  const lModel = model.toLowerCase()
  if (lModel.includes('imac') || lModel.includes('mac mini') || lModel.includes('mac studio') || lModel.includes('mac pro')) return 'desktop'
  return 'laptop'
}


export async function syncJamfPro(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'jamf-pro', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = org.settings?.integrations?.jamf
  if (!config?.enabled) throw new Error('Jamf integration is not enabled')

  const serverUrl = config.serverUrl!.replace(/\/$/, '')
  const token = await getJamfToken(serverUrl, config.username!, decrypt(config.password!))

  const allComputers: JamfProComputer[] = []
  let page = 0
  const pageSize = 100

  while (true) {
    const res = await fetch(
      `${serverUrl}/api/v1/computers-inventory?page-size=${pageSize}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Jamf Pro API error ${res.status}: ${body}`)
    }

    const data = await res.json()
    if (data.results) allComputers.push(...data.results)
    if (!data.results || allComputers.length >= (data.totalCount || Infinity)) break
    page++
  }

  console.log(`🍎 Jamf Pro: fetched ${allComputers.length} computers`)

  const availableStatusId = await resolveStatusId(orgId, 'available')

  for (const computer of allComputers) {
    try {
      const category = mapJamfPlatformToCategory(computer.platform, computer.model)
      const existing = await Hardware.findOne({ orgId, serialNumber: computer.serial_number })

      if (existing) {
        ;(existing as any).model = computer.model
        ;(existing as any).manufacturer = 'Apple'
        ;(existing as any).category = category
        existing.tags = [...new Set([...(existing.tags || []), 'jamf-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'jamf-pro')
        existing.customFields.set('mdmDeviceId', String(computer.id))
        existing.customFields.set('osVersion', computer.os_version)
        existing.customFields.set('department', computer.department)
        existing.customFields.set('building', computer.building)
        existing.customFields.set('lastCheckIn', computer.last_check_in)
        await existing.save()
        result.updated++
      } else {
        await Hardware.create({
          orgId,
          serialNumber: computer.serial_number,
          model: computer.model,
          category,
          manufacturer: 'Apple',
          statusId: availableStatusId,
          purchaseDate: new Date(computer.last_inventory_update),
          tags: ['jamf-synced'],
          customFields: new Map([
            ['mdmProvider', 'jamf-pro'],
            ['mdmDeviceId', String(computer.id)],
            ['osVersion', computer.os_version],
            ['department', computer.department],
            ['building', computer.building],
            ['lastCheckIn', computer.last_check_in]
          ])
        })
        result.created++
      }
    } catch (err: any) {
      result.errors.push(`Computer ${computer.serial_number}: ${err.message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.jamf.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Jamf Pro sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}


export async function syncJamfSchool(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'jamf-school', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = org.settings?.integrations?.jamf
  if (!config?.enabled) throw new Error('Jamf integration is not enabled')

  const serverUrl = config.serverUrl!.replace(/\/$/, '')

  const res = await fetch(`${serverUrl}/api/devices`, {
    headers: {
      Authorization: `Bearer ${decrypt(config.password!)}`,
      Accept: 'application/json'
    }
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Jamf School API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  const devices: JamfSchoolDevice[] = data.devices || []

  console.log(`🎓 Jamf School: fetched ${devices.length} devices`)

  const availableStatusId = await resolveStatusId(orgId, 'available')

  for (const device of devices) {
    try {
      const category = mapJamfPlatformToCategory(
        device.model.includes('iPad') ? 'iPad' : 'Mac',
        device.model
      )
      const existing = await Hardware.findOne({ orgId, serialNumber: device.serialNumber })

      if (existing) {
        ;(existing as any).model = device.model
        ;(existing as any).manufacturer = 'Apple'
        ;(existing as any).category = category
        existing.tags = [...new Set([...(existing.tags || []), 'jamf-school-synced'])]
        existing.customFields = existing.customFields || new Map()
        existing.customFields.set('mdmProvider', 'jamf-school')
        existing.customFields.set('udid', device.UDID)
        existing.customFields.set('ownerType', device.ownerType)
        existing.customFields.set('locationName', device.locationName)
        existing.customFields.set('lastSeen', device.lastSeen)
        await existing.save()
        result.updated++
      } else {
        await Hardware.create({
          orgId,
          serialNumber: device.serialNumber,
          model: device.model,
          category,
          manufacturer: 'Apple',
          statusId: availableStatusId,
          purchaseDate: new Date(device.enrolledAt),
          tags: ['jamf-school-synced'],
          customFields: new Map([
            ['mdmProvider', 'jamf-school'],
            ['udid', device.UDID],
            ['ownerType', device.ownerType],
            ['locationName', device.locationName],
            ['lastSeen', device.lastSeen],
            ...(device.assetTag ? [['assetTag', device.assetTag] as [string, string]] : [])
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
    { $set: { 'settings.integrations.jamf.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Jamf School sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
