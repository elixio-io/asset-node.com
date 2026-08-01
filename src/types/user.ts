export type UserRole = 'superAdmin' | 'admin' | 'manager' | 'employee' | 'viewer'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  companyName: string
  department?: string
  role: UserRole
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}
