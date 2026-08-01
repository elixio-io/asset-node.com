
import { faker } from '@faker-js/faker'


function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function createBatch<T>(factory: () => T, count: number): T[] {
  return Array.from({ length: count }, factory)
}


const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'IT', 'Operations', 'Customer Success', 'Legal'
]

const JOB_TITLES: Record<string, string[]> = {
  Engineering: ['Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Engineering Manager', 'DevOps Engineer'],
  Product: ['Product Manager', 'Senior PM', 'Product Director', 'Product Analyst'],
  Design: ['Product Designer', 'UX Designer', 'UI Designer', 'Design Lead'],
  Marketing: ['Marketing Manager', 'Content Strategist', 'Growth Manager', 'Brand Designer'],
  Sales: ['Account Executive', 'Sales Manager', 'SDR', 'VP Sales'],
  Finance: ['Financial Analyst', 'Controller', 'Accountant', 'CFO'],
  HR: ['HR Manager', 'Recruiter', 'People Ops', 'HR Director'],
  IT: ['IT Administrator', 'Help Desk Specialist', 'IT Manager', 'Security Engineer'],
  Operations: ['Operations Manager', 'Facilities Coordinator', 'Office Manager'],
  'Customer Success': ['CS Manager', 'Support Engineer', 'Success Lead'],
  Legal: ['Legal Counsel', 'Compliance Officer', 'Paralegal']
}

function getDepartmentAndTitle(): { department: string; jobTitle: string } {
  const department = pick(DEPARTMENTS)
  const titles = JOB_TITLES[department] || ['Specialist']
  return { department, jobTitle: pick(titles) }
}


export interface PersonioPerson {
  type: 'Person'
  attributes: {
    id: { value: string }
    first_name: { value: string }
    last_name: { value: string }
    email: { value: string }
  }
}

export interface PersonioEmployment {
  type: 'Employment'
  attributes: {
    id: { value: string }
    status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING' | 'LEAVE'
    position?: { name: string }
    employment_start_date?: string
    termination_date?: string | null
    org_units?: Array<{ name: string; type: string }>
  }
}

export function createPersonioPerson(): PersonioPerson {
  return {
    type: 'Person',
    attributes: {
      id: { value: faker.string.numeric(6) },
      first_name: { value: faker.person.firstName() },
      last_name: { value: faker.person.lastName() },
      email: { value: faker.internet.email().toLowerCase() }
    }
  }
}

export function createPersonioEmployment(status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING' = 'ACTIVE'): PersonioEmployment {
  const { department, jobTitle } = getDepartmentAndTitle()
  const startDate = faker.date.past({ years: 3 })

  return {
    type: 'Employment',
    attributes: {
      id: { value: faker.string.numeric(6) },
      status,
      position: { name: jobTitle },
      employment_start_date: startDate.toISOString().split('T')[0],
      termination_date: status === 'INACTIVE' ? faker.date.recent().toISOString().split('T')[0] : null,
      org_units: [
        { name: department, type: 'department' },
        { name: pick(['Berlin', 'Munich', 'Hamburg', 'London', 'Remote']), type: 'office' }
      ]
    }
  }
}


export interface BambooHREmployee {
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

export function createBambooHREmployee(): BambooHREmployee {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const { department, jobTitle } = getDepartmentAndTitle()

  return {
    id: faker.string.numeric(5),
    displayName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    workEmail: faker.internet.email({ firstName, lastName }).toLowerCase(),
    department,
    jobTitle,
    location: pick(['Berlin', 'Munich', 'Hamburg', 'London', 'New York', 'Remote']),
    workPhone: faker.phone.number(),
    status: 'Active',
    photoUrl: `https://resources.bamboohr.com/images/photos/${faker.string.numeric(8)}.jpg`
  }
}


export interface GoogleWorkspaceUser {
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

export function createGoogleWorkspaceUser(domain = 'acme.com'): GoogleWorkspaceUser {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const { department, jobTitle } = getDepartmentAndTitle()

  return {
    id: faker.string.numeric(21),
    primaryEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    name: {
      givenName: firstName,
      familyName: lastName,
      fullName: `${firstName} ${lastName}`
    },
    organizations: [
      {
        department,
        title: jobTitle,
        primary: true
      }
    ],
    suspended: false,
    creationTime: faker.date.past({ years: 2 }).toISOString(),
    lastLoginTime: faker.date.recent().toISOString(),
    orgUnitPath: `/${department}`,
    isAdmin: Math.random() < 0.05
  }
}


export interface HiBobEmployee {
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

export function createHiBobEmployee(): HiBobEmployee {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const { department, jobTitle } = getDepartmentAndTitle()

  return {
    id: faker.string.numeric(10),
    firstName,
    surname: lastName,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    work: {
      department,
      title: jobTitle,
      site: pick(['Berlin HQ', 'Munich Office', 'London Office', 'Remote']),
      startDate: faker.date.past({ years: 3 }).toISOString().split('T')[0]
    },
    personal: {
      communication: {
        workPhone: faker.phone.number()
      }
    },
    humanReadable: {
      department,
      title: jobTitle,
      site: 'Berlin HQ'
    }
  }
}


export interface MosyleDevice {
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

const MOSYLE_MODELS = [
  'MacBook Pro 16-inch (M3 Pro)',
  'MacBook Air 15-inch (M3)',
  'MacBook Pro 14-inch (M3)',
  'iMac 24-inch (M3)',
  'Mac mini (M2 Pro)',
  'iPad Pro 12.9-inch (6th gen)',
  'iPad Air (5th gen)',
  'iPhone 15 Pro',
  'iPhone 16',
  'Apple TV 4K'
]

const MOSYLE_OS_VERSIONS = ['15.3.1', '15.2', '18.3.1', '18.2', '17.7.3']

function appleSerialNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function createMosyleDevice(): MosyleDevice {
  const model = pick(MOSYLE_MODELS)
  const isMac = model.toLowerCase().includes('mac')

  return {
    serial_number: appleSerialNumber(),
    device_model: model,
    device_name: `${faker.person.firstName()}'s ${model.split(' (')[0]}`,
    os_version: pick(MOSYLE_OS_VERSIONS),
    device_type: isMac ? 'mac' : model.toLowerCase().includes('tv') ? 'tvos' : 'ios',
    userid: faker.internet.email().toLowerCase(),
    date_last_beat: faker.date.recent().toISOString(),
    asset_tag: Math.random() > 0.3 ? faker.string.alphanumeric(8).toUpperCase() : undefined,
    tags: Math.random() > 0.5 ? [pick(['corp', 'shared', 'exec', 'intern'])] : undefined
  }
}
