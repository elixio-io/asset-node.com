
import { faker } from '@faker-js/faker'


function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item.value
  }
  return items[items.length - 1].value
}

export function createBatch<T>(factory: () => T, count: number): T[] {
  return Array.from({ length: count }, factory)
}


const APPLE_MODELS = [
  { value: 'MacBook Pro 16" (M4 Pro)', weight: 20 },
  { value: 'MacBook Pro 14" (M4)', weight: 18 },
  { value: 'MacBook Air 15" (M3)', weight: 15 },
  { value: 'MacBook Air 13" (M3)', weight: 12 },
  { value: 'iMac 24" (M4)', weight: 8 },
  { value: 'Mac Mini (M4)', weight: 6 },
  { value: 'Mac Studio (M4 Max)', weight: 4 },
  { value: 'Mac Pro (M2 Ultra)', weight: 2 },
  { value: 'iPad Pro 13" (M4)', weight: 5 },
  { value: 'iPad Air 13" (M2)', weight: 4 },
  { value: 'iPhone 16 Pro', weight: 8 },
  { value: 'iPhone 16', weight: 6 },
  { value: 'iPhone 15 Pro', weight: 4 },
  { value: 'Apple TV 4K', weight: 2 },
] as const

const APPLE_OS_VERSIONS = ['15.3', '15.2.1', '15.1', '14.7.2', '18.3.1', '18.2', '17.7.3']
function appleSerialNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}


const WINDOWS_MODELS = [
  { value: 'Surface Laptop 6', weight: 15 },
  { value: 'Surface Pro 10', weight: 12 },
  { value: 'ThinkPad X1 Carbon Gen 12', weight: 18 },
  { value: 'ThinkPad T14s Gen 5', weight: 14 },
  { value: 'Dell Latitude 7450', weight: 12 },
  { value: 'Dell XPS 15 9530', weight: 8 },
  { value: 'HP EliteBook 860 G11', weight: 10 },
  { value: 'HP ZBook Studio G11', weight: 5 },
  { value: 'Lenovo ThinkStation P3', weight: 3 },
  { value: 'Dell OptiPlex 7020', weight: 5 },
] as const

const WINDOWS_OS_VERSIONS = ['10.0.19045.4170', '10.0.22631.3296', '10.0.22621.3155', '10.0.26100.1']


export interface KandjiDevice {
  device_id: string
  device_name: string
  model: string
  serial_number: string
  platform: string
  os_version: string
  last_check_in: string
  blueprint_id: string
  blueprint_name: string
  asset_tag: string
  is_missing: boolean
  is_removed: boolean
  agent_version: string
  first_enrollment: string
  last_enrollment: string
  mdm_enabled: boolean
  user: {
    email: string
    name: string
    id: number
  } | null
}

export function createKandjiDevice(): KandjiDevice {
  const model = weightedPick(APPLE_MODELS)
  const platform = model.includes('iPad') ? 'iPad'
    : model.includes('iPhone') ? 'iPhone'
      : model.includes('Apple TV') ? 'AppleTV' : 'Mac'
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const hasUser = Math.random() > 0.15

  return {
    device_id: faker.string.uuid(),
    device_name: `${firstName}'s ${model.split('(')[0].trim()}`,
    model,
    serial_number: appleSerialNumber(),
    platform,
    os_version: pick(APPLE_OS_VERSIONS),
    last_check_in: faker.date.recent({ days: 3 }).toISOString(),
    blueprint_id: faker.string.uuid(),
    blueprint_name: pick(['Standard Mac', 'Engineering Mac', 'Exec Mac', 'Shared iPad', 'Company iPhone']),
    asset_tag: `AN-${faker.number.int({ min: 1000, max: 9999 })}`,
    is_missing: Math.random() < 0.03,
    is_removed: false,
    agent_version: `4.${faker.number.int({ min: 0, max: 5 })}.${faker.number.int({ min: 0, max: 9 })}`,
    first_enrollment: faker.date.past({ years: 2 }).toISOString(),
    last_enrollment: faker.date.past({ years: 1 }).toISOString(),
    mdm_enabled: true,
    user: hasUser ? {
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      name: `${firstName} ${lastName}`,
      id: faker.number.int({ min: 1, max: 5000 })
    } : null
  }
}


