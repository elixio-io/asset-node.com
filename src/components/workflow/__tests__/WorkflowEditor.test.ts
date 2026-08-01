import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vue-flow/core', () => ({
  VueFlow: defineComponent({
    name: 'VueFlow',
    props: {
      nodes: { type: Array, default: () => [] },
      edges: { type: Array, default: () => [] },
      isValidConnection: { type: Function, default: undefined }
    },
    emits: ['connect', 'edge-update', 'edge-update-end', 'update:nodes', 'update:edges'],
    setup(_, { slots }) {
      return () => h('div', { 'data-testid': 'vue-flow' }, slots.default?.())
    }
  }),
  Handle: defineComponent({ name: 'Handle', setup: () => () => h('span') }),
  Panel: defineComponent({ name: 'Panel', setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  BaseEdge: defineComponent({ name: 'BaseEdge', setup: () => () => h('path') }),
  EdgeLabelRenderer: defineComponent({ name: 'EdgeLabelRenderer', setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  getBezierPath: () => ['M0 0 L100 100', 50, 50],
  Position: { Left: 'left', Right: 'right' },
  useVueFlow: () => ({
    project: (position: { x: number; y: number }) => position,
    removeEdges: vi.fn(),
    onEdgeUpdateStart: vi.fn(),
    onEdgeMouseEnter: vi.fn(),
    onEdgeMouseLeave: vi.fn(),
    onNodeClick: vi.fn()
  })
}))

vi.mock('@vue-flow/background', () => ({ Background: defineComponent({ setup: () => () => h('div') }) }))
vi.mock('@vue-flow/controls', () => ({ Controls: defineComponent({ setup: () => () => h('div') }) }))
vi.mock('@vue-flow/minimap', () => ({ MiniMap: defineComponent({ setup: () => () => h('div') }) }))

import WorkflowEditor from '../WorkflowEditor.vue'
import TriggerWebhookParams from '../params/TriggerWebhookParams.vue'
import WorkflowNodeCard from '../WorkflowNodeCard.vue'
import NodePickerPanel from '../NodePickerPanel.vue'
import NodeAddHandleButton from '../NodeAddHandleButton.vue'
import { WORKFLOW_NODE_CATALOG } from '../../../shared/workflowNodeCatalog'

describe('WorkflowEditor connections', () => {
  it('adds a new connection once and rejects only a real duplicate', async () => {
    const wrapper = mount(WorkflowEditor, {
      props: {
        initialNodes: [
          { id: 'trigger', type: 'trigger-manual', position: { x: 0, y: 0 }, data: {} },
          { id: 'condition', type: 'condition', position: { x: 200, y: 0 }, data: {} }
        ],
        initialEdges: []
      }
    })
    const flow = wrapper.findComponent({ name: 'VueFlow' })
    expect(flow.props('isValidConnection')).toBeUndefined()

    flow.vm.$emit('connect', {
      source: 'trigger',
      sourceHandle: null,
      target: 'condition',
      targetHandle: null
    })
    await nextTick()

    const firstUpdate = wrapper.emitted('update')?.at(-1)?.[0] as { edges: unknown[] }
    expect(firstUpdate.edges).toHaveLength(1)

    flow.vm.$emit('connect', {
      source: 'trigger',
      sourceHandle: null,
      target: 'condition',
      targetHandle: null
    })
    await nextTick()

    const secondUpdate = wrapper.emitted('update')?.at(-1)?.[0] as { edges: unknown[] }
    expect(secondUpdate.edges).toHaveLength(1)
    expect(wrapper.text()).toContain('That connection already exists.')
  })
})

describe('TriggerWebhookParams', () => {
  it('keeps method controls available and prompts to save before a URL exists', () => {
    const wrapper = mount(TriggerWebhookParams, {
      props: { data: { method: 'POST', path: '/incoming' } }
    })

    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('https://')
    expect(wrapper.text()).toContain('Save the workflow to generate your webhook URL')
  })

  it('shows a real, copyable URL once the workflow has issued a hookId', () => {
    const wrapper = mount(TriggerWebhookParams, {
      props: { data: { method: 'POST', path: '/incoming', hookId: 'abc123' } }
    })

    expect(wrapper.text()).not.toContain('Save the workflow to generate your webhook URL')
    const urlInput = wrapper.findAll('input').find(i => (i.element as HTMLInputElement).readOnly)
    expect(urlInput?.element.value).toContain('/hooks/abc123')
  })
})

describe('WorkflowNodeCard', () => {
  const mountCard = (type: string, data: Record<string, any>) => mount(WorkflowNodeCard, {
    props: { id: 'n1', type, data },
    global: {
      provide: {
        workflowConnectedHandles: ref(new Set<string>()),
        workflowRequestAddNode: vi.fn()
      }
    }
  })

  it('renders the catalog label and a config summary', () => {
    const wrapper = mountCard('action-notify', { channel: 'slack', title: 'Warranty alert', message: 'x' })
    expect(wrapper.text()).toContain('Notify')
    expect(wrapper.text()).toContain('slack: Warranty alert')
  })

  it('marks unconfigured nodes and lists switch cases with a default row', () => {
    const unconfigured = mountCard('action-status', {})
    expect(unconfigured.find('.node-summary').classes()).toContain('unconfigured')

    const switchCard = mountCard('logic-switch', { field: 'status', branches: ['berlin', ''] })
    expect(switchCard.text()).toContain('berlin')
    expect(switchCard.text()).toContain('Case 2 (empty)')
    expect(switchCard.text()).toContain('Default')
  })
})

describe('NodePickerPanel', () => {
  it('filters entries by search and picks the first match on Enter', async () => {
    const wrapper = mount(NodePickerPanel, { props: { visible: true, mode: 'add' } })

    expect(wrapper.text()).toContain('Notify')
    expect(wrapper.text()).toContain('Condition')

    await wrapper.find('input').setValue('notif')
    expect(wrapper.text()).toContain('Notify')
    expect(wrapper.text()).not.toContain('Condition')

    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('pick')?.[0]).toEqual(['action-notify'])
  })

  it('hides triggers in connect mode and relabels them when one already exists', () => {
    const connect = mount(NodePickerPanel, { props: { visible: true, mode: 'connect' } })
    expect(connect.text()).not.toContain('Triggers')
    expect(connect.text()).not.toContain('Manual / API')

    const add = mount(NodePickerPanel, { props: { visible: true, mode: 'add', hasTrigger: true } })
    expect(add.text()).toContain('Add another trigger')
  })

  it('never offers hidden catalog entries, but shows every visible one', () => {
    const wrapper = mount(NodePickerPanel, { props: { visible: true, mode: 'add' } })
    for (const entry of WORKFLOW_NODE_CATALOG) {
      if (entry.hidden) {
        expect(wrapper.text()).not.toContain(entry.description)
      } else {
        expect(wrapper.text()).toContain(entry.label)
      }
    }
  })
})

