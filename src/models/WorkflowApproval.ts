import mongoose, { Schema, InferSchemaType } from 'mongoose'

// A paused workflow run waiting on a human decision. Created when execution
// reaches a logic-approval node; the run stops with status 'waiting' until an
// approver opens the signed link, which resumes the approved/rejected branch.
const WorkflowApprovalSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  workflowId: { type: Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  runId: { type: Schema.Types.ObjectId, ref: 'WorkflowRun', required: true },
  // Graph node the run paused at, and the trigger node it started from — so the
  // resumed branch runs with the right subgraph and context.
  nodeId: { type: String, required: true },
  fromTriggerNodeId: { type: String },
  triggerData: { type: Schema.Types.Mixed },
  // Unguessable bearer token in the approve/reject URL.
  token: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date },
  decidedVia: { type: String }
}, { timestamps: true })

// Auto-expire abandoned approvals after 30 days.
WorkflowApprovalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

export type IWorkflowApproval = InferSchemaType<typeof WorkflowApprovalSchema>
export const WorkflowApproval = mongoose.model('WorkflowApproval', WorkflowApprovalSchema)
