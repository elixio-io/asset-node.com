
import { FastifyPluginAsync } from 'fastify'
import { Employee } from '../../models/Employee'
import { Organization } from '../../models/Organization'
import { User } from '../../models/User'
import { decrypt } from '../services/encryption'
import { resolveEffectivePlan } from '../services/entitlementService'
import { getLimits, isLimitReached } from '../config/plans'
import type { PlanKey } from '../config/plans'
import crypto from 'crypto'


function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function getScimBaseUrl(): string {
  const apiUrl = process.env.API_URL || process.env.APP_URL
  if (apiUrl) return `${apiUrl.replace(/\/$/, '')}/api/scim/v2`
  return 'http://localhost:3001/api/scim/v2'
}

function scimError(detail: string, status: string): any {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status
  }
}

function mapEmployeeToScim(emp: any): any {
  const base = getScimBaseUrl()
  return {
    schemas: [
      'urn:ietf:params:scim:schemas:core:2.0:User',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
    ],
    id: emp._id.toString(),
    externalId: emp.externalId || undefined,
    userName: emp.email,
    name: {
      givenName: emp.firstName,
      familyName: emp.lastName,
      formatted: `${emp.firstName} ${emp.lastName}`
    },
    displayName: `${emp.firstName} ${emp.lastName}`,
    emails: [{ value: emp.email, type: 'work', primary: true }],
    active: emp.isActive,
    title: emp.jobTitle || '',
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
      department: emp.department || ''
    },
    meta: {
      resourceType: 'User',
      created: emp.createdAt,
      lastModified: emp.updatedAt,
      location: `${base}/Users/${emp._id}`
    }
  }
}