describe('NodeAddHandleButton', () => {
  const mountButton = (connected: string[], props: { nodeId: string; handleId?: string }) => {
    const requestAddNode = vi.fn()
    const wrapper = mount(NodeAddHandleButton, {
      props,
      global: {
        provide: {
          workflowConnectedHandles: ref(new Set(connected)),
          workflowRequestAddNode: requestAddNode
        }
      }
    })
    return { wrapper, requestAddNode }
  }

  it('renders only for dangling handles and requests the picker on click', async () => {
    const dangling = mountButton([], { nodeId: 'n1' })
    expect(dangling.wrapper.find('button').exists()).toBe(true)
    await dangling.wrapper.find('button').trigger('click')
    expect(dangling.requestAddNode).toHaveBeenCalledWith('n1', null)

    const connected = mountButton(['n1::'], { nodeId: 'n1' })
    expect(connected.wrapper.find('button').exists()).toBe(false)
  })

  it('tracks per-handle connections for branch outputs', () => {
    const { wrapper } = mountButton(['n1::true'], { nodeId: 'n1', handleId: 'false' })
    expect(wrapper.find('button').exists()).toBe(true)

    const covered = mountButton(['n1::false'], { nodeId: 'n1', handleId: 'false' })
    expect(covered.wrapper.find('button').exists()).toBe(false)
  })
})

describe('WorkflowEditor edge splice', () => {
  it('splices a picked node into an existing edge, preserving the sourceHandle', async () => {
    const wrapper = mount(WorkflowEditor, {
      props: {
        initialNodes: [
          { id: 'cond', type: 'condition', position: { x: 0, y: 0 }, data: {} },
          { id: 'notify', type: 'action-notify', position: { x: 400, y: 0 }, data: {} }
        ],
        initialEdges: [
          { id: 'edge-1', source: 'cond', sourceHandle: 'true', target: 'notify' }
        ]
      }
    })

    // The splice entry point is provided to WorkflowEdge instances; the mocked
    // VueFlow doesn't render edges, so invoke the provided callback directly.
    const provides = (wrapper.vm.$ as any).provides
    provides.workflowRequestSpliceNode('edge-1', 'cond', 'true', 'notify')
    await nextTick()

    const panel = wrapper.findComponent(NodePickerPanel)
    expect(panel.props('visible')).toBe(true)
    expect(panel.props('mode')).toBe('connect')

    panel.vm.$emit('pick', 'logic-delay')
    await nextTick()

    const update = wrapper.emitted('update')?.at(-1)?.[0] as { nodes: any[]; edges: any[] }
    expect(update.nodes).toHaveLength(3)
    const delayNode = update.nodes.find(n => n.type === 'logic-delay')
    expect(delayNode).toBeTruthy()

    expect(update.edges).toHaveLength(2)
    expect(update.edges.find(e => e.id === 'edge-1')).toBeUndefined()
    const firstHop = update.edges.find(e => e.source === 'cond')
    const secondHop = update.edges.find(e => e.source === delayNode.id)
    expect(firstHop.sourceHandle).toBe('true')
    expect(firstHop.target).toBe(delayNode.id)
    expect(secondHop.target).toBe('notify')
  })
})

describe('WorkflowEditor node picker', () => {
  it('opens from the toolbar + and appends the picked node unconnected', async () => {
    const wrapper = mount(WorkflowEditor, {
      props: {
        initialNodes: [
          { id: 'trigger', type: 'trigger-manual', position: { x: 0, y: 0 }, data: {} }
        ],
        initialEdges: []
      }
    })

    await wrapper.find('.canvas-add-btn').trigger('click')
    const panel = wrapper.findComponent(NodePickerPanel)
    expect(panel.props('visible')).toBe(true)
    expect(panel.props('mode')).toBe('add')
    expect(panel.props('hasTrigger')).toBe(true)

    panel.vm.$emit('pick', 'action-audit-log')
    await nextTick()

    const update = wrapper.emitted('update')?.at(-1)?.[0] as { nodes: any[]; edges: unknown[] }
    expect(update.nodes).toHaveLength(2)
    expect(update.nodes.at(-1).type).toBe('action-audit-log')
    expect(update.edges).toHaveLength(0)
    expect(wrapper.findComponent(NodePickerPanel).props('visible')).toBe(false)
  })
})
