
export interface NamedRef {
  _id: string
  name: string
  slug?: string
  type?: string
  color?: string
  icon?: string
}


export interface Hardware {
  _id: string
  assetTag?: string
  assetName?: string
  serialNumber?: string
  model: string
  categoryId: string | NamedRef
  statusId: string | NamedRef
  manufacturerId: string | NamedRef
  supplierId?: string | NamedRef | null
  departmentId?: string | NamedRef | null
  locationId?: string | NamedRef | null
  assignedTo?: string | { _id: string; firstName: string; lastName: string; email: string } | null
  purchaseDate?: Date
  purchasePrice?: number
  currency?: string
  orderNumber?: string
  warrantyExpiry?: Date
  endOfLife?: Date
  imageUrl?: string
  adminPassword?: string
  defectDescription?: string
  salePrice?: number
  notes?: string
  tags: string[]
  customFields: Record<string, string>
  createdAt?: Date
  updatedAt?: Date
}


export interface Peripheral {
  _id: string
  categoryId: string | NamedRef
  statusId?: string | NamedRef | null
  model: string
  serialNumber?: string
  manufacturerId?: string | NamedRef | null
  supplierId?: string | NamedRef | null
  locationId?: string | NamedRef | null
  departmentId?: string | NamedRef | null
  quantity?: number
  minimumQuantity?: number
  purchaseDate?: Date
  purchasePrice?: number
  currency?: string
  orderNumber?: string
  warrantyExpiry?: Date
  assignedTo?: string | null
  notes?: string
}


export interface Assignment {
  _id: string
  employeeId: string
  employeeName: string
  hardware: Hardware[]
  peripherals: Peripheral[]
  assignmentDate: Date
  expectedReturnDate?: Date
  checkoutLocationId?: string | NamedRef | null
  checkoutCondition?: number
  status: 'active' | 'pendingReturn' | 'returned'
}


export interface MaintenanceRecord {
  _id: string
  hardware: string
  type: 'repair' | 'preventive' | 'upgrade' | 'inspection' | 'cleaning'
  description: string
  performedBy: string
  cost?: number
  startDate: Date
  completionDate?: Date
  status: 'scheduled' | 'inProgress' | 'completed' | 'cancelled'
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}
