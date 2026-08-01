
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { decrypt } from './encryption'
import type { SyncResult } from './syncKandji'

const BASE_URL = 'https://api.hibob.com/v1'
const DELAY_MS = 300


interface HiBobEmployee {
  id: string
  firstName: string
  surname: string
  email: string
  work: {
    department?: string
    title?: string
    site?: string
    startDate?: string
    customColumns?: Record<string, unknown>
  }
  personal: {
    communication?: {
      workPhone?: string
    }
  }
  humanReadable: Record<string, string>
}

interface HiBobPeopleResponse {
  employees: HiBobEmployee[]
}


async function fetchWithRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, opts)

    if (res.ok) return res

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10)
      console.warn(`⏳ HiBob rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`HiBob API error ${res.status}: ${body}`)
  }
  throw new Error('HiBob API: max retries exceeded')
}


export async function syncHiBob(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'hibob', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = (org.settings as any)?.integrations?.hibob
  if (!config?.enabled) throw new Error('HiBob integration is not enabled')

  const serviceUserId = config.serviceUserId
  const apiToken = decrypt(config.apiToken!)

  if (!serviceUserId || !apiToken) {
    throw new Error('HiBob service user ID and API token are required')
  }

  const authHeader = 'Basic ' + Buffer.from(`${serviceUserId}:${apiToken}`).toString('base64')

  const res = await fetchWithRetry(`${BASE_URL}/people?showInactive=false`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  })

  const data: HiBobPeopleResponse = await res.json()
  const employees = data.employees || []

  console.log(`👤 HiBob: fetched ${employees.length} employees`)

  for (const emp of employees) {
    try {
      const email = emp.email?.toLowerCase()
      if (!email) {
        result.errors.push(`Employee ${emp.id} (${emp.firstName} ${emp.surname}): no email, skipping`)
        continue
      }

      const existing = await Employee.findOne({ orgId, email })

      const startDate = emp.work?.startDate ? new Date(emp.work.startDate) : undefined

      if (existing) {
        existing.firstName = emp.firstName
        existing.lastName = emp.surname
        existing.department = emp.work?.department || undefined
        existing.jobTitle = emp.work?.title || undefined
        existing.startDate = startDate
        existing.isActive = true
        await existing.save()
        result.updated++
      } else {
        await Employee.create({
          orgId,
          firstName: emp.firstName,
          lastName: emp.surname,
          email,
          department: emp.work?.department || undefined,
          jobTitle: emp.work?.title || undefined,
          startDate,
          isActive: true
        })
        result.created++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`Employee ${emp.id}: ${message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.hibob.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ HiBob sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
