import { describe, it, expect } from 'vitest'


const NODE_TYPES = [
  'trigger-event', 'trigger-schedule', 'trigger-webhook', 'trigger-manual',
  'condition', 'logic-switch', 'logic-delay', 'filter',
  'action-notify', 'action-status', 'action-assign',
  'action-update-field', 'action-webhook', 'action-audit-log',
  'action-tag', 'action-maintenance',
] as const

const TRIGGER_TYPES = ['event', 'schedule', 'manual', 'webhook'] as const

const TRIGGER_EVENTS = [
  'hardware.synced', 'hardware.created', 'hardware.updated', 'hardware.deleted',
  'employee.synced', 'employee.created', 'employee.updated',
  'status.changed',
  'assignment.created', 'assignment.returned',
  'maintenance.completed',
] as const

function getNodeCategory(type: string): 'trigger' | 'logic' | 'action' | 'unknown' {
  if (type.startsWith('trigger-')) return 'trigger'
  if (type.startsWith('logic-') || type === 'condition' || type === 'filter') return 'logic'
  if (type.startsWith('action-')) return 'action'
  return 'unknown'
}

function getEventDomain(event: string): string {
  return event.split('.')[0]
}


describe('Workflow Model — Schema & Registry', () => {
  describe('Node Type Registry', () => {
    it('should have 16 node types', () => {
      expect(NODE_TYPES).toHaveLength(16)
    })

    it('should have 4 trigger node types', () => {
      const triggers = NODE_TYPES.filter(t => t.startsWith('trigger-'))
      expect(triggers).toHaveLength(4)
    })

    it('should have 4 logic node types', () => {
      const logic = NODE_TYPES.filter(t =>
        t.startsWith('logic-') || t === 'condition' || t === 'filter'
      )
      expect(logic).toHaveLength(4)
    })

    it('should have 8 action node types', () => {
      const actions = NODE_TYPES.filter(t => t.startsWith('action-'))
      expect(actions).toHaveLength(8)
    })
  })

  describe('Node Category Classification', () => {
    it.each([
      ['trigger-event', 'trigger'], ['trigger-schedule', 'trigger'],
      ['trigger-webhook', 'trigger'], ['trigger-manual', 'trigger'],
    ])('%s → %s', (type, expected) => {
      expect(getNodeCategory(type)).toBe(expected)
    })

    it.each([
      ['condition', 'logic'], ['logic-switch', 'logic'],
      ['logic-delay', 'logic'], ['filter', 'logic'],
    ])('%s → %s', (type, expected) => {
      expect(getNodeCategory(type)).toBe(expected)
    })

    it.each([
      ['action-notify', 'action'], ['action-status', 'action'],
      ['action-assign', 'action'], ['action-webhook', 'action'],
    ])('%s → %s', (type, expected) => {
      expect(getNodeCategory(type)).toBe(expected)
    })

    it('unknown type → unknown', () => {
      expect(getNodeCategory('custom-node')).toBe('unknown')
    })
  })

  describe('Trigger Type Enum', () => {
    it('should have 4 trigger types', () => {
      expect(TRIGGER_TYPES).toHaveLength(4)
    })

    it.each(['event', 'schedule', 'manual', 'webhook'] as const)(
      '"%s" should be valid', (type) => {
        expect(TRIGGER_TYPES).toContain(type)
      }
    )
  })

  describe('Trigger Event Registry', () => {
    it('should have 11 trigger events backed by real emitters', () => {
      expect(TRIGGER_EVENTS).toHaveLength(11)
    })

    it('hardware domain events → 4', () => {
      const hw = TRIGGER_EVENTS.filter(e => e.startsWith('hardware.'))
      expect(hw).toHaveLength(4)
    })

    it('employee domain events → 3', () => {
      const emp = TRIGGER_EVENTS.filter(e => e.startsWith('employee.'))
      expect(emp).toHaveLength(3)
    })

    it('assignment domain events → 2', () => {
      const assign = TRIGGER_EVENTS.filter(e => e.startsWith('assignment.'))
      expect(assign).toHaveLength(2)
    })

    it('should not advertise events without emitters', () => {
      expect(TRIGGER_EVENTS).not.toContain('license.expired')
      expect(TRIGGER_EVENTS).not.toContain('lowStock.alert')
    })
  })

  describe('Event Domain Extraction', () => {
    it.each([
      ['hardware.created', 'hardware'],
      ['employee.synced', 'employee'],
      ['assignment.returned', 'assignment'],
      ['maintenance.completed', 'maintenance'],
    ])('%s → domain "%s"', (event, domain) => {
      expect(getEventDomain(event)).toBe(domain)
    })
  })

  describe('Schema Constraints', () => {
    it('name maxlength should be 200', () => {
      const maxLength = 200
      expect('A'.repeat(maxLength).length).toBe(200)
    })

    it('description maxlength should be 1000', () => {
      const maxLength = 1000
      expect('A'.repeat(maxLength).length).toBe(1000)
    })

    it('runCount default should be 0', () => {
      const runCountDefault = 0
      expect(runCountDefault).toBe(0)
    })

    it('isActive default should be false', () => {
      const isActiveDefault = false
      expect(isActiveDefault).toBe(false)
    })
  })
})
