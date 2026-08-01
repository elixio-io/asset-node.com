import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useErrorHandler } from '../useErrorHandler'

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { clearAll } = useErrorHandler()
    clearAll()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should add an error', () => {
    const { errors, addError } = useErrorHandler()
    addError('Something broke', 'error')
    expect(errors.value.length).toBe(1)
    expect(errors.value[0].message).toBe('Something broke')
    expect(errors.value[0].severity).toBe('error')
  })

  it('should auto-remove errors after 8 seconds', () => {
    const { errors, addError } = useErrorHandler()
    addError('Temporary error')
    expect(errors.value.length).toBe(1)

    vi.advanceTimersByTime(8001)
    expect(errors.value.length).toBe(0)
  })

  it('should manually remove an error', () => {
    const { errors, addError, removeError } = useErrorHandler()
    addError('Error 1')
    addError('Error 2')
    expect(errors.value.length).toBe(2)

    const idToRemove = errors.value[0].id
    removeError(idToRemove)
    expect(errors.value.length).toBe(1)
    expect(errors.value[0].message).toBe('Error 2')
  })

  it('should clear all errors', () => {
    const { errors, addError, clearAll } = useErrorHandler()
    addError('Error 1')
    addError('Error 2')
    addError('Error 3')
    expect(errors.value.length).toBe(3)

    clearAll()
    expect(errors.value.length).toBe(0)
  })
})
