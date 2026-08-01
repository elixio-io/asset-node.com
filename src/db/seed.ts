
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { connectDB } from './connection'
import { Organization } from '../models/Organization'
import { User } from '../models/User'
import { Employee } from '../models/Employee'
import { Location } from '../models/Location'
import { Hardware } from '../models/Hardware'
import { Peripheral } from '../models/Peripheral'
import { Assignment } from '../models/Assignment'
import { MaintenanceRecord } from '../models/MaintenanceRecord'
import { AssetEvent } from '../models/AssetEvent'
import { AuditLog } from '../models/AuditLog'
import { AILog } from '../models/AILog'
import { Category } from '../models/Category'
import { Department } from '../models/Department'
import { Manufacturer } from '../models/Manufacturer'
import { Status } from '../models/Status'
import { Supplier } from '../models/Supplier'
import { Component } from '../models/Component'
import { Consumable } from '../models/Consumable'
import { SoftwareLicense } from '../models/SoftwareLicense'
import { CustomField } from '../models/CustomField'
import { Kit } from '../models/Kit'
import { Depreciation } from '../models/Depreciation'

const SALT_ROUNDS = 12

async function seed() {
  console.log('🌱 Starting fresh seed...')
  await connectDB()

  console.log('🗑️  Dropping all collections...')
  await Organization.deleteMany({})
  await User.deleteMany({})
  await Employee.deleteMany({})
  await Location.deleteMany({})
  await Hardware.deleteMany({})
  await Peripheral.deleteMany({})
  await Assignment.deleteMany({})
  await MaintenanceRecord.deleteMany({})
  await AssetEvent.deleteMany({})
  await AuditLog.deleteMany({})
  await AILog.deleteMany({})
  await Category.deleteMany({})
  await Department.deleteMany({})
  await Manufacturer.deleteMany({})
  await Status.deleteMany({})
  await Supplier.deleteMany({})
  await Component.deleteMany({})
  await Consumable.deleteMany({})
  await SoftwareLicense.deleteMany({})
  await CustomField.deleteMany({})
  await Kit.deleteMany({})
  await Depreciation.deleteMany({})

  console.log('📦 Creating organizations...')
  const evinsta = await Organization.create({
    name: 'Evinsta',
    slug: 'evinsta',
    settings: {
      defaultCurrency: 'EUR',
      depreciationYears: 3,
      lowStockThreshold: 3,
      customStatuses: ['pending-approval', 'in-transit'],
      customFields: [
        { name: 'Asset Tag', fieldType: 'text', required: true },
        { name: 'Insurance Value', fieldType: 'number', required: false }
      ],
      integrations: {
        kandji: {
          enabled: true,
          subdomain: 'evinsta',
          apiToken: 'mock-kandji-api-token',
          syncInterval: 60
        },
        intune: {
          enabled: true,
          tenantId: 'mock-tenant-id-00000',
          clientId: 'mock-client-id-00000',
          clientSecret: 'mock-client-secret-00000',
          syncInterval: 60
        },
        jamf: {
          enabled: true,
          serverUrl: 'https://evinsta.jamfcloud.com',
          username: 'mock-admin',
          password: 'mock-password',
          syncInterval: 60
        },
        scim: {
          enabled: true,
          bearerToken: 'mock-scim-token-for-testing',
          provisionUsers: true,
          deprovisionUsers: false
        },
        sso: {
          enabled: false
        }
      }
    }
  })

  const techcorp = await Organization.create({
    name: 'TechCorp GmbH',
    slug: 'techcorp-gmbh',
    settings: {
      defaultCurrency: 'EUR',
      depreciationYears: 5,
      lowStockThreshold: 5,
      customStatuses: ['leased'],
      customFields: [
        { name: 'Cost Center', fieldType: 'text', required: true }
      ]
    }
  })

  console.log('👤 Creating users...')
  const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS)

  const [adminEvinsta, managerEvinsta, empUserEvinsta] = await User.create([
    {
      email: 'admin@evinsta.com', firstName: 'Alex', lastName: 'von Hohnhorst',
      orgId: evinsta._id, companyName: 'Evinsta', role: 'admin',
      hashedPassword, isActive: true
    },
    {
      email: 'sarah@evinsta.com', firstName: 'Sarah', lastName: 'Müller',
      orgId: evinsta._id, companyName: 'Evinsta', role: 'manager',
      department: 'IT', hashedPassword, isActive: true
    },
    {
      email: 'tom@evinsta.com', firstName: 'Tom', lastName: 'Becker',
      orgId: evinsta._id, companyName: 'Evinsta', role: 'employee',
      department: 'Engineering', hashedPassword, isActive: true
    }
  ])

  const [adminTech, managerTech] = await User.create([
    {
      email: 'admin@techcorp.de', firstName: 'Max', lastName: 'Schmidt',
      orgId: techcorp._id, companyName: 'TechCorp GmbH', role: 'admin',
      hashedPassword, isActive: true
    },
    {
      email: 'lisa@techcorp.de', firstName: 'Lisa', lastName: 'Weber',
      orgId: techcorp._id, companyName: 'TechCorp GmbH', role: 'manager',
      department: 'Operations', hashedPassword, isActive: true
    }
  ])

  console.log('📍 Creating locations...')
  const [berlinHQ, munichOffice] = await Location.create([
    { orgId: evinsta._id, name: 'Berlin HQ', address: { street: 'Friedrichstr. 123', city: 'Berlin', state: 'Berlin', zip: '10117', country: 'Deutschland' }, contactName: 'Anna Schneider', contactEmail: 'office@evinsta.com', contactPhone: '+49 30 12345678', isActive: true },
    { orgId: evinsta._id, name: 'München Büro', address: { street: 'Leopoldstr. 45', city: 'München', state: 'Bayern', zip: '80802', country: 'Deutschland' }, contactName: 'Thomas Bauer', contactEmail: 'munich@evinsta.com', contactPhone: '+49 89 98765432', isActive: true }
  ])

  const [frankfurtHQ] = await Location.create([
    { orgId: techcorp._id, name: 'Frankfurt HQ', address: { street: 'Mainzer Landstr. 99', city: 'Frankfurt', state: 'Hessen', zip: '60329', country: 'Deutschland' }, contactName: 'Martin Weber', contactEmail: 'hq@techcorp.de', contactPhone: '+49 69 11223344', isActive: true }
  ])

  console.log('🧑‍💼 Creating employees...')
  const adminEmp = await Employee.create({
    orgId: evinsta._id, userId: adminEvinsta._id,
    firstName: 'Alex', lastName: 'von Hohnhorst', email: 'admin@evinsta.com',
    department: 'Management', jobTitle: 'CEO', isActive: true, startDate: new Date('2024-01-01')
  })

  const sarahEmp = await Employee.create({
    orgId: evinsta._id, userId: managerEvinsta._id,
    firstName: 'Sarah', lastName: 'Müller', email: 'sarah@evinsta.com',
    department: 'IT', jobTitle: 'IT Manager', managerId: adminEmp._id,
    isActive: true, startDate: new Date('2024-03-15')
  })

  const tomEmp = await Employee.create({
    orgId: evinsta._id, userId: empUserEvinsta._id,
    firstName: 'Tom', lastName: 'Becker', email: 'tom@evinsta.com',
    department: 'Engineering', jobTitle: 'Software Engineer', managerId: sarahEmp._id,
    isActive: true, startDate: new Date('2024-06-01')
  })

  const juliaEmp = await Employee.create({
    orgId: evinsta._id,
    firstName: 'Julia', lastName: 'Richter', email: 'julia.richter@evinsta.com',
    department: 'Design', jobTitle: 'UI Designer', managerId: sarahEmp._id,
    isActive: true, startDate: new Date('2025-01-10')
  })

  const martinEmp = await Employee.create({
    orgId: evinsta._id,
    firstName: 'Martin', lastName: 'Hoffmann', email: 'martin.hoffmann@evinsta.com',
    department: 'Engineering', jobTitle: 'DevOps Engineer', managerId: sarahEmp._id,
    isActive: true, startDate: new Date('2025-02-01')
  })

  const maxEmp = await Employee.create({
    orgId: techcorp._id, userId: adminTech._id,
    firstName: 'Max', lastName: 'Schmidt', email: 'admin@techcorp.de',
    department: 'Management', jobTitle: 'CTO', isActive: true, startDate: new Date('2023-06-01')
  })

  const lisaEmp = await Employee.create({
    orgId: techcorp._id, userId: managerTech._id,
    firstName: 'Lisa', lastName: 'Weber', email: 'lisa@techcorp.de',
    department: 'Operations', jobTitle: 'Operations Lead', managerId: maxEmp._id,
    isActive: true, startDate: new Date('2024-01-01')
  })

  console.log('📂 Creating categories...')
  const catDocs = await Category.create([
    { orgId: evinsta._id, name: 'Laptops', entityType: 'hardware', icon: 'pi pi-desktop', color: '#4CAF50', description: 'Tragbare Computer', isDefault: true },
    { orgId: evinsta._id, name: 'Desktops', entityType: 'hardware', icon: 'pi pi-server', color: '#2196F3', description: 'Stationäre Arbeitsplätze' },
    { orgId: evinsta._id, name: 'Monitore', entityType: 'hardware', icon: 'pi pi-desktop', color: '#9C27B0', description: 'Bildschirme und Displays' },
    { orgId: evinsta._id, name: 'Mobilgeräte', entityType: 'hardware', icon: 'pi pi-mobile', color: '#FF9800', description: 'Smartphones und Tablets' },
    { orgId: evinsta._id, name: 'Netzwerk', entityType: 'hardware', icon: 'pi pi-globe', color: '#00BCD4', description: 'Router, Switches, Access Points' },
    { orgId: evinsta._id, name: 'Server', entityType: 'hardware', icon: 'pi pi-server', color: '#3F51B5', description: 'Rack- und Tower-Server' },
    { orgId: evinsta._id, name: 'Drucker', entityType: 'hardware', icon: 'pi pi-print', color: '#795548', description: 'Drucker und Scanner' },
    { orgId: evinsta._id, name: 'Eingabegeräte', entityType: 'peripheral', icon: 'pi pi-pencil', color: '#795548', description: 'Mäuse, Tastaturen, Stifte', isDefault: true },
    { orgId: evinsta._id, name: 'Audio/Video', entityType: 'peripheral', icon: 'pi pi-volume-up', color: '#E91E63', description: 'Headsets, Webcams, Mikrofone' },
    { orgId: evinsta._id, name: 'Kabel & Adapter', entityType: 'consumable', icon: 'pi pi-link', color: '#607D8B', description: 'USB-C Kabel, Adapter, Dongles', isDefault: true },
    { orgId: evinsta._id, name: 'Büromaterial', entityType: 'consumable', icon: 'pi pi-box', color: '#FF5722', description: 'Toner, Papier, Druckerzubehör' },
    { orgId: evinsta._id, name: 'Produktivität', entityType: 'license', icon: 'pi pi-briefcase', color: '#3F51B5', description: 'Office, Collaboration Tools', isDefault: true },
    { orgId: evinsta._id, name: 'Entwicklung', entityType: 'license', icon: 'pi pi-code', color: '#009688', description: 'IDEs, DevTools, CI/CD' },
    { orgId: evinsta._id, name: 'Sicherheit', entityType: 'license', icon: 'pi pi-shield', color: '#F44336', description: 'Antivirus, VPN, MDM' },
  ])
  const catMap: Record<string, any> = {}
  catDocs.forEach(c => { catMap[c.name] = c._id })

  console.log('🏷️  Creating statuses...')
  const statusDocs = await Status.create([
    { orgId: evinsta._id, name: 'Einsatzbereit', slug: 'available', isSystem: true, type: 'deployable', color: '#4CAF50', icon: 'pi pi-check-circle', isDefault: true, description: 'Gerät kann zugewiesen werden' },
    { orgId: evinsta._id, name: 'Zugewiesen', slug: 'assigned', isSystem: true, type: 'deployed', color: '#2196F3', icon: 'pi pi-user', description: 'Gerät ist einem Mitarbeiter zugewiesen' },
    { orgId: evinsta._id, name: 'In Reparatur', slug: 'in-repair', isSystem: true, type: 'undeployable', color: '#FF9800', icon: 'pi pi-wrench', description: 'Gerät wird repariert' },
    { orgId: evinsta._id, name: 'Defekt', slug: 'defective', isSystem: true, type: 'undeployable', color: '#F44336', icon: 'pi pi-exclamation-triangle', description: 'Gerät ist defekt und nicht einsatzfähig' },
    { orgId: evinsta._id, name: 'Ausgemustert', slug: 'retired', isSystem: true, type: 'archived', color: '#9E9E9E', icon: 'pi pi-ban', description: 'Gerät ist aus dem Verkehr gezogen' },
    { orgId: evinsta._id, name: 'Zum Verkauf', slug: 'for-sale', isSystem: true, type: 'pending', color: '#9C27B0', icon: 'pi pi-shopping-cart', description: 'Gerät wird zum Verkauf angeboten' },
    { orgId: evinsta._id, name: 'Bestellt', slug: 'on-order', isSystem: true, type: 'pending', color: '#00BCD4', icon: 'pi pi-clock', description: 'Gerät wurde bestellt, Lieferung ausstehend' },
  ])
  const statMap: Record<string, any> = {}
  statusDocs.forEach(s => { statMap[s.name] = s._id })

  console.log('�icing Creating manufacturers...')
  const mfgDocs = await Manufacturer.create([
    { orgId: evinsta._id, name: 'Apple', url: 'https://www.apple.com', supportUrl: 'https://support.apple.com', supportEmail: 'support@apple.com', notes: 'MacBooks, iPhones, iPads, Displays' },
    { orgId: evinsta._id, name: 'Dell', url: 'https://www.dell.com', supportUrl: 'https://www.dell.com/support', supportEmail: 'support@dell.com', notes: 'Server, Monitore, Laptops' },
    { orgId: evinsta._id, name: 'Lenovo', url: 'https://www.lenovo.com', supportUrl: 'https://support.lenovo.com', notes: 'ThinkPad, ThinkCentre' },
    { orgId: evinsta._id, name: 'HP', url: 'https://www.hp.com', supportUrl: 'https://support.hp.com', notes: 'Drucker, EliteBook, ProDesk' },
    { orgId: evinsta._id, name: 'LG', url: 'https://www.lg.com', supportUrl: 'https://www.lg.com/support', notes: 'UltraFine Monitore' },
    { orgId: evinsta._id, name: 'Samsung', url: 'https://www.samsung.com', supportUrl: 'https://www.samsung.com/support', notes: 'Monitore, SSDs, Mobilgeräte' },
    { orgId: evinsta._id, name: 'Logitech', url: 'https://www.logitech.com', supportUrl: 'https://support.logitech.com', notes: 'MX Keys, MX Master, Webcams' },
    { orgId: evinsta._id, name: 'Ubiquiti', url: 'https://www.ui.com', supportUrl: 'https://help.ui.com', notes: 'UniFi Netzwerk-Infrastruktur' },
    { orgId: evinsta._id, name: 'CalDigit', url: 'https://www.caldigit.com', notes: 'Thunderbolt Docking Stations' },
    { orgId: evinsta._id, name: 'Microsoft', url: 'https://www.microsoft.com', supportUrl: 'https://support.microsoft.com', notes: 'Surface Geräte' },
    { orgId: techcorp._id, name: 'Microsoft', url: 'https://www.microsoft.com', supportUrl: 'https://support.microsoft.com', notes: 'Surface Geräte, Peripherie' },
    { orgId: techcorp._id, name: 'Apple', url: 'https://www.apple.com', supportUrl: 'https://support.apple.com', notes: 'Mac Mini' },
    { orgId: techcorp._id, name: 'Lenovo', url: 'https://www.lenovo.com', supportUrl: 'https://support.lenovo.com', notes: 'ThinkPad Laptops' },
    { orgId: techcorp._id, name: 'Samsung', url: 'https://www.samsung.com', supportUrl: 'https://www.samsung.com/support', notes: 'Odyssey Monitore' },
  ])
  const mfgMap: Record<string, any> = {}
  mfgDocs.forEach(m => { mfgMap[`${m.orgId}-${m.name}`] = m._id })
  const evMfg = (name: string) => mfgMap[`${evinsta._id}-${name}`]
  const tcMfg = (name: string) => mfgMap[`${techcorp._id}-${name}`]

  console.log('💻 Creating hardware...')
  const evinstaHardwareDefs = [
    { orgId: evinsta._id, serialNumber: 'EV-MBP-001', model: 'MacBook Pro 16"', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-01-15'), purchasePrice: 2899, warrantyExpiry: new Date('2027-01-15'), locationId: berlinHQ._id, assignedTo: tomEmp._id, tags: ['engineering', 'primary'], customFields: new Map([['Asset Tag', 'EV-2024-001']]) },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-002', model: 'MacBook Pro 14"', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-03-20'), purchasePrice: 2499, warrantyExpiry: new Date('2027-03-20'), locationId: berlinHQ._id, assignedTo: sarahEmp._id, tags: ['management'] },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-003', model: 'MacBook Air M3', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2025-01-10'), purchasePrice: 1599, warrantyExpiry: new Date('2028-01-10'), locationId: berlinHQ._id, assignedTo: juliaEmp._id, tags: ['design'] },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-004', model: 'MacBook Pro 16" M4', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-12-01'), purchasePrice: 3199, warrantyExpiry: new Date('2028-12-01'), locationId: berlinHQ._id, tags: ['spare'] },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-005', model: 'ThinkPad X1 Carbon', categoryId: catMap['Laptops'], manufacturerId: evMfg('Lenovo'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-06-15'), purchasePrice: 1899, warrantyExpiry: new Date('2028-06-15'), locationId: munichOffice._id },
    { orgId: evinsta._id, serialNumber: 'EV-DT-001', model: 'Mac Studio', categoryId: catMap['Desktops'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-06-01'), purchasePrice: 4299, warrantyExpiry: new Date('2027-06-01'), locationId: berlinHQ._id, assignedTo: martinEmp._id, tags: ['engineering', 'build-server'] },
    { orgId: evinsta._id, serialNumber: 'EV-MON-001', model: 'Studio Display', categoryId: catMap['Monitore'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-01-15'), purchasePrice: 1799, warrantyExpiry: new Date('2027-01-15'), locationId: berlinHQ._id, assignedTo: tomEmp._id },
    { orgId: evinsta._id, serialNumber: 'EV-MON-002', model: 'LG UltraFine 5K', categoryId: catMap['Monitore'], manufacturerId: evMfg('LG'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-03-20'), purchasePrice: 1399, locationId: berlinHQ._id, assignedTo: sarahEmp._id },
    { orgId: evinsta._id, serialNumber: 'EV-MON-003', model: 'Dell U2723QE', categoryId: catMap['Monitore'], manufacturerId: evMfg('Dell'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-09-01'), purchasePrice: 629, locationId: munichOffice._id },
    { orgId: evinsta._id, serialNumber: 'EV-MON-004', model: 'Dell U2723QE', categoryId: catMap['Monitore'], manufacturerId: evMfg('Dell'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-09-01'), purchasePrice: 629, locationId: munichOffice._id },
    { orgId: evinsta._id, serialNumber: 'EV-PHN-001', model: 'iPhone 15 Pro', categoryId: catMap['Mobilgeräte'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-09-20'), purchasePrice: 1199, warrantyExpiry: new Date('2026-09-20'), assignedTo: adminEmp._id, tags: ['management'] },
    { orgId: evinsta._id, serialNumber: 'EV-TAB-001', model: 'iPad Pro 12.9"', categoryId: catMap['Mobilgeräte'], manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2025-03-01'), purchasePrice: 1399, warrantyExpiry: new Date('2028-03-01'), assignedTo: juliaEmp._id, tags: ['design'] },
    { orgId: evinsta._id, serialNumber: 'EV-SRV-001', model: 'Dell PowerEdge R750', categoryId: catMap['Server'], manufacturerId: evMfg('Dell'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2023-11-01'), purchasePrice: 8500, warrantyExpiry: new Date('2026-11-01'), locationId: berlinHQ._id, tags: ['infrastructure'] },
    { orgId: evinsta._id, serialNumber: 'EV-NET-001', model: 'Ubiquiti UDM Pro', categoryId: catMap['Netzwerk'], manufacturerId: evMfg('Ubiquiti'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-02-01'), purchasePrice: 399, locationId: berlinHQ._id, tags: ['infrastructure'] },
    { orgId: evinsta._id, serialNumber: 'EV-NET-002', model: 'Ubiquiti U6 Pro', categoryId: catMap['Netzwerk'], manufacturerId: evMfg('Ubiquiti'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-02-01'), purchasePrice: 149, locationId: berlinHQ._id },
    { orgId: evinsta._id, serialNumber: 'EV-PRN-001', model: 'HP LaserJet Pro', categoryId: catMap['Drucker'], manufacturerId: evMfg('HP'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-04-01'), purchasePrice: 449, locationId: berlinHQ._id },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-006', model: 'MacBook Pro 14"', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Defekt'], purchaseDate: new Date('2023-06-01'), purchasePrice: 2299, notes: 'Screen flickering, sent to Apple for repair', tags: ['rma'] },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-007', model: 'ThinkPad T14', categoryId: catMap['Laptops'], manufacturerId: evMfg('Lenovo'), statusId: statMap['Ausgemustert'], purchaseDate: new Date('2021-03-01'), purchasePrice: 1299, notes: 'End of life, wiped and stored' },
    { orgId: evinsta._id, serialNumber: 'EV-MBP-008', model: 'MacBook Air M2', categoryId: catMap['Laptops'], manufacturerId: evMfg('Apple'), statusId: statMap['Zum Verkauf'], purchaseDate: new Date('2022-08-01'), purchasePrice: 1399, salePrice: 649, notes: 'Good condition, ready for sale' },
  ]
  const evinstaHardware: any[] = []
  for (const def of evinstaHardwareDefs) {
    evinstaHardware.push(await Hardware.create(def))
  }

  const techHardwareDefs = [
    { orgId: techcorp._id, serialNumber: 'TC-LT-001', model: 'Surface Laptop 5', categoryId: catMap['Laptops'], manufacturerId: tcMfg('Microsoft'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-06-01'), purchasePrice: 1599, warrantyExpiry: new Date('2027-06-01'), locationId: frankfurtHQ._id, assignedTo: maxEmp._id },
    { orgId: techcorp._id, serialNumber: 'TC-LT-002', model: 'Surface Laptop 5', categoryId: catMap['Laptops'], manufacturerId: tcMfg('Microsoft'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-06-01'), purchasePrice: 1599, warrantyExpiry: new Date('2027-06-01'), locationId: frankfurtHQ._id, assignedTo: lisaEmp._id },
    { orgId: techcorp._id, serialNumber: 'TC-LT-003', model: 'ThinkPad X1 Carbon', categoryId: catMap['Laptops'], manufacturerId: tcMfg('Lenovo'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-01-15'), purchasePrice: 1899, locationId: frankfurtHQ._id },
    { orgId: techcorp._id, serialNumber: 'TC-DT-001', model: 'Mac Mini M4 Pro', categoryId: catMap['Desktops'], manufacturerId: tcMfg('Apple'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-11-01'), purchasePrice: 1999, locationId: frankfurtHQ._id },
    { orgId: techcorp._id, serialNumber: 'TC-MON-001', model: 'Samsung Odyssey G9', categoryId: catMap['Monitore'], manufacturerId: tcMfg('Samsung'), statusId: statMap['Zugewiesen'], purchaseDate: new Date('2024-06-01'), purchasePrice: 1299, locationId: frankfurtHQ._id, assignedTo: maxEmp._id },
  ]
  const techHardware: any[] = []
  for (const def of techHardwareDefs) {
    techHardware.push(await Hardware.create(def))
  }

  console.log('🖱️  Creating peripherals...')
  await Peripheral.create([
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: 'MX Master 3S', serialNumber: 'EV-MS-001', manufacturerId: evMfg('Logitech'), statusId: statMap['Zugewiesen'], assignedTo: tomEmp._id, purchaseDate: new Date('2024-01-15') },
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: 'MX Keys S', serialNumber: 'EV-KB-001', manufacturerId: evMfg('Logitech'), statusId: statMap['Zugewiesen'], assignedTo: tomEmp._id, purchaseDate: new Date('2024-01-15') },
    { orgId: evinsta._id, categoryId: catMap['Audio/Video'], model: 'AirPods Max', serialNumber: 'EV-HS-001', manufacturerId: evMfg('Apple'), statusId: statMap['Zugewiesen'], assignedTo: sarahEmp._id, purchaseDate: new Date('2024-04-01') },
    { orgId: evinsta._id, categoryId: catMap['Audio/Video'], model: 'Brio 4K', serialNumber: 'EV-WC-001', manufacturerId: evMfg('Logitech'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-06-01') },
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: 'CalDigit TS4', serialNumber: 'EV-DS-001', manufacturerId: evMfg('CalDigit'), statusId: statMap['Zugewiesen'], assignedTo: martinEmp._id, purchaseDate: new Date('2025-02-01') },
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: '140W USB-C', serialNumber: 'EV-CH-001', manufacturerId: evMfg('Apple'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-01-15') },
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: '96W USB-C', serialNumber: 'EV-CH-002', manufacturerId: evMfg('Apple'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2024-03-20') },
    { orgId: evinsta._id, categoryId: catMap['Eingabegeräte'], model: 'Magic Mouse', serialNumber: 'EV-MS-002', manufacturerId: evMfg('Apple'), statusId: statMap['Einsatzbereit'], purchaseDate: new Date('2025-01-10') },
    { orgId: techcorp._id, categoryId: catMap['Eingabegeräte'], model: 'Surface Arc Mouse', serialNumber: 'TC-MS-001', manufacturerId: tcMfg('Microsoft'), statusId: statMap['Zugewiesen'], assignedTo: maxEmp._id, purchaseDate: new Date('2024-06-01') },
    { orgId: techcorp._id, categoryId: catMap['Eingabegeräte'], model: 'Surface Keyboard', serialNumber: 'TC-KB-001', manufacturerId: tcMfg('Microsoft'), statusId: statMap['Zugewiesen'], assignedTo: lisaEmp._id, purchaseDate: new Date('2024-06-01') },
  ])

  console.log('📋 Creating assignments...')
  await Assignment.create([
    {
      orgId: evinsta._id, employeeId: tomEmp._id,
      hardware: [evinstaHardware[0]._id, evinstaHardware[6]._id],
      assignmentDate: new Date('2024-01-15'), status: 'active',
      acknowledgedAt: new Date('2024-01-16'),
      notes: 'Primary dev setup — MacBook Pro + Studio Display'
    },
    {
      orgId: evinsta._id, employeeId: juliaEmp._id,
      hardware: [evinstaHardware[2]._id, evinstaHardware[11]._id],
      assignmentDate: new Date('2025-01-10'), status: 'active',
      notes: 'Design workstation — MacBook Air + iPad Pro'
    },
    {
      orgId: evinsta._id, employeeId: martinEmp._id,
      hardware: [evinstaHardware[5]._id],
      assignmentDate: new Date('2025-02-01'), status: 'active'
    },
    {
      orgId: evinsta._id, employeeId: sarahEmp._id,
      hardware: [evinstaHardware[1]._id, evinstaHardware[7]._id],
      assignmentDate: new Date('2024-03-20'), status: 'active',
      acknowledgedAt: new Date('2024-03-21'),
      notes: 'IT Manager setup — MacBook Pro 14" + LG UltraFine 5K'
    },
    {
      orgId: evinsta._id, employeeId: adminEmp._id,
      hardware: [evinstaHardware[10]._id],
      assignmentDate: new Date('2024-09-20'), status: 'active',
      acknowledgedAt: new Date('2024-09-20'),
      notes: 'Company iPhone 15 Pro'
    },
    {
      orgId: techcorp._id, employeeId: maxEmp._id,
      hardware: [techHardware[0]._id, techHardware[4]._id],
      assignmentDate: new Date('2024-06-01'), status: 'active',
      acknowledgedAt: new Date('2024-06-01')
    },
    {
      orgId: techcorp._id, employeeId: lisaEmp._id,
      hardware: [techHardware[1]._id],
      assignmentDate: new Date('2024-06-01'), status: 'active',
      acknowledgedAt: new Date('2024-06-02'),
      notes: 'Surface Laptop 5 — Operations Lead'
    }
  ])

  console.log('🔧 Creating maintenance records...')
  await MaintenanceRecord.create([
    {
      orgId: evinsta._id, hardware: evinstaHardware[16]._id,
      type: 'repair', description: 'Screen flickering — sent to Apple Service Provider',
      performedBy: 'Apple Authorized Service', cost: 0,
      startDate: new Date('2026-01-15'), status: 'inProgress',
      notes: 'Under warranty, AppleCare+ claim #AC-2026-1234'
    },
    {
      orgId: evinsta._id, hardware: evinstaHardware[0]._id,
      type: 'preventive', description: 'Annual battery health check and thermal paste replacement',
      performedBy: 'Sarah Müller', cost: 45,
      startDate: new Date('2025-12-01'), completionDate: new Date('2025-12-02'), status: 'completed'
    },
    {
      orgId: evinsta._id, hardware: evinstaHardware[15]._id,
      type: 'inspection', description: 'Printer toner replacement and alignment',
      performedBy: 'HP Service', cost: 89,
      startDate: new Date('2025-11-15'), completionDate: new Date('2025-11-15'), status: 'completed'
    }
  ])

  console.log('📜 Creating asset events...')
  await AssetEvent.create([
    { orgId: evinsta._id, assetId: evinstaHardware[0]._id, assetType: 'hardware', eventType: 'created', description: 'Asset registered in system', performedBy: adminEvinsta._id },
    { orgId: evinsta._id, assetId: evinstaHardware[0]._id, assetType: 'hardware', eventType: 'assigned', description: 'Assigned to Tom Becker', newValue: 'Tom Becker', performedBy: adminEvinsta._id },
    { orgId: evinsta._id, assetId: evinstaHardware[0]._id, assetType: 'hardware', eventType: 'maintenance', description: 'Annual battery health check', performedBy: managerEvinsta._id },
    { orgId: evinsta._id, assetId: evinstaHardware[16]._id, assetType: 'hardware', eventType: 'statusChange', description: 'Marked as defective — screen flickering', previousValue: 'available', newValue: 'defective', performedBy: managerEvinsta._id },
  ])

  console.log('🏢 Creating departments...')
  await Department.create([
    { orgId: evinsta._id, name: 'Geschäftsführung', managerId: adminEmp._id, locationId: berlinHQ._id, description: 'C-Level und strategische Leitung' },
    { orgId: evinsta._id, name: 'IT & Infrastruktur', managerId: sarahEmp._id, locationId: berlinHQ._id, description: 'IT-Betrieb, Systemadministration, DevOps' },
    { orgId: evinsta._id, name: 'Engineering', managerId: sarahEmp._id, locationId: berlinHQ._id, description: 'Softwareentwicklung und Qualitätssicherung' },
    { orgId: evinsta._id, name: 'Design', managerId: sarahEmp._id, locationId: berlinHQ._id, description: 'UI/UX Design und Branding' },
    { orgId: evinsta._id, name: 'Vertrieb', locationId: munichOffice._id, description: 'Kundenakquise und Account Management' },
    { orgId: evinsta._id, name: 'Personal / HR', locationId: berlinHQ._id, description: 'Personalwesen, Recruiting, Onboarding' },
    { orgId: techcorp._id, name: 'Technik', managerId: maxEmp._id, locationId: frankfurtHQ._id, description: 'Technische Leitung und Architektur' },
    { orgId: techcorp._id, name: 'Betrieb', managerId: lisaEmp._id, locationId: frankfurtHQ._id, description: 'Operations und Facility Management' },
  ])

  console.log('🏭 Creating suppliers...')
  await Supplier.create([
    { orgId: evinsta._id, name: 'Apple Deutschland GmbH', contactName: 'Business Team', email: 'business@apple.de', url: 'https://www.apple.com/de/shop/go/product/business', notes: 'Apple Business Manager Account aktiv, Kurfürstendamm 26, 10719 Berlin, Tel: +49 800 2775533' },
    { orgId: evinsta._id, name: 'Cyberport GmbH', contactName: 'Key Account Team', email: 'b2b@cyberport.de', url: 'https://www.cyberport.de', notes: 'Firmenkonto mit Sonderkonditionen, Am Brauhaus 5, 01099 Dresden, Tel: +49 351 33955 00' },
    { orgId: evinsta._id, name: 'Dell Technologies', contactName: 'Enterprise Sales', email: 'enterprise@dell.com', url: 'https://www.dell.com/de-de', notes: 'Server und Enterprise-Hardware, Main Airport Center, 60549 Frankfurt, Tel: +49 69 9792-0' },
    { orgId: evinsta._id, name: 'Logitech Europe', contactName: 'B2B Partner', email: 'b2b-dach@logitech.com', url: 'https://www.logitech.com/de-de', notes: 'Peripheriegeräte-Lieferant, Lausanne, Schweiz, Tel: +41 21 863 51 11' },
    { orgId: evinsta._id, name: 'Bechtle AG', contactName: 'Regional Sales', email: 'vertrieb@bechtle.com', url: 'https://www.bechtle.com', notes: 'Full-Service IT-Beschaffung, Bechtle Platz 1, 74172 Neckarsulm, Tel: +49 7132 981-0' },
    { orgId: techcorp._id, name: 'Microsoft Deutschland', contactName: 'Cloud & Enterprise', email: 'enterprise@microsoft.de', url: 'https://www.microsoft.com/de-de', notes: 'Walter-Gropius-Str. 5, 80807 München, Tel: +49 89 3176-0' },
  ])

  console.log('🔩 Creating components...')
  await Component.create([
    { orgId: evinsta._id, name: 'Samsung 980 Pro 1TB', categoryId: catMap['Eingabegeräte'], serialNumber: 'EV-SSD-001', manufacturerId: evMfg('Samsung'), model: '980 Pro NVMe', purchasePrice: 119, status: 'installed', hardwareId: evinstaHardware[5]._id },
    { orgId: evinsta._id, name: 'Samsung 980 Pro 2TB', serialNumber: 'EV-SSD-002', manufacturerId: evMfg('Samsung'), model: '980 Pro NVMe', purchasePrice: 189, status: 'available' },
    { orgId: evinsta._id, name: 'Corsair Vengeance 32GB', serialNumber: 'EV-RAM-001', model: 'DDR5-5600 32GB Kit', purchasePrice: 129, status: 'installed', hardwareId: evinstaHardware[12]._id },
    { orgId: evinsta._id, name: 'Corsair Vengeance 64GB', serialNumber: 'EV-RAM-002', model: 'DDR5-5600 64GB Kit', purchasePrice: 239, status: 'available' },
    { orgId: evinsta._id, name: 'Intel AX210 Wi-Fi 6E', serialNumber: 'EV-WIFI-001', model: 'AX210NGW', purchasePrice: 29, status: 'available' },
    { orgId: evinsta._id, name: 'Noctua NH-L12S', serialNumber: 'EV-FAN-001', model: 'NH-L12S', purchasePrice: 55, status: 'installed', hardwareId: evinstaHardware[12]._id },
    { orgId: evinsta._id, name: 'Apple Battery MBP 16"', serialNumber: 'EV-BAT-001', manufacturerId: evMfg('Apple'), model: 'A2527 Battery', purchasePrice: 199, status: 'available' },
    { orgId: techcorp._id, name: 'WD Black SN850X 1TB', serialNumber: 'TC-SSD-001', model: 'SN850X NVMe', purchasePrice: 99, status: 'available' },
  ])

  console.log('📦 Creating consumables...')
  await Consumable.create([
    { orgId: evinsta._id, name: 'USB-C auf USB-C Kabel 2m', categoryId: catMap['Kabel & Adapter'], modelNumber: 'A8856', totalQuantity: 15, minimumQuantity: 5, unitCost: 12.99, locationId: berlinHQ._id, notes: '100W PD-fähig' },
    { orgId: evinsta._id, name: 'USB-C auf HDMI Adapter', categoryId: catMap['Kabel & Adapter'], manufacturerId: evMfg('Apple'), modelNumber: 'MJ1K2', totalQuantity: 8, minimumQuantity: 3, unitCost: 79, locationId: berlinHQ._id },
    { orgId: evinsta._id, name: 'USB-C Multiport Adapter', categoryId: catMap['Kabel & Adapter'], modelNumber: 'A8352', totalQuantity: 5, minimumQuantity: 2, unitCost: 39.99, locationId: berlinHQ._id, notes: 'HDMI + USB-A + USB-C PD' },
    { orgId: evinsta._id, name: 'HP 207A Toner Schwarz', categoryId: catMap['Büromaterial'], manufacturerId: evMfg('HP'), modelNumber: 'W2210A', totalQuantity: 4, minimumQuantity: 2, unitCost: 69, locationId: berlinHQ._id },
    { orgId: evinsta._id, name: 'HP 207A Toner Farbset', categoryId: catMap['Büromaterial'], manufacturerId: evMfg('HP'), modelNumber: 'W2211-13A', totalQuantity: 2, minimumQuantity: 1, unitCost: 189, locationId: berlinHQ._id, notes: 'Cyan, Magenta, Gelb im Set' },
    { orgId: evinsta._id, name: 'Displayschutzfolie MBP 16"', categoryId: catMap['Büromaterial'], modelNumber: 'OVA018', totalQuantity: 10, minimumQuantity: 3, unitCost: 39.99 },
    { orgId: evinsta._id, name: 'Reinigungstücher (100 Stk)', categoryId: catMap['Büromaterial'], modelNumber: 'EC-CLEAN-100', totalQuantity: 20, minimumQuantity: 5, unitCost: 9.99, locationId: berlinHQ._id },
    { orgId: evinsta._id, name: 'Kensington Schloss', categoryId: catMap['Büromaterial'], modelNumber: 'K64590', totalQuantity: 6, minimumQuantity: 2, unitCost: 34.99, locationId: munichOffice._id, notes: 'Notebook-Sicherheitsschloss' },
    { orgId: evinsta._id, name: 'Ethernet Kabel Cat6 5m', categoryId: catMap['Kabel & Adapter'], modelNumber: 'MK-3406', totalQuantity: 25, minimumQuantity: 10, unitCost: 6.99, locationId: berlinHQ._id },
    { orgId: techcorp._id, name: 'USB-C Kabel 1m', categoryId: catMap['Kabel & Adapter'], modelNumber: 'A8851', totalQuantity: 10, minimumQuantity: 3, unitCost: 9.99, locationId: frankfurtHQ._id },
  ])

  console.log('📜 Creating software licenses...')
  await SoftwareLicense.create([
    { orgId: evinsta._id, name: 'Microsoft 365 Business Premium', publisher: 'Microsoft', licenseKey: 'M365-EV-XXXXX-XXXXX', totalSeats: 10, expirationDate: new Date('2027-03-01'), purchaseDate: new Date('2025-03-01'), costPerSeat: 26.40, renewalDate: new Date('2027-03-01'), categoryId: catMap['Produktivität'], notes: 'Jahresabo, 10 Plätze', isActive: true },
    { orgId: evinsta._id, name: 'JetBrains All Products Pack', publisher: 'JetBrains', licenseKey: 'JB-EV-XXXXX-XXXXX', totalSeats: 5, expirationDate: new Date('2027-01-15'), purchaseDate: new Date('2025-01-15'), costPerSeat: 129.80, categoryId: catMap['Entwicklung'], notes: 'IntelliJ, WebStorm, DataGrip', isActive: true },
    { orgId: evinsta._id, name: 'Figma Organization', publisher: 'Figma', licenseKey: 'FIG-EV-XXXXX', totalSeats: 5, expirationDate: new Date('2027-06-01'), purchaseDate: new Date('2025-06-01'), costPerSeat: 108, categoryId: catMap['Entwicklung'], notes: 'Design & Dev Mode', isActive: true },
    { orgId: evinsta._id, name: 'Slack Business+', publisher: 'Slack', licenseKey: 'SLK-EV-XXXXX', totalSeats: 15, expirationDate: new Date('2027-04-01'), purchaseDate: new Date('2025-04-01'), costPerSeat: 100.80, categoryId: catMap['Produktivität'], isActive: true },
    { orgId: evinsta._id, name: '1Password Business', publisher: '1Password', licenseKey: '1PW-EV-XXXXX', totalSeats: 15, expirationDate: new Date('2027-02-01'), purchaseDate: new Date('2025-02-01'), costPerSeat: 63.80, categoryId: catMap['Sicherheit'], notes: 'Password Manager + Vault', isActive: true },
    { orgId: evinsta._id, name: 'GitHub Enterprise', publisher: 'GitHub', licenseKey: 'GH-EV-XXXXX', totalSeats: 10, expirationDate: new Date('2027-01-01'), purchaseDate: new Date('2025-01-01'), costPerSeat: 252, categoryId: catMap['Entwicklung'], isActive: true },
    { orgId: evinsta._id, name: 'Adobe Creative Cloud', publisher: 'Adobe', licenseKey: 'ADO-EV-XXXXX', totalSeats: 3, expirationDate: new Date('2026-12-01'), purchaseDate: new Date('2025-12-01'), costPerSeat: 718, categoryId: catMap['Entwicklung'], notes: 'Photoshop, Illustrator, After Effects', isActive: true },
    { orgId: evinsta._id, name: 'Kandji MDM', publisher: 'Kandji', licenseKey: 'KDJ-EV-XXXXX', totalSeats: 25, expirationDate: new Date('2027-03-01'), purchaseDate: new Date('2025-03-01'), costPerSeat: 120, categoryId: catMap['Sicherheit'], notes: 'Apple MDM — alle Mac/iPhone/iPad', isActive: true },
    { orgId: techcorp._id, name: 'Microsoft 365 E3', publisher: 'Microsoft', licenseKey: 'M365-TC-XXXXX', totalSeats: 5, expirationDate: new Date('2027-06-01'), purchaseDate: new Date('2025-06-01'), costPerSeat: 86.40, categoryId: catMap['Produktivität'], isActive: true },
    { orgId: techcorp._id, name: 'Jira Software Cloud', publisher: 'Atlassian', licenseKey: 'JIRA-TC-XXXXX', totalSeats: 10, expirationDate: new Date('2027-04-01'), purchaseDate: new Date('2025-04-01'), costPerSeat: 79, categoryId: catMap['Entwicklung'], isActive: true },
  ])

  console.log('🔧 Creating custom fields...')
  await CustomField.create([
    { orgId: evinsta._id, name: 'Asset Tag', key: 'asset_tag', entityType: 'hardware', fieldType: 'text', required: true, helpText: 'Eindeutige interne Kennung (z.B. EV-2024-001)', order: 1, isActive: true },
    { orgId: evinsta._id, name: 'Versicherungswert', key: 'insurance_value', entityType: 'hardware', fieldType: 'number', required: false, helpText: 'Versicherungssumme in EUR', order: 2, isActive: true },
    { orgId: evinsta._id, name: 'Leasing-Ende', key: 'lease_end', entityType: 'hardware', fieldType: 'date', required: false, helpText: 'Ende des Leasingvertrags', order: 3, isActive: true },
    { orgId: evinsta._id, name: 'Kostenstelle', key: 'cost_center', entityType: 'hardware', fieldType: 'select', options: ['CC-100 Engineering', 'CC-200 Design', 'CC-300 Management', 'CC-400 Vertrieb', 'CC-500 IT'], required: false, helpText: 'Zugeordnete Kostenstelle', order: 4, isActive: true },
    { orgId: evinsta._id, name: 'VPN Profil', key: 'vpn_profile', entityType: 'hardware', fieldType: 'boolean', required: false, helpText: 'Hat das Gerät ein VPN-Profil installiert?', order: 5, isActive: true },
    { orgId: evinsta._id, name: 'Personalnummer', key: 'personnel_number', entityType: 'employee', fieldType: 'text', required: false, helpText: 'Interne Personalnummer aus HR-System', order: 1, isActive: true },
    { orgId: evinsta._id, name: 'Standort-Kennung', key: 'location_code', entityType: 'hardware', fieldType: 'text', required: false, helpText: 'Gebäude/Raum (z.B. B1-R204)', order: 6, isActive: true },
    { orgId: techcorp._id, name: 'Kostenstelle', key: 'cost_center', entityType: 'hardware', fieldType: 'text', required: true, helpText: 'SAP Kostenstelle', order: 1, isActive: true },
  ])

  console.log('🎒 Creating kits...')
  await Kit.create([
    { orgId: evinsta._id, name: 'Developer Onboarding Kit', locationId: berlinHQ._id, items: [
      { itemType: 'hardware', category: 'laptop', quantity: 1 },
      { itemType: 'hardware', category: 'monitor', quantity: 1 },
      { itemType: 'peripheral', category: 'mouse', quantity: 1 },
      { itemType: 'peripheral', category: 'keyboard', quantity: 1 },
      { itemType: 'peripheral', category: 'headset', quantity: 1 },
    ], notes: 'Standard-Setup für neue Entwickler: MacBook Pro + Display + Peripherie' },
    { orgId: evinsta._id, name: 'Designer Onboarding Kit', locationId: berlinHQ._id, items: [
      { itemType: 'hardware', category: 'laptop', quantity: 1 },
      { itemType: 'hardware', category: 'tablet', quantity: 1 },
      { itemType: 'peripheral', category: 'mouse', quantity: 1 },
    ], notes: 'MacBook Air + iPad Pro für Designer' },
    { orgId: evinsta._id, name: 'Meeting-Raum Setup', locationId: berlinHQ._id, items: [
      { itemType: 'hardware', category: 'monitor', quantity: 1 },
      { itemType: 'peripheral', category: 'webcam', quantity: 1 },
    ], notes: 'Display + Kamera für Konferenzräume' },
    { orgId: techcorp._id, name: 'Standard Arbeitsplatz', locationId: frankfurtHQ._id, items: [
      { itemType: 'hardware', category: 'laptop', quantity: 1 },
      { itemType: 'peripheral', category: 'mouse', quantity: 1 },
      { itemType: 'peripheral', category: 'keyboard', quantity: 1 },
    ], notes: 'Surface Laptop + Microsoft Peripherie' },
  ])

  console.log('📉 Creating depreciation records...')
  await Depreciation.create([
    { orgId: evinsta._id, hardwareId: evinstaHardware[0]._id, method: 'straightLine', purchasePrice: 2899, salvageValue: 500, usefulLifeMonths: 36, purchaseDate: new Date('2024-01-15'), depreciationRate: 33.33 },
    { orgId: evinsta._id, hardwareId: evinstaHardware[1]._id, method: 'straightLine', purchasePrice: 2499, salvageValue: 400, usefulLifeMonths: 36, purchaseDate: new Date('2024-03-20'), depreciationRate: 33.33 },
    { orgId: evinsta._id, hardwareId: evinstaHardware[5]._id, method: 'straightLine', purchasePrice: 4299, salvageValue: 800, usefulLifeMonths: 48, purchaseDate: new Date('2024-06-01'), depreciationRate: 25 },
    { orgId: evinsta._id, hardwareId: evinstaHardware[12]._id, method: 'decliningBalance', purchasePrice: 8500, salvageValue: 1000, usefulLifeMonths: 60, purchaseDate: new Date('2023-11-01'), depreciationRate: 20 },
    { orgId: techcorp._id, hardwareId: techHardware[0]._id, method: 'straightLine', purchasePrice: 1599, salvageValue: 300, usefulLifeMonths: 36, purchaseDate: new Date('2024-06-01'), depreciationRate: 33.33 },
    { orgId: techcorp._id, hardwareId: techHardware[4]._id, method: 'straightLine', purchasePrice: 1299, salvageValue: 200, usefulLifeMonths: 36, purchaseDate: new Date('2024-06-01'), depreciationRate: 33.33 },
  ])

  console.log('📝 Creating audit log entries...')
  await AuditLog.create([
    {
      orgId: evinsta._id, action: 'create', entityType: 'Hardware', entityId: evinstaHardware[0]._id.toString(),
      userId: adminEvinsta._id, userEmail: 'admin@evinsta.com',
      changes: { after: { serialNumber: 'EV-MBP-001', model: 'MacBook Pro 16"', status: 'available', purchasePrice: 2899 } },
      timestamp: new Date('2024-01-15T09:00:00Z')
    },
    {
      orgId: evinsta._id, action: 'update', entityType: 'Hardware', entityId: evinstaHardware[0]._id.toString(),
      userId: managerEvinsta._id, userEmail: 'sarah@evinsta.com',
      changes: { before: { status: 'available', assignedTo: null }, after: { status: 'assigned', assignedTo: 'Tom Becker' } },
      metadata: { reason: 'Onboarding — neuer Entwickler' },
      timestamp: new Date('2024-01-15T14:30:00Z')
    },
    {
      orgId: evinsta._id, action: 'update', entityType: 'Hardware', entityId: evinstaHardware[0]._id.toString(),
      userId: managerEvinsta._id, userEmail: 'sarah@evinsta.com',
      changes: { before: { tags: ['engineering'] }, after: { tags: ['engineering', 'primary'] } },
      timestamp: new Date('2025-12-02T10:15:00Z')
    },
    {
      orgId: evinsta._id, action: 'update', entityType: 'Employee', entityId: tomEmp._id.toString(),
      userId: adminEvinsta._id, userEmail: 'admin@evinsta.com',
      changes: { before: { jobTitle: 'Junior Engineer' }, after: { jobTitle: 'Software Engineer' } },
      metadata: { reason: 'Beförderung nach Probezeit' },
      timestamp: new Date('2025-06-01T08:00:00Z')
    },
    {
      orgId: evinsta._id, action: 'update', entityType: 'Employee', entityId: sarahEmp._id.toString(),
      userId: adminEvinsta._id, userEmail: 'admin@evinsta.com',
      changes: { before: { department: 'Engineering' }, after: { department: 'IT' } },
      timestamp: new Date('2025-03-01T09:00:00Z')
    },
    {
      orgId: evinsta._id, action: 'status_change', entityType: 'Hardware', entityId: evinstaHardware[16]._id.toString(),
      userId: managerEvinsta._id, userEmail: 'sarah@evinsta.com',
      changes: { before: { status: 'available' }, after: { status: 'defective' } },
      metadata: { reason: 'Screen flickering — RMA eingeleitet' },
      timestamp: new Date('2026-01-10T11:30:00Z')
    },
    {
      orgId: evinsta._id, action: 'create', entityType: 'SoftwareLicense', entityId: 'seed-license-m365',
      userId: adminEvinsta._id, userEmail: 'admin@evinsta.com',
      changes: { after: { name: 'Microsoft 365 Business Premium', publisher: 'Microsoft', totalSeats: 10 } },
      timestamp: new Date('2025-03-01T10:00:00Z')
    },
    {
      orgId: evinsta._id, action: 'update', entityType: 'Hardware', entityId: evinstaHardware[17]._id.toString(),
      userId: adminEvinsta._id, userEmail: 'admin@evinsta.com',
      changes: { before: { status: 'available', salePrice: null }, after: { status: 'forSale', salePrice: 649 } },
      metadata: { reason: 'Gebrauchtverkauf nach Austausch' },
      timestamp: new Date('2025-09-15T14:00:00Z')
    },
  ])

  const counts = {
    organizations: await Organization.countDocuments(),
    users: await User.countDocuments(),
    employees: await Employee.countDocuments(),
    locations: await Location.countDocuments(),
    hardware: await Hardware.countDocuments(),
    peripherals: await Peripheral.countDocuments(),
    assignments: await Assignment.countDocuments(),
    maintenance: await MaintenanceRecord.countDocuments(),
    events: await AssetEvent.countDocuments(),
    categories: await Category.countDocuments(),
    departments: await Department.countDocuments(),
    manufacturers: await Manufacturer.countDocuments(),
    statuses: await Status.countDocuments(),
    suppliers: await Supplier.countDocuments(),
    components: await Component.countDocuments(),
    consumables: await Consumable.countDocuments(),
    licenses: await SoftwareLicense.countDocuments(),
    customFields: await CustomField.countDocuments(),
    kits: await Kit.countDocuments(),
    depreciations: await Depreciation.countDocuments(),
    auditLogs: await AuditLog.countDocuments(),
  }

  console.log('\n✅ Seed complete!')
  console.log(JSON.stringify(counts, null, 2))
  console.log('\n🔑 Login credentials (password: "password123" for all):')
  console.log('  Evinsta:  admin@evinsta.com (admin), sarah@evinsta.com (manager), tom@evinsta.com (employee)')
  console.log('  TechCorp: admin@techcorp.de (admin), lisa@techcorp.de (manager)')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
