
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { decrypt } from './encryption'
import type { SyncResult } from './syncKandji'
import crypto from 'crypto'

const DIRECTORY_API = 'https://admin.googleapis.com/admin/directory/v1'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly'
const DELAY_MS = 300


interface GoogleUser {
  id: string
  primaryEmail: string
  name: {
    givenName: string
    familyName: string
    fullName: string
  }
  organizations?: Array<{
    department?: string
    title?: string
    primary?: boolean
  }>
  suspended: boolean
  creationTime: string
  lastLoginTime: string
  orgUnitPath: string
  isAdmin: boolean
}

interface GoogleUsersResponse {
  users?: GoogleUser[]
  nextPageToken?: string
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}


function base64url(data: string | Buffer): string {
  return Buffer.from(data).toString('base64url')
}

function createJWT(serviceAccount: ServiceAccountKey, adminEmail: string): string {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    sub: adminEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload))
  ]

  const signingInput = segments.join('.')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')

  return `${signingInput}.${signature}`
}

async function getAccessToken(serviceAccount: ServiceAccountKey, adminEmail: string): Promise<string> {
  const jwt = createJWT(serviceAccount, adminEmail)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!res.ok) {
    let errorMsg = `Google OAuth token exchange failed (${res.status})`
    try {
      const errData = await res.json()
      if (errData.error) errorMsg += `: ${errData.error}`
      if (errData.error_description) errorMsg += ` — ${errData.error_description}`
    } catch {
    }
    throw new Error(errorMsg)
  }

  const data = await res.json()
  return data.access_token
}


async function fetchWithRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, opts)

    if (res.ok) return res

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10)
      console.warn(`⏳ Google Workspace rate-limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    let errorDetail = `status ${res.status}`
    try {
      const errData = await res.json()
      if (errData.error?.message) errorDetail = errData.error.message
    } catch {  }
    throw new Error(`Google Directory API error: ${errorDetail}`)
  }
  throw new Error('Google Directory API: max retries exceeded')
}


export async function syncGoogleWorkspace(orgId: string): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = { provider: 'google-workspace', created: 0, updated: 0, errors: [], duration: 0 }

  const org = await Organization.findById(orgId)
  if (!org) throw new Error(`Organization ${orgId} not found`)

  const config = (org.settings as any)?.integrations?.googleWorkspace
  if (!config?.enabled) throw new Error('Google Workspace integration is not enabled')

  const domain = config.domain
  const adminEmail = config.adminEmail
  const serviceAccountKeyRaw = decrypt(config.serviceAccountKey!)

  if (!domain || !adminEmail || !serviceAccountKeyRaw) {
    throw new Error('Google Workspace domain, admin email, and service account key are required')
  }

  let serviceAccount: ServiceAccountKey
  try {
    serviceAccount = JSON.parse(serviceAccountKeyRaw)
  } catch {
    throw new Error('Invalid service account key JSON')
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account key must contain client_email and private_key')
  }

  const accessToken = await getAccessToken(serviceAccount, adminEmail)

  const allUsers: GoogleUser[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      domain,
      maxResults: '500',
      orderBy: 'email',
      projection: 'full'
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetchWithRetry(
      `${DIRECTORY_API}/users?${params}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    const data: GoogleUsersResponse = await res.json()
    if (data.users) allUsers.push(...data.users)
    pageToken = data.nextPageToken

    if (pageToken) await new Promise(r => setTimeout(r, DELAY_MS))
  } while (pageToken)

  console.log(`👤 Google Workspace: fetched ${allUsers.length} users from ${domain}`)

  for (const user of allUsers) {
    try {
      if (user.suspended) continue

      const email = user.primaryEmail?.toLowerCase()
      if (!email) {
        result.errors.push(`User ${user.id}: no email, skipping`)
        continue
      }

      const primaryOrg = user.organizations?.find(o => o.primary) || user.organizations?.[0]
      const department = primaryOrg?.department
      const jobTitle = primaryOrg?.title

      const existing = await Employee.findOne({ orgId, email })

      if (existing) {
        existing.firstName = user.name.givenName
        existing.lastName = user.name.familyName
        existing.department = department || undefined
        existing.jobTitle = jobTitle || undefined
        existing.isActive = true
        await existing.save()
        result.updated++
      } else {
        await Employee.create({
          orgId,
          firstName: user.name.givenName,
          lastName: user.name.familyName,
          email,
          department: department || undefined,
          jobTitle: jobTitle || undefined,
          isActive: true
        })
        result.created++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`User ${user.primaryEmail}: ${message}`)
    }
  }

  await Organization.updateOne(
    { _id: orgId },
    { $set: { 'settings.integrations.googleWorkspace.lastSyncAt': new Date() } }
  )

  result.duration = Date.now() - start
  console.log(`✅ Google Workspace sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors (${result.duration}ms)`)
  return result
}
