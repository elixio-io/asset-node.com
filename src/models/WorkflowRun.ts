import mongoose, { Schema, InferSchemaType } from 'mongoose'


const NodeResultSchema = new Schema({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  status: {
    type: String,
    enum: ['skipped', 'success', 'failed', 'waiting'],
    required: true
  },
  output: { type: Schema.Types.Mixed },
  // Capped slice of the node's output items (the item stream) + the true total.
  items: { type: Schema.Types.Mixed },
  itemCount: { type: Number },
  error: { type: String },
  duration: { type: Number }
}, { _id: false })

const WorkflowRunSchema = new Schema({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  workflowId: {
    type: Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true
  },
  workflowName: { type: String },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed', 'waiting'],
    default: 'running'
  },
  triggeredBy: {
    type: String,
    enum: ['event', 'schedule', 'manual', 'webhook', 'test'],
    required: true
  },
  triggerData: { type: Schema.Types.Mixed },
  nodeResults: [NodeResultSchema],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  error: { type: String }
}, { timestamps: true })

WorkflowRunSchema.index({ orgId: 1, workflowId: 1, createdAt: -1 })

WorkflowRunSchema.index({ workflowId: 1, createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export type IWorkflowRun = InferSchemaType<typeof WorkflowRunSchema>
export const WorkflowRun = mongoose.model('WorkflowRun', WorkflowRunSchema)
