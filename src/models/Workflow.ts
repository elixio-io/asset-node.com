import mongoose, { Schema, InferSchemaType } from 'mongoose'
import { changeTrackingPlugin } from '../server/middleware/changeTracking'
import { WORKFLOW_EVENT_TYPES } from '../shared/workflowValidation'


const WorkflowNodeSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [



      'trigger-event', 'trigger-schedule', 'trigger-webhook', 'trigger-manual',
      'condition', 'logic-switch', 'logic-delay', 'filter',
      'logic-merge', 'logic-stop-error', 'logic-noop', 'logic-loop', 'logic-approval',
      'action-notify', 'action-status', 'action-assign',
      'action-update-field', 'action-webhook', 'action-audit-log',
      'action-tag', 'action-maintenance', 'action-sync', 'action-helpdesk', 'action-respond',
      'action-get-records'
    ]
  },
  data: { type: Schema.Types.Mixed, default: {} },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  }
}, { _id: false })

const WorkflowEdgeSchema = new Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String, default: null },
  animated: { type: Boolean, default: true },
  style: { type: Schema.Types.Mixed, default: null }
}, { _id: false })

// One entry per trigger node in the graph. A workflow may have several
// (e.g. an Event + a Webhook + a Schedule all feeding the same actions).
// `nodeId` links this config back to its graph node so the engine knows
// which trigger fired and can run only the subgraph reachable from it.
const WorkflowTriggerSchema = new Schema({
  nodeId: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['event', 'schedule', 'manual', 'webhook']
  },
  event: {
    type: String,
    enum: [...WORKFLOW_EVENT_TYPES]
  },
  cron: { type: String },
  cronLabel: { type: String },
  webhookId: { type: String },
  method: { type: String, enum: ['GET', 'POST', 'PUT'], default: 'POST' },
  // 'immediate' → 202 fire-and-forget (default). 'respond' → run synchronously
  // and return an action-respond node's response (or a default) to the caller.
  responseMode: { type: String, enum: ['immediate', 'respond'], default: 'immediate' },
  // When true, inbound calls must carry a valid HMAC-SHA256 signature of the raw
  // body (X-Signature-256) computed with `secret`. `secret` is minted server-side
  // (never accepted from the client) and mirrored to the node for display.
  requireSignature: { type: Boolean, default: false },
  secret: { type: String }
}, { _id: false })

const WorkflowSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  isActive: { type: Boolean, default: false },

  triggers: { type: [WorkflowTriggerSchema], default: [] },

  nodes: [WorkflowNodeSchema],
  edges: [WorkflowEdgeSchema],

  lastRunAt: Date,
  runCount: { type: Number, default: 0 },
  lastError: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

WorkflowSchema.index({ orgId: 1, isActive: 1 })
WorkflowSchema.index({ 'triggers.type': 1, 'triggers.event': 1, isActive: 1 })
// Inbound webhook hookIds must be globally unique. Sparse so trigger elements
// without a webhookId (event/schedule/manual) don't collide on null.
WorkflowSchema.index({ 'triggers.webhookId': 1 }, { unique: true, sparse: true })

WorkflowSchema.plugin(changeTrackingPlugin)

export type IWorkflow = InferSchemaType<typeof WorkflowSchema>
export const Workflow = mongoose.model('Workflow', WorkflowSchema)
