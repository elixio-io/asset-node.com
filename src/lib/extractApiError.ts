import { ApiError } from './api'

const VALIDATION_PATTERNS: [RegExp, string][] = [
  [/body\/(\w+) must NOT have fewer than (\d+) characters?/i, '{field} is required'],
  [/body\/(\w+) must match pattern/i, '{field} has an invalid format'],
  [/body\/(\w+) must be >= (\d+)/i, '{field} must be at least {min}'],
  [/body\/(\w+) must be <= (\d+)/i, '{field} must be at most {max}'],
  [/body\/(\w+) must be (string|number|integer|boolean)/i, '{field} has an invalid type'],
  [/body must have required property '(\w+)'/i, '{field} is required'],
  [/body\/(\w+) must NOT have more than (\d+) characters?/i, '{field} is too long'],
  [/body\/(\w+) must match format "(\w+)"/i, '{field} must be a valid {format}'],
]

function humanizeField(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase())
}

function humanizeValidationMessage(raw: string): string {
  for (const [pattern, template] of VALIDATION_PATTERNS) {
    const match = raw.match(pattern)
    if (match) {
      const field = humanizeField(match[1])
      return template
        .replace('{field}', field)
        .replace('{min}', match[2] || '')
        .replace('{max}', match[2] || '')
        .replace('{format}', match[2] || '')
    }
  }
  return raw
}

export function extractApiError(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (err instanceof ApiError) {
    const raw = err.response?.data?.message || err.response?.data?.error || err.message
    return humanizeValidationMessage(raw)
  }
  if (err instanceof Error) return humanizeValidationMessage(err.message)
  if (typeof err === 'string') return humanizeValidationMessage(err)
  return fallback
}