export interface IntuneDevice {
  id: string
  userId: string
  deviceName: string
  managedDeviceOwnerType: 'company' | 'personal'
  operatingSystem: string
  osVersion: string
  complianceState: 'compliant' | 'noncompliant' | 'unknown'
  manufacturer: string
  model: string
  serialNumber: string
  imei: string
  enrolledDateTime: string
  lastSyncDateTime: string
  aadDeviceId: string
  emailAddress: string
  azureADRegistered: boolean
  deviceRegistrationState: string
  managementAgent: string
  enrollmentType: string
  physicalMemoryInBytes: number
  ethernetMacAddress: string | null
}

export function createIntuneDevice(): IntuneDevice {
  const isWindows = Math.random() > 0.2
  const model = isWindows ? weightedPick(WINDOWS_MODELS) : weightedPick(APPLE_MODELS)
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    deviceName: `${isWindows ? 'DESKTOP' : 'MACOS'}-${faker.string.alphanumeric(7).toUpperCase()}`,
    managedDeviceOwnerType: Math.random() > 0.15 ? 'company' : 'personal',
    operatingSystem: isWindows ? 'Windows' : 'macOS',
    osVersion: isWindows ? pick(WINDOWS_OS_VERSIONS) : pick(APPLE_OS_VERSIONS),
    complianceState: weightedPick([
      { value: 'compliant' as const, weight: 80 },
      { value: 'noncompliant' as const, weight: 12 },
      { value: 'unknown' as const, weight: 8 }
    ]),
    manufacturer: isWindows
      ? pick(['Microsoft Corporation', 'Lenovo', 'Dell Inc.', 'HP'])
      : 'Apple',
    model,
    serialNumber: isWindows
      ? faker.string.alphanumeric(10).toUpperCase()
      : appleSerialNumber(),
    imei: faker.phone.imei(),
    enrolledDateTime: faker.date.past({ years: 2 }).toISOString(),
    lastSyncDateTime: faker.date.recent({ days: 5 }).toISOString(),
    aadDeviceId: faker.string.uuid(),
    emailAddress: faker.internet.email({ firstName, lastName }).toLowerCase(),
    azureADRegistered: true,
    deviceRegistrationState: 'registered',
    managementAgent: 'mdm',
    enrollmentType: 'userEnrollment',
    physicalMemoryInBytes: pick([8, 16, 32, 64]) * 1024 * 1024 * 1024,
    ethernetMacAddress: Math.random() > 0.4 ? faker.internet.mac() : null
  }
}


export interface AutopilotDevice {
  id: string
  groupTag: string
  purchaseOrderIdentifier: string
  serialNumber: string
  manufacturer: string
  model: string
  productKey: string
  hardwareIdentifier: string
  enrollmentState: { value: string }
  lastContactedDateTime: string
  addressableUserName: string
  userPrincipalName: string
  deploymentProfileAssignmentStatus: string
}

export function createAutopilotDevice(): AutopilotDevice {
  const model = weightedPick(WINDOWS_MODELS)
  const manufacturer = model.includes('Surface') ? 'Microsoft Corporation'
    : model.includes('ThinkPad') || model.includes('ThinkStation') ? 'Lenovo'
      : model.includes('Dell') || model.includes('OptiPlex') ? 'Dell Inc.'
        : 'HP'
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    id: faker.string.uuid(),
    groupTag: pick(['Standard', 'Engineering', 'Executive', 'Shared', '']),
    purchaseOrderIdentifier: `PO-${faker.number.int({ min: 10000, max: 99999 })}`,
    serialNumber: faker.string.alphanumeric(10).toUpperCase(),
    manufacturer,
    model,
    productKey: '',
    hardwareIdentifier: faker.string.hexadecimal({ length: 64, casing: 'upper', prefix: '' }),
    enrollmentState: { value: pick(['enrolled', 'pendingReset', 'failed', 'notContacted']) },
    lastContactedDateTime: faker.date.recent({ days: 7 }).toISOString(),
    addressableUserName: `${firstName} ${lastName}`,
    userPrincipalName: faker.internet.email({ firstName, lastName }).toLowerCase(),
    deploymentProfileAssignmentStatus: pick(['assigned', 'pending', 'notAssigned'])
  }
}