const scimRoutes: FastifyPluginAsync = async (fastify) => {




  fastify.addContentTypeParser(
    'application/scim+json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string))
      } catch (err: any) {
        done(err, undefined)
      }
    }
  )

  fastify.get('/ServiceProviderConfig', async (request) => {
    console.log(`[SCIM] ServiceProviderConfig requested from ${request.ip}`)
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://asset-node.com/docs/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication via OAuth 2.0 Bearer Token',
          specUri: 'https://www.rfc-editor.org/info/rfc6750'
        }
      ],
      meta: {
        resourceType: 'ServiceProviderConfig',
        location: `${getScimBaseUrl()}/ServiceProviderConfig`
      }
    }
  })

  fastify.get('/Schemas', async () => {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [getUserSchema()]
    }
  })

  fastify.get('/ResourceTypes', async () => {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/Users',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
          schemaExtensions: [
            {
              schema: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
              required: false
            }
          ],
          meta: {
            resourceType: 'ResourceType',
            location: `${getScimBaseUrl()}/ResourceTypes/User`
          }
        }
      ]
    }
  })




  fastify.register(async (secured) => {
    secured.addHook('preHandler', async (request, reply) => {
      console.log(`[SCIM] ${request.method} ${request.url} from ${request.ip}`)
      const auth = request.headers.authorization
      if (!auth || !auth.startsWith('Bearer ')) {
        console.log('[SCIM] ❌ No Bearer token in Authorization header')
        return reply.code(401).send(scimError('Unauthorized', '401'))
      }

      const incomingToken = auth.replace('Bearer ', '')

      const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex')
      let matchedOrg = await Organization.findOne({
        'settings.integrations.scim.enabled': true,
        'settings.integrations.scim.tokenHash': incomingHash
      })



      if (!matchedOrg) {
        const candidates = await Organization.find({
          'settings.integrations.scim.enabled': true,
          'settings.integrations.scim.bearerToken': { $exists: true, $ne: '' },
          'settings.integrations.scim.tokenHash': { $exists: false }
        })

        for (const org of candidates) {
          const storedToken = (org.settings as any)?.integrations?.scim?.bearerToken
          if (!storedToken) continue
          try {
            const decryptedToken = decrypt(storedToken)
            if (timingSafeCompare(decryptedToken, incomingToken)) {
              await Organization.updateOne(
                { _id: org._id },
                { $set: { 'settings.integrations.scim.tokenHash': incomingHash } }
              )
              matchedOrg = org
              break
            }
          } catch {
            if (timingSafeCompare(storedToken, incomingToken)) {
              await Organization.updateOne(
                { _id: org._id },
                { $set: { 'settings.integrations.scim.tokenHash': incomingHash } }
              )
              matchedOrg = org
              break
            }
          }
        }
      }

      if (!matchedOrg) {
        console.log('[SCIM] ❌ Token not matched to any org')
        return reply.code(401).send(scimError('Invalid token', '401'))
      }

      console.log(`[SCIM] ✅ Matched org ${matchedOrg._id}`)
        ; (request as any).orgId = matchedOrg._id
        ; (request as any).scimConfig = matchedOrg.settings?.integrations?.scim
    })

    secured.get('/Users', async (request) => {
      const orgId = (request as any).orgId
      const query = request.query as any
      const startIndex = parseInt(query.startIndex || '1', 10)
      const count = parseInt(query.count || '100', 10)

      const filter = query.filter as string | undefined
      let dbQuery: any = { orgId, isActive: true }

      if (filter) {
        const userNameMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i)
        if (userNameMatch) dbQuery.email = userNameMatch[1].toLowerCase()

        const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i)
        if (externalIdMatch) dbQuery.externalId = externalIdMatch[1]
      }

      const total = await Employee.countDocuments(dbQuery)
      const employees = await Employee.find(dbQuery)
        .skip(startIndex - 1)
        .limit(count)
        .lean()

      return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: total,
        startIndex,
        itemsPerPage: employees.length,
        Resources: employees.map(mapEmployeeToScim)
      }
    })

    secured.get('/Users/:id', async (request, reply) => {
      const orgId = (request as any).orgId
      const { id } = request.params as { id: string }

      const emp = await Employee.findOne({ _id: id, orgId }).lean()
      if (!emp) return reply.code(404).send(scimError('User not found', '404'))

      return mapEmployeeToScim(emp)
    })

    secured.post('/Users', async (request, reply) => {
      const orgId = (request as any).orgId
      const body = request.body as any
      const config = (request as any).scimConfig

      if (!config?.provisionUsers) {
        return reply.code(403).send(scimError('User provisioning is disabled', '403'))
      }

      console.log(`[SCIM] POST /Users — externalId=${body.externalId || 'none'}, active=${body.active}`)

      const email = body.userName?.toLowerCase() || body.emails?.[0]?.value?.toLowerCase()
      if (!email) return reply.code(400).send(scimError('Missing userName or email', '400'))

      const externalId = body.externalId || null
      if (externalId) {
        const existingByExtId = await Employee.findOne({ orgId, externalId })
        if (existingByExtId) {
          return reply.code(200).send(mapEmployeeToScim(existingByExtId.toObject()))
        }
      }

      const existing = await Employee.findOne({ orgId, email })
      if (existing) {
        return reply.code(409).send(scimError('User already exists', '409'))
      }

      const enterprise = body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] || {}

      const org = await Organization.findById(orgId).select('plan billing').lean()
      const userCount = await User.countDocuments({ orgId })
      const employeeCount = await Employee.countDocuments({ orgId })
      const totalPeople = userCount + employeeCount
      const effectivePlan = resolveEffectivePlan(
        ((org as any)?.plan as PlanKey) || 'free',
        (org as any)?.billing
      )
      const planLimits = getLimits(effectivePlan)
      if (isLimitReached(totalPeople, planLimits.users)) {
        return reply.code(403).send(scimError(
          `User limit reached (${totalPeople}/${planLimits.users}). Upgrade your AssetNode plan to provision more users.`,
          '403'
        ))
      }

      const employee = await Employee.create({
        orgId,
        externalId,
        firstName: body.name?.givenName || body.displayName?.split(' ')[0] || 'Unknown',
        lastName: body.name?.familyName || body.displayName?.split(' ').slice(1).join(' ') || '',
        email,
        department: enterprise.department || body.department || '',
        jobTitle: body.title || '',
        isActive: body.active !== false,
        startDate: new Date()
      })

      reply.code(201)
      return mapEmployeeToScim(employee.toObject())
    })

    secured.put('/Users/:id', async (request, reply) => {
      const orgId = (request as any).orgId
      const { id } = request.params as { id: string }
      const body = request.body as any

      const emp = await Employee.findOne({ _id: id, orgId })
      if (!emp) return reply.code(404).send(scimError('User not found', '404'))

      const enterprise = body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] || {}

      emp.firstName = body.name?.givenName || emp.firstName
      emp.lastName = body.name?.familyName || emp.lastName
      emp.email = (body.userName || body.emails?.[0]?.value || emp.email).toLowerCase()
      emp.department = enterprise.department || body.department || emp.department
      emp.jobTitle = body.title || emp.jobTitle
      emp.externalId = body.externalId || emp.externalId || null

      if (body.active === false && emp.isActive) {
        emp.isActive = false
        emp.endDate = new Date()
      } else if (body.active === true || body.active === undefined) {
        emp.isActive = true
        emp.endDate = undefined as any
      }

      await emp.save()
      return mapEmployeeToScim(emp.toObject())
    })

    secured.patch('/Users/:id', async (request, reply) => {
      const orgId = (request as any).orgId
      const { id } = request.params as { id: string }
      const body = request.body as any

      const emp = await Employee.findOne({ _id: id, orgId })
      if (!emp) return reply.code(404).send(scimError('User not found', '404'))

      const operations = body.Operations || []
      for (const op of operations) {
        const operation = (op.op || '').toLowerCase()

        if (operation === 'replace') {
          if (op.path) {
            applyPatchByPath(emp, op.path, op.value)
          } else if (typeof op.value === 'object' && op.value !== null) {
            for (const [key, val] of Object.entries(op.value)) {
              applyPatchByPath(emp, key, val)
            }
          }
        } else if (operation === 'add') {
          if (op.path) {
            applyPatchByPath(emp, op.path, op.value)
          }
        }
      }

      await emp.save()
      return mapEmployeeToScim(emp.toObject())
    })

    secured.delete('/Users/:id', async (request, reply) => {
      const orgId = (request as any).orgId
      const config = (request as any).scimConfig
      const { id } = request.params as { id: string }

      if (!config?.deprovisionUsers) {
        await Employee.updateOne({ _id: id, orgId }, { isActive: false, endDate: new Date() })
      } else {
        await Employee.deleteOne({ _id: id, orgId })
      }

      return reply.code(204).send()
    })
  })
}


