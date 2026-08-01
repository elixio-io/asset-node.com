import { FastifyRequest } from 'fastify'


export function getTenantFilter(request: FastifyRequest): { orgId: string } {
  if (!request.user?.orgId) {
    throw new Error('Tenant context missing — ensure authenticate middleware runs first')
  }
  return { orgId: request.user.orgId }
}

export function getOrgId(request: FastifyRequest): string {
  if (!request.user?.orgId) {
    throw new Error('Tenant context missing — ensure authenticate middleware runs first')
  }
  return request.user.orgId
}


const FORBIDDEN_FIELDS = new Set([
  '_id',
  '__v',
  'orgId',
  'role',
  'createdAt',
  'updatedAt',
  '__proto__',
  'constructor',
  '$set',
  '$unset',
  '$push',
  '$pull',
  '$inc',
])

const DEEP_FORBIDDEN = /^\$(set|unset|push|pull|inc|addToSet|pop|rename|bit|mul|min|max|currentDate|each|slice|sort|position|pullAll|setOnInsert|where|expr|regex|ne|eq|gt|gte|lt|lte|in|nin|and|or|nor|not|exists|type|elemMatch)|^(__proto__|constructor|prototype)$/

export function sanitizeBody<T extends Record<string, unknown>>(body: T): Omit<T, '_id' | 'orgId' | 'role' | '__v'> {
  const sanitized = { ...body }
  for (const key of Object.keys(sanitized)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      delete sanitized[key]
      continue
    }
    const value = sanitized[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = deepSanitize(value as Record<string, unknown>) as any
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? deepSanitize(item as Record<string, unknown>)
          : item
      ) as any
    }
  }
  return sanitized as any
}

function deepSanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (DEEP_FORBIDDEN.test(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      clean[key] = deepSanitize(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      clean[key] = value.map(item =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? deepSanitize(item as Record<string, unknown>)
          : item
      )
    } else {
      clean[key] = value
    }
  }
  return clean
}
