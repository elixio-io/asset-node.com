
import { faker } from '@faker-js/faker'


function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function createBatch<T>(factory: () => T, count: number): T[] {
  return Array.from({ length: count }, factory)
}


const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'Legal', 'IT', 'Operations', 'Customer Success'
] as const

const JOB_TITLES: Record<string, string[]> = {
  Engineering: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Engineering Manager', 'DevOps Engineer', 'QA Engineer'],
  Product: ['Product Manager', 'Senior PM', 'VP Product', 'Product Analyst'],
  Design: ['UI Designer', 'UX Designer', 'Design Lead', 'Brand Designer'],
  Marketing: ['Marketing Manager', 'Content Lead', 'Growth Manager', 'SEO Specialist'],
  Sales: ['Account Executive', 'Sales Manager', 'BDR', 'VP Sales'],
  Finance: ['Accountant', 'Finance Manager', 'Controller', 'CFO'],
  HR: ['HR Manager', 'Recruiter', 'People Ops Lead', 'Head of People'],
  Legal: ['Legal Counsel', 'Compliance Officer'],
  IT: ['IT Administrator', 'Help Desk Specialist', 'IT Manager', 'Security Engineer'],
  Operations: ['Operations Manager', 'Facilities Coordinator', 'Office Manager'],
  'Customer Success': ['CS Manager', 'Support Engineer', 'Success Lead']
}


export interface ScimUser {
  schemas: string[]
  id: string
  externalId: string
  userName: string
  name: {
    givenName: string
    familyName: string
    formatted: string
  }
  displayName: string
  emails: { value: string; type: string; primary: boolean }[]
  active: boolean
  title: string
  department: string
  addresses: { type: string; streetAddress: string; locality: string; region: string; postalCode: string; country: string; primary: boolean }[]
  phoneNumbers: { value: string; type: string }[]
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
    employeeNumber: string
    department: string
    manager: { value: string; displayName: string } | undefined
    costCenter: string
    organization: string
  }
  meta: {
    resourceType: string
    created: string
    lastModified: string
    location: string
  }
}

export function createScimUser(options?: { orgDomain?: string; managerId?: string; managerName?: string }): ScimUser {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const domain = options?.orgDomain || 'evinsta.com'
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`
  const dept = pick(DEPARTMENTS)
  const titles = JOB_TITLES[dept] || ['Specialist']
  const title = pick(titles)
  const id = faker.string.uuid()

  return {
    schemas: [
      'urn:ietf:params:scim:schemas:core:2.0:User',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
    ],
    id,
    externalId: faker.string.alphanumeric(12),
    userName: email,
    name: {
      givenName: firstName,
      familyName: lastName,
      formatted: `${firstName} ${lastName}`
    },
    displayName: `${firstName} ${lastName}`,
    emails: [
      { value: email, type: 'work', primary: true }
    ],
    active: Math.random() > 0.05,
    title,
    department: dept,
    addresses: [{
      type: 'work',
      streetAddress: faker.location.streetAddress(),
      locality: faker.location.city(),
      region: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: 'DE',
      primary: true
    }],
    phoneNumbers: Math.random() > 0.3
      ? [{ value: faker.phone.number(), type: 'work' }]
      : [],
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
      employeeNumber: `EMP-${faker.number.int({ min: 1000, max: 9999 })}`,
      department: dept,
      manager: options?.managerId
        ? { value: options.managerId, displayName: options.managerName || 'Manager' }
        : undefined,
      costCenter: `CC-${faker.number.int({ min: 100, max: 999 })}`,
      organization: 'Evinsta'
    },
    meta: {
      resourceType: 'User',
      created: faker.date.past({ years: 2 }).toISOString(),
      lastModified: faker.date.recent({ days: 30 }).toISOString(),
      location: `/scim/v2/Users/${id}`
    }
  }
}


export interface ScimListResponse {
  schemas: string[]
  totalResults: number
  itemsPerPage: number
  startIndex: number
  Resources: ScimUser[]
}

export function createScimListResponse(count: number, startIndex = 1): ScimListResponse {
  const users = createBatch(createScimUser, count)
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: count,
    itemsPerPage: count,
    startIndex,
    Resources: users
  }
}


export interface ScimBulkOperation {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  bulkId: string
  data?: Partial<ScimUser>
}

export function createScimProvisioningBatch(count: number): ScimBulkOperation[] {
  return createBatch(createScimUser, count).map(user => ({
    method: 'POST' as const,
    path: '/scim/v2/Users',
    bulkId: `user-${user.id}`,
    data: user
  }))
}

export function createScimDeprovisioningBatch(userIds: string[]): ScimBulkOperation[] {
  return userIds.map(id => ({
    method: 'PATCH' as const,
    path: `/scim/v2/Users/${id}`,
    bulkId: `deactivate-${id}`,
    data: {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      active: false
    } as any
  }))
}


export interface SsoAssertionMetadata {
  nameId: string
  email: string
  firstName: string
  lastName: string
  sessionIndex: string
  issuer: string
  attributes: Record<string, string>
}

export function createSsoAssertion(provider: 'azure' | 'okta' | 'onelogin' | 'jumpcloud' | 'google'): SsoAssertionMetadata {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const email = faker.internet.email({ firstName, lastName }).toLowerCase()

  const issuerMap: Record<string, string> = {
    azure: `https://sts.windows.net/${faker.string.uuid()}/`,
    okta: `http://www.okta.com/${faker.string.alphanumeric(20)}`,
    onelogin: `https://app.onelogin.com/saml/metadata/${faker.number.int({ min: 100000, max: 999999 })}`,
    jumpcloud: `https://sso.jumpcloud.com/saml2/${faker.string.alphanumeric(24)}`,
    google: `https://accounts.google.com/o/saml2?idpid=${faker.string.alphanumeric(12)}`
  }

  return {
    nameId: email,
    email,
    firstName,
    lastName,
    sessionIndex: `_${faker.string.hexadecimal({ length: 40, casing: 'lower', prefix: '' })}`,
    issuer: issuerMap[provider],
    attributes: {
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': email,
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': firstName,
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': lastName,
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': `${firstName} ${lastName}`
    }
  }
}