export interface JamfProComputer {
  id: number
  name: string
  managed: boolean
  username: string
  model: string
  department: string
  building: string
  mac_address: string
  udid: string
  serial_number: string
  os_version: string
  os_build: string
  platform: string
  is_managed: boolean
  last_check_in: string
  last_inventory_update: string
  site: { id: number; name: string }
  hardware: {
    make: string
    model: string
    model_identifier: string
    os_version: string
    processor_type: string
    total_ram_mb: number
    storage_mb: number
    battery_capacity: number
  }
}

export function createJamfProComputer(): JamfProComputer {
  const model = weightedPick(APPLE_MODELS)
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    id: faker.number.int({ min: 1, max: 50000 }),
    name: `${firstName}'s ${model.split('(')[0].trim()}`,
    managed: true,
    username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    model,
    department: pick(['Engineering', 'Design', 'Marketing', 'Sales', 'IT', 'HR', 'Finance']),
    building: pick(['HQ Berlin', 'Munich Office', 'Hamburg Office', 'Remote']),
    mac_address: faker.internet.mac(),
    udid: faker.string.uuid().toUpperCase(),
    serial_number: appleSerialNumber(),
    os_version: pick(APPLE_OS_VERSIONS),
    os_build: `24${String.fromCharCode(65 + faker.number.int({ min: 0, max: 5 }))}${faker.number.int({ min: 50, max: 999 })}`,
    platform: model.includes('iPad') ? 'iPad' : model.includes('iPhone') ? 'iPhone' : 'Mac',
    is_managed: true,
    last_check_in: faker.date.recent({ days: 3 }).toISOString(),
    last_inventory_update: faker.date.recent({ days: 5 }).toISOString(),
    site: { id: 1, name: 'Default' },
    hardware: {
      make: 'Apple',
      model,
      model_identifier: `Mac${faker.number.int({ min: 14, max: 16 })},${faker.number.int({ min: 1, max: 10 })}`,
      os_version: pick(APPLE_OS_VERSIONS),
      processor_type: pick(['Apple M4', 'Apple M4 Pro', 'Apple M4 Max', 'Apple M3', 'Apple M3 Pro']),
      total_ram_mb: pick([8192, 16384, 32768, 49152, 65536]),
      storage_mb: pick([256000, 512000, 1024000, 2048000]),
      battery_capacity: faker.number.int({ min: 70, max: 100 })
    }
  }
}


export interface JamfSchoolDevice {
  UDID: string
  serialNumber: string
  name: string
  model: string
  os: string
  isManaged: boolean
  isSupervised: boolean
  ownerType: string
  locationId: number
  locationName: string
  groupIds: number[]
  notes: string
  assetTag: string
  enrolledAt: string
  lastSeen: string
  owner: { id: number; name: string; email: string } | null
}

export function createJamfSchoolDevice(): JamfSchoolDevice {
  const model = weightedPick(APPLE_MODELS.filter(m => m.value.includes('iPad') || m.value.includes('Mac')))
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const hasOwner = Math.random() > 0.2

  return {
    UDID: faker.string.uuid().toUpperCase(),
    serialNumber: appleSerialNumber(),
    name: `${firstName}'s ${model.split('(')[0].trim()}`,
    model,
    os: pick(APPLE_OS_VERSIONS),
    isManaged: true,
    isSupervised: Math.random() > 0.1,
    ownerType: pick(['student', 'teacher', 'shared']),
    locationId: faker.number.int({ min: 1, max: 10 }),
    locationName: pick(['Main Campus', 'Science Building', 'Library', 'Admin Office']),
    groupIds: [faker.number.int({ min: 1, max: 20 })],
    notes: '',
    assetTag: `JS-${faker.number.int({ min: 1000, max: 9999 })}`,
    enrolledAt: faker.date.past({ years: 2 }).toISOString(),
    lastSeen: faker.date.recent({ days: 3 }).toISOString(),
    owner: hasOwner ? {
      id: faker.number.int({ min: 1, max: 5000 }),
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase()
    } : null
  }
}
