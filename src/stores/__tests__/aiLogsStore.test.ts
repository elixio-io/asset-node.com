import { describe, it, expect, vi, beforeEach } from 'vitest'


interface AILog {
  id: string
  timestamp: Date
  prompt: string
  rawResponse: string
  parsedResponse: { price: number; source: string; url: string }[]
  hardware: { manufacturer: string; model: string; category?: string }
}

function createLogStore() {
  const logs: AILog[] = []

  function addLog(
    prompt: string,
    rawResponse: string,
    parsedResponse: { price: number; source: string; url: string }[],
    hardware: { manufacturer: string; model: string; category?: string }
  ) {
    logs.unshift({
      id: `mock-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      prompt,
      rawResponse,
      parsedResponse,
      hardware,
    })
  }

  return { logs, addLog }
}


describe('AI Logs Store — Log Management', () => {
  let store: ReturnType<typeof createLogStore>

  beforeEach(() => {
    store = createLogStore()
  })

  describe('addLog()', () => {
    it('should start with empty logs', () => {
      expect(store.logs).toHaveLength(0)
    })

    it('should add a log entry', () => {
      store.addLog(
        'Find prices for MacBook Pro',
        '{"results": []}',
        [{ price: 2499, source: 'Amazon', url: 'https://amazon.de' }],
        { manufacturer: 'Apple', model: 'MacBook Pro 16"' }
      )
      expect(store.logs).toHaveLength(1)
    })

    it('should prepend new entries (most recent first)', () => {
      store.addLog('First', '{}', [], { manufacturer: 'A', model: 'M1' })
      store.addLog('Second', '{}', [], { manufacturer: 'B', model: 'M2' })

      expect(store.logs[0].prompt).toBe('Second')
      expect(store.logs[1].prompt).toBe('First')
    })
  })

  describe('Log Entry Structure', () => {
    it('should have all required fields', () => {
      store.addLog(
        'Test prompt',
        'raw response text',
        [{ price: 999, source: 'Cyberport', url: 'https://cyberport.de/test' }],
        { manufacturer: 'Lenovo', model: 'ThinkPad X1', category: 'Laptop' }
      )

      const log = store.logs[0]
      expect(log.id).toBeDefined()
      expect(log.timestamp).toBeInstanceOf(Date)
      expect(log.prompt).toBe('Test prompt')
      expect(log.rawResponse).toBe('raw response text')
      expect(log.parsedResponse).toHaveLength(1)
      expect(log.hardware.manufacturer).toBe('Lenovo')
      expect(log.hardware.model).toBe('ThinkPad X1')
      expect(log.hardware.category).toBe('Laptop')
    })

    it('category should be optional', () => {
      store.addLog('p', 'r', [], { manufacturer: 'Dell', model: 'Latitude' })
      expect(store.logs[0].hardware.category).toBeUndefined()
    })
  })

  describe('Parsed Response Shape', () => {
    it('should store multiple price sources', () => {
      store.addLog('prices', '{}', [
        { price: 2499, source: 'Amazon', url: 'https://amazon.de/1' },
        { price: 2399, source: 'Cyberport', url: 'https://cyberport.de/2' },
        { price: 2599, source: 'MediaMarkt', url: 'https://mediamarkt.de/3' },
      ], { manufacturer: 'Apple', model: 'MacBook Pro' })

      expect(store.logs[0].parsedResponse).toHaveLength(3)
    })

    it('should accept empty parsed response', () => {
      store.addLog('no results', '{}', [], { manufacturer: 'X', model: 'Y' })
      expect(store.logs[0].parsedResponse).toHaveLength(0)
    })

    it('price should be numeric', () => {
      store.addLog('p', 'r', [
        { price: 0, source: 'Free', url: 'http://example.com' },
        { price: 999.99, source: 'Shop', url: 'http://shop.com' },
      ], { manufacturer: 'A', model: 'B' })

      expect(store.logs[0].parsedResponse[0].price).toBe(0)
      expect(store.logs[0].parsedResponse[1].price).toBe(999.99)
    })
  })

  describe('Ordering & IDs', () => {
    it('each log should have a unique ID', () => {
      store.addLog('a', 'r', [], { manufacturer: 'A', model: 'A' })
      store.addLog('b', 'r', [], { manufacturer: 'B', model: 'B' })
      store.addLog('c', 'r', [], { manufacturer: 'C', model: 'C' })

      const ids = store.logs.map(l => l.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(3)
    })

    it('newest entry should be at index 0', () => {
      store.addLog('oldest', 'r', [], { manufacturer: 'A', model: 'A' })
      store.addLog('middle', 'r', [], { manufacturer: 'B', model: 'B' })
      store.addLog('newest', 'r', [], { manufacturer: 'C', model: 'C' })

      expect(store.logs[0].prompt).toBe('newest')
      expect(store.logs[2].prompt).toBe('oldest')
    })
  })
})
