
import { createBatch, createScimUser } from './factories/users'

const SCIM_BASE_URL = process.env.SCIM_BASE_URL || 'http://localhost:3001/api/scim/v2'
const SCIM_BEARER_TOKEN = process.env.SCIM_BEARER_TOKEN || 'mock-scim-token-for-testing'

const headers = {
  'Content-Type': 'application/scim+json',
  Authorization: `Bearer ${SCIM_BEARER_TOKEN}`,
  Accept: 'application/scim+json'
}


async function testProvisionUsers(count: number): Promise<void> {
  console.log(`\n📥 Provisioning ${count} users...`)
  const users = createBatch(createScimUser, count)
  const created: string[] = []

  for (const user of users) {
    try {
      const res = await fetch(`${SCIM_BASE_URL}/Users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(user)
      })

      if (res.ok) {
        const result = await res.json()
        created.push(result.id)
        console.log(`  ✅ Created: ${user.displayName} (${user.userName}) → id=${result.id}`)
      } else {
        const err = await res.json()
        console.log(`  ❌ Failed: ${user.displayName} — ${err.detail || res.status}`)
      }
    } catch (err: any) {
      console.log(`  💥 Error: ${user.displayName} — ${err.message}`)
    }
  }

  console.log(`\n📊 Provisioned ${created.length}/${count} users`)
  return testListUsers()
}

async function testListUsers(): Promise<void> {
  console.log(`\n📋 Listing all SCIM users...`)
  const res = await fetch(`${SCIM_BASE_URL}/Users`, { headers })

  if (res.ok) {
    const data = await res.json()
    console.log(`  Total: ${data.totalResults} users`)
    for (const user of data.Resources?.slice(0, 5) || []) {
      console.log(`    • ${user.displayName} <${user.userName}> active=${user.active}`)
    }
    if (data.totalResults > 5) console.log(`    ... and ${data.totalResults - 5} more`)
  } else {
    console.log(`  ❌ List failed: ${res.status}`)
  }
}

async function testDeactivateUser(userId: string): Promise<void> {
  console.log(`\n🚫 Deactivating user ${userId}...`)
  const res = await fetch(`${SCIM_BASE_URL}/Users/${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: false }]
    })
  })

  if (res.ok) {
    const user = await res.json()
    console.log(`  ✅ Deactivated: ${user.displayName} active=${user.active}`)
  } else {
    console.log(`  ❌ Deactivation failed: ${res.status}`)
  }
}

async function testFilterUser(email: string): Promise<void> {
  console.log(`\n🔍 Filtering for user: ${email}`)
  const filter = encodeURIComponent(`userName eq "${email}"`)
  const res = await fetch(`${SCIM_BASE_URL}/Users?filter=${filter}`, { headers })

  if (res.ok) {
    const data = await res.json()
    console.log(`  Found: ${data.totalResults} match(es)`)
    for (const user of data.Resources || []) {
      console.log(`    • ${user.displayName} id=${user.id} active=${user.active}`)
    }
  } else {
    console.log(`  ❌ Filter failed: ${res.status}`)
  }
}


async function runAllTests(): Promise<void> {
  console.log('═══════════════════════════════════════════')
  console.log('  SCIM Test Client — Provisioning Scenarios')
  console.log('═══════════════════════════════════════════')

  await testProvisionUsers(15)

  await testListUsers()

  const listRes = await fetch(`${SCIM_BASE_URL}/Users?count=1`, { headers })
  if (listRes.ok) {
    const data = await listRes.json()
    if (data.Resources?.[0]?.id) {
      const userId = data.Resources[0].id
      await testDeactivateUser(userId)
      await testFilterUser(data.Resources[0].userName)
    }
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  SCIM test scenarios complete')
  console.log('═══════════════════════════════════════════')
}

runAllTests().catch(console.error)
