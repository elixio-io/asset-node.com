import { describe, it, expect } from 'vitest'
import { extractApiError } from '../../lib/extractApiError'
import { ApiError } from '../../lib/api'

describe('extractApiError', () => {
  it('should extract message from a native Error', () => {
    const err = new Error('Something went wrong')
    expect(extractApiError(err)).toBe('Something went wrong')
  })

  it('should extract message from a string', () => {
    expect(extractApiError('Network timeout')).toBe('Network timeout')
  })

  it('should return fallback for null', () => {
    expect(extractApiError(null)).toBe('An unexpected error occurred')
  })

  it('should return fallback for undefined', () => {
    expect(extractApiError(undefined)).toBe('An unexpected error occurred')
  })

  it('should return fallback for a number', () => {
    expect(extractApiError(42)).toBe('An unexpected error occurred')
  })

  it('should return fallback for an empty object', () => {
    expect(extractApiError({})).toBe('An unexpected error occurred')
  })

  it('should use custom fallback when provided', () => {
    expect(extractApiError(null, 'Custom fallback')).toBe('Custom fallback')
  })

  it('should extract error from ApiError with response data', () => {
    const apiErr = new ApiError(
      'Request failed',
      403,
      { error: 'Plan limit reached' }
    )
    expect(extractApiError(apiErr)).toBe('Plan limit reached')
  })

  it('should fall back to ApiError message when response has no error field', () => {
    const apiErr = new ApiError('Request failed', 500, {})
    expect(extractApiError(apiErr)).toBe('Request failed')
  })


  it('should humanize "must NOT have fewer than" to "is required"', () => {
    const apiErr = new ApiError('Validation failed', 400, {
      error: "body/firstName must NOT have fewer than 1 characters"
    })
    expect(extractApiError(apiErr)).toBe('First Name is required')
  })

  it('should humanize "must have required property" to "is required"', () => {
    const apiErr = new ApiError('Validation failed', 400, {
      error: "body must have required property 'email'"
    })
    expect(extractApiError(apiErr)).toBe('Email is required')
  })

  it('should humanize "must match format" messages', () => {
    const apiErr = new ApiError('Validation failed', 400, {
      error: 'body/emailAddress must match format "email"'
    })
    expect(extractApiError(apiErr)).toBe('Email Address must be a valid email')
  })

  it('should humanize camelCase field names to title case', () => {
    const apiErr = new ApiError('Validation failed', 400, {
      error: "body/purchasePrice must be >= 0"
    })
    expect(extractApiError(apiErr)).toBe('Purchase Price must be at least 0')
  })

  it('should pass through unrecognized messages unchanged', () => {
    const apiErr = new ApiError('Validation failed', 400, {
      error: 'Something completely unexpected happened'
    })
    expect(extractApiError(apiErr)).toBe('Something completely unexpected happened')
  })
})
