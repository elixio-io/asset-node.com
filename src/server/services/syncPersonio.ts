
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { decrypt } from './encryption'
import type { SyncResult } from './syncKandji'

const BASE_URL = 'https://api.personio.de'
const PARTNER_ID = 'ASSETNODE'
const APP_ID = 'ASSETNODE_SYNC'
const PAGE_LIMIT = 50
const DELAY_MS = 300


interface PersonAttributes {
  id: { value: string }
  first_name: { value: string }
  last_name: { value: string }
  email: { value: string }
}

interface PersonResource {
  type: 'Person'
  attributes: PersonAttributes
}

interface EmploymentAttributes {
  id: { value: string }
  status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING' | 'LEAVE'
  position?: { name: string }
  employment_start_date?: string
  termination_date?: string | null
  org_units?: Array<{ name: string; type: string }>
}

interface EmploymentResource {
  type: 'Employment'
  attributes: EmploymentAttributes
}

interface PaginatedResponse<T> {
  data: T[]
  pagination?: { cursor?: string }
}


async function fetchWithRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, opts)

    if (res.ok) return res.json()

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`⏳ Personio rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`Personio API error ${res.status}: ${body}`)
  }
  throw new Error('Personio API: max retries exceeded')
}


async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Personio auth failed (${res.status}): ${body}`)
  }

  const { access_token } = await res.json()
  return access_token
}


function makeHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'X-Personio-Partner-ID': PARTNER_ID,
    'X-Personio-App-ID': APP_ID
  }
}

async function fetchAllPersons(token: string): Promise<PersonResource[]> {
  const headers = makeHeaders(token)
  const all: PersonResource[] = []
  let cursor: string | undefined

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor) params.set('cursor', cursor)

    const json: PaginatedResponse<PersonResource> = await fetchWithRetry(
      `${BASE_URL}/v2/persons?${params}`,
      { headers }
    )

    all.push(...json.data)
    cursor = json.pagination?.cursor ?? undefined

    if (cursor) await new Promise(r => setTimeout(r, DELAY_MS))
  } while (cursor)

  return all
}

async function fetchEmployments(token: string, personId: string): Promise<EmploymentResource[]> {
  const headers = makeHeaders(token)
  const all: EmploymentResource[] = []
  let cursor: string | undefined

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor) params.set('cursor', cursor)

    const json: PaginatedResponse<EmploymentResource> = await fetchWithRetry(
      `${BASE_URL}/v2/persons/${personId}/employments?${params}`,
      { headers }
    )

    all.push(...json.data)
    cursor = json.pagination?.cursor ?? undefined
  } while (cursor)

  return all
}


export async function syncPersonio(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'personio', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = org.settings?.integrations?.personio
  if (!config?.enabled) throw new Error('Personio integration is not enabled')

  const clientId = config.clientId!
  const clientSecret = decrypt(config.clientSecret!)
  const token = await getAccessToken(clientId, clientSecret)

  const persons = await fetchAllPersons(token)
  console.log(`👤 Personio: fetched ${persons.length} persons`)

  for (const person of persons) {
    try {
      const personId = person.attributes.id.value
      const email = person.attributes.email?.value

      if (!email) {
        result.errors.push(`Person ${personId}: no email, skipping`)
        continue
      }

      const employments = await fetchEmployments(token, personId)

      const activeEmployment = employments.find(
        emp => emp.attributes.status === 'ACTIVE' || emp.attributes.status === 'ONBOARDING'
      )

      if (!activeEmployment) continue

      const attrs = activeEmployment.attributes

      const department = attrs.org_units?.find(u => u.type === 'department')?.name || undefined

      const existing = await Employee.findOne({ orgId, email: email.toLowerCase() })

      if (existing) {
        existing.firstName = person.attributes.first_name.value
        existing.lastName = person.attributes.last_name.value
        existing.department = department
        existing.jobTitle = attrs.position?.name || undefined
        existing.startDate = attrs.employment_start_date ? new Date(attrs.employment_start_date) : undefined
        existing.endDate = attrs.termination_date ? new Date(attrs.termination_date) : undefined
        existing.isActive = true
        await existing.save()
        result.updated++
      } else {
        await Employee.create({
          orgId,
          firstName: person.attributes.first_name.value,
          lastName: person.attributes.last_name.value,
          email: email.toLowerCase(),
          department,
          jobTitle: attrs.position?.name || undefined,
          startDate: attrs.employment_start_date ? new Date(attrs.employment_start_date) : undefined,
          endDate: attrs.termination_date ? new Date(attrs.termination_date) : undefined,
          isActive: true
        })
        result.created++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err: any) {
      const pid = person.attributes.id?.value || 'unknown'
      result.errors.push(`Person ${pid}: ${err.message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.personio.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Personio sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
