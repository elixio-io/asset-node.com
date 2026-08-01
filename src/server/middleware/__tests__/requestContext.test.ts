import { describe, it, expect } from 'vitest'
import { AsyncLocalStorage } from 'node:async_hooks'


interface RequestContext {
  userId?: string
  userEmail?: string
  orgId?: string
  ipAddress?: string
  userAgent?: string
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}


describe('Request Context — AsyncLocalStorage', () => {
  describe('Context Lifecycle', () => {
    it('should return undefined outside of context', () => {
      expect(getRequestContext()).toBeUndefined()
    })

    it('should return store inside context', () => {
      requestContextStorage.run({}, () => {
        expect(getRequestContext()).toBeDefined()
      })
    })

    it('should be undefined again after context exits', () => {
      requestContextStorage.run({}, () => {
        expect(getRequestContext()).toBeDefined()
      })
      expect(getRequestContext()).toBeUndefined()
    })
  })

  describe('Context Population', () => {
    it('should store userId and orgId', () => {
      const ctx: RequestContext = { userId: 'user-1', orgId: 'org-1' }
      requestContextStorage.run(ctx, () => {
        const store = getRequestContext()!
        expect(store.userId).toBe('user-1')
        expect(store.orgId).toBe('org-1')
      })
    })

    it('should support mutation inside context', () => {
      const ctx: RequestContext = {}
      requestContextStorage.run(ctx, () => {
        const store = getRequestContext()!
        store.userId = 'populated-user'
        store.userEmail = 'user@example.com'
        store.ipAddress = '192.168.1.1'
        expect(store.userId).toBe('populated-user')
        expect(store.userEmail).toBe('user@example.com')
        expect(store.ipAddress).toBe('192.168.1.1')
      })
    })

    it('should store userAgent', () => {
      const ctx: RequestContext = { userAgent: 'Mozilla/5.0 (Macintosh)' }
      requestContextStorage.run(ctx, () => {
        expect(getRequestContext()!.userAgent).toContain('Mozilla')
      })
    })
  })

  describe('Context Isolation', () => {
    it('nested contexts should not leak', async () => {
      let innerValue: string | undefined
      let outerValue: string | undefined

      await new Promise<void>((resolve) => {
        requestContextStorage.run({ userId: 'outer' }, () => {
          requestContextStorage.run({ userId: 'inner' }, () => {
            innerValue = getRequestContext()?.userId
          })
          outerValue = getRequestContext()?.userId
          resolve()
        })
      })

      expect(innerValue).toBe('inner')
      expect(outerValue).toBe('outer')
    })

    it('concurrent runs should be isolated', async () => {
      const results: string[] = []

      await Promise.all([
        new Promise<void>((resolve) => {
          requestContextStorage.run({ userId: 'req-A' }, () => {
            setTimeout(() => {
              results.push(getRequestContext()!.userId!)
              resolve()
            }, 10)
          })
        }),
        new Promise<void>((resolve) => {
          requestContextStorage.run({ userId: 'req-B' }, () => {
            setTimeout(() => {
              results.push(getRequestContext()!.userId!)
              resolve()
            }, 5)
          })
        }),
      ])

      expect(results).toContain('req-A')
      expect(results).toContain('req-B')
    })
  })

  describe('RequestContext Interface', () => {
    it('all fields should be optional', () => {
      const empty: RequestContext = {}
      expect(empty.userId).toBeUndefined()
      expect(empty.userEmail).toBeUndefined()
      expect(empty.orgId).toBeUndefined()
      expect(empty.ipAddress).toBeUndefined()
      expect(empty.userAgent).toBeUndefined()
    })

    it('should accept full context', () => {
      const full: RequestContext = {
        userId: 'u1',
        userEmail: 'user@email.com',
        orgId: 'o1',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.88',
      }
      expect(Object.keys(full)).toHaveLength(5)
    })
  })
})
