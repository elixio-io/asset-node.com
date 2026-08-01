
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { decrypt } from './encryption'
import type { SyncResult } from './syncKandji'

const DELAY_MS = 300


interface BambooEmployee {
  id: string
  displayName: string
  firstName: string
  lastName: string
  workEmail: string
  department: string
  jobTitle: string
  location: string
  workPhone: string
  status: string
  photoUrl: string
}

interface BambooDirectoryResponse {
  fields: Array<{ id: string; type: string; name: string }>
  employees: BambooEmployee[]
}


async function fetchWithRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, opts)

    if (res.ok) return res

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10)
      console.warn(`⏳ BambooHR rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    const body = await res.text()
    throw new Error(`BambooHR API error ${res.status}: ${body}`)
  }
  throw new Error('BambooHR API: max retries exceeded')
}


export async function syncBambooHR(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'bamboohr', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = (org.settings as any)?.integrations?.bamboohr
  if (!config?.enabled) throw new Error('BambooHR integration is not enabled')

  const subdomain = config.subdomain
  const apiKey = decrypt(config.apiKey!)

  if (!subdomain || !apiKey) {
    throw new Error('BambooHR subdomain and API key are required')
  }

  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:x`).toString('base64')
  const url = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/employees/directory`

  const res = await fetchWithRetry(url, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  })

  const data: BambooDirectoryResponse = await res.json()
  const employees = data.employees || []

  console.log(`👤 BambooHR: fetched ${employees.length} employees`)

  for (const emp of employees) {
    try {
      const email = emp.workEmail?.toLowerCase()
      if (!email) {
        result.errors.push(`Employee ${emp.id} (${emp.displayName}): no email, skipping`)
        continue
      }

      const existing = await Employee.findOne({ orgId, email })

      if (existing) {
        existing.firstName = emp.firstName
        existing.lastName = emp.lastName
        existing.department = emp.department || undefined
        existing.jobTitle = emp.jobTitle || undefined
        existing.isActive = true
        await existing.save()
        result.updated++
      } else {
        await Employee.create({
          orgId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
          department: emp.department || undefined,
          jobTitle: emp.jobTitle || undefined,
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
    { $set: { 'settings.integrations.bamboohr.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ BambooHR sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
