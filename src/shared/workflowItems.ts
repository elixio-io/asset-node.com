// A single unit of data flowing between workflow nodes. Wrapping the payload in
// `{ json }` leaves room to add sibling channels (binary, metadata) later
// without changing the shape nodes already destructure. No binary payloads in v1.
export interface WorkflowItem {
  json: Record<string, any>
}

// The output handle every single-output node emits on. Routing nodes use named
// handles instead (condition 'true'/'false', switch 'branch-N'/'default',
// loop 'loop'/'done', approval 'approved'/'rejected', filter 'true').
export const DEFAULT_OUTPUT_HANDLE = 'main'

// A node's full output: items keyed by the handle they leave on.
export type NodeOutputItems = Record<string, WorkflowItem[]>

// How many items to persist per node result. The full set still flows in-memory
// during execution; only what's written to the run document is capped.
export const STORED_ITEMS_CAP = 10

// Coerce an arbitrary value (executor return, trigger payload, DB doc) into
// items. Objects with a `json` key are treated as already-wrapped items.
export function toWorkflowItems(value: unknown): WorkflowItem[] {
  if (Array.isArray(value)) {
    return value.map(entry =>
      entry && typeof entry === 'object' && 'json' in (entry as any)
        ? (entry as WorkflowItem)
        : { json: (entry ?? {}) as Record<string, any> }
    )
  }
  if (value && typeof value === 'object') return [{ json: value as Record<string, any> }]
  return []
}
