
import { EventEmitter } from 'events'
import { Workflow } from '../../models/Workflow'
import { WORKFLOW_EVENT_TYPES } from '../../shared/workflowValidation'

let executeWorkflow: typeof import('./workflowEngine').executeWorkflow

async function getExecuteWorkflow() {
  if (!executeWorkflow) {
    const mod = await import('./workflowEngine')
    executeWorkflow = mod.executeWorkflow
  }
  return executeWorkflow
}


export type WorkflowEventType = typeof WORKFLOW_EVENT_TYPES[number]

export interface WorkflowEventData {
  orgId: string
  [key: string]: unknown
}


class WorkflowEventBus extends EventEmitter {
  private initialized = false

  constructor() {
    super()
    this.setMaxListeners(50)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    this.on('workflow-event', async (eventType: WorkflowEventType, data: WorkflowEventData) => {
      try {
        await this.handleEvent(eventType, data)
      } catch (err) {
        console.error(`[WorkflowEventBus] Error handling ${eventType}:`, err)
      }
    })

    console.log('⚡ Workflow Event Bus initialized')
  }

  emitWorkflowEvent(eventType: WorkflowEventType, data: WorkflowEventData): void {
    this.emit('workflow-event', eventType, data)
  }

  private async handleEvent(eventType: WorkflowEventType, data: WorkflowEventData): Promise<void> {
    const workflows = await Workflow.find({
      orgId: data.orgId,
      isActive: true,
      'triggers.type': 'event',
      'triggers.event': eventType
    }).lean()

    if (workflows.length === 0) return

    // A workflow may hold several event triggers; fire once per matching one,
    // running only the subgraph that trigger reaches.
    const firings: Array<{ wf: any; triggerNodeId: string }> = []
    for (const wf of workflows) {
      for (const trigger of (wf.triggers || [])) {
        if (trigger?.type === 'event' && trigger?.event === eventType) {
          firings.push({ wf, triggerNodeId: trigger.nodeId })
        }
      }
    }

    console.log(`⚡ [WorkflowEventBus] ${eventType} → ${firings.length} trigger firing(s)`)

    const exec = await getExecuteWorkflow()

    const results = await Promise.allSettled(
      firings.map(({ wf, triggerNodeId }) =>
        exec(String(wf._id), String(wf.orgId), 'event', data, { fromTriggerNodeId: triggerNodeId })
      )
    )

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        console.error(`⚡ [WorkflowEventBus] Workflow ${firings[i].wf.name} failed:`, r.reason)
      }
    }
  }
}


const cronJobs = new Map<string, ReturnType<typeof setInterval>>()

export async function refreshCronWorkflows(orgId?: string): Promise<void> {
  for (const [key, timer] of cronJobs.entries()) {
    if (!orgId || key.startsWith(`${orgId}:`)) {
      clearInterval(timer)
      cronJobs.delete(key)
    }
  }

  const filter: Record<string, unknown> = {
    isActive: true,
    'triggers.type': 'schedule'
  }
  if (orgId) filter.orgId = orgId

  const workflows = await Workflow.find(filter).lean()

  const exec = await getExecuteWorkflow()

  for (const wf of workflows) {
    // Register one timer per schedule trigger — a workflow may have several,
    // each running only the subgraph it reaches.
    for (const trigger of (wf.triggers || [])) {
      if (trigger?.type !== 'schedule') continue
      const cronExpr = trigger.cron
      if (!cronExpr) continue

      const intervalMs = parseCronToMs(cronExpr)
      if (!intervalMs) {
        console.warn(`⚡ [Cron] Unsupported cron expression: ${cronExpr} for workflow ${wf.name}`)
        continue
      }

      const key = `${wf.orgId}:${wf._id}:${trigger.nodeId}`
      const triggerNodeId = trigger.nodeId
      const timer = setInterval(async () => {
        try {
          console.log(`⚡ [Cron] Running scheduled workflow: ${wf.name}`)
          await exec(String(wf._id), String(wf.orgId), 'schedule', { scheduledAt: new Date().toISOString() }, { fromTriggerNodeId: triggerNodeId })
        } catch (err) {
          console.error(`⚡ [Cron] Scheduled workflow ${wf.name} failed:`, err)
        }
      }, intervalMs)

      timer.unref()
      cronJobs.set(key, timer)
      console.log(`⚡ [Cron] Registered "${wf.name}" — every ${intervalMs / 60000} min`)
    }
  }
}

function parseCronToMs(expr: string): number | null {
  const map: Record<string, number> = {
    '*/5m': 5 * 60 * 1000,
    '*/15m': 15 * 60 * 1000,
    '*/30m': 30 * 60 * 1000,
    '*/1h': 60 * 60 * 1000,
    '*/6h': 6 * 60 * 60 * 1000,
    '*/12h': 12 * 60 * 60 * 1000,
    '*/24h': 24 * 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000
  }
  return map[expr] ?? null
}


export const workflowEventBus = new WorkflowEventBus()