function applyPatchByPath(emp: any, path: string, value: any): void {
  const normalized = path.toLowerCase().replace(/\s+/g, '')

  switch (normalized) {
    case 'active':
      if (value === false || value === 'false') {
        emp.isActive = false
        emp.endDate = new Date()
      } else {
        emp.isActive = true
        emp.endDate = undefined
      }
      break
    case 'name.givenname':
    case 'givenname':
      if (typeof value === 'string') emp.firstName = value
      break
    case 'name.familyname':
    case 'familyname':
      if (typeof value === 'string') emp.lastName = value
      break
    case 'username':
      if (typeof value === 'string') emp.email = value.toLowerCase()
      break
    case 'title':
      if (typeof value === 'string') emp.jobTitle = value
      break
    case 'name':
      if (typeof value === 'object' && value !== null) {
        if (value.givenName) emp.firstName = value.givenName
        if (value.familyName) emp.lastName = value.familyName
      }
      break
    case 'emails':
    case 'emails[type eq "work"].value':
      if (typeof value === 'string') {
        emp.email = value.toLowerCase()
      } else if (Array.isArray(value) && value.length > 0) {
        const primary = value.find((e: any) => e.primary) || value[0]
        if (primary?.value) emp.email = primary.value.toLowerCase()
      }
      break
    case 'externalid':
      if (typeof value === 'string') emp.externalId = value
      break
    case 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:user':
      if (typeof value === 'object' && value !== null) {
        if (value.department) emp.department = value.department
      }
      break
  }
}


function getUserSchema() {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
    id: 'urn:ietf:params:scim:schemas:core:2.0:User',
    name: 'User',
    description: 'User Account',
    attributes: [
      { name: 'userName', type: 'string', multiValued: false, required: true, caseExact: false, mutability: 'readWrite', returned: 'default', uniqueness: 'server' },
      {
        name: 'name', type: 'complex', multiValued: false, required: false, mutability: 'readWrite', returned: 'default',
        subAttributes: [
          { name: 'givenName', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
          { name: 'familyName', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
          { name: 'formatted', type: 'string', multiValued: false, required: false, mutability: 'readOnly', returned: 'default' }
        ]
      },
      { name: 'displayName', type: 'string', multiValued: false, required: false, mutability: 'readOnly', returned: 'default' },
      {
        name: 'emails', type: 'complex', multiValued: true, required: false, mutability: 'readWrite', returned: 'default',
        subAttributes: [
          { name: 'value', type: 'string', multiValued: false, required: false, mutability: 'readWrite' },
          { name: 'type', type: 'string', multiValued: false, required: false, mutability: 'readWrite' },
          { name: 'primary', type: 'boolean', multiValued: false, required: false, mutability: 'readWrite' }
        ]
      },
      { name: 'active', type: 'boolean', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
      { name: 'title', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
      { name: 'externalId', type: 'string', multiValued: false, required: false, caseExact: true, mutability: 'readWrite', returned: 'default' }
    ],
    meta: {
      resourceType: 'Schema',
      location: `${getScimBaseUrl()}/Schemas/urn:ietf:params:scim:schemas:core:2.0:User`
    }
  }
}

export default scimRoutes
