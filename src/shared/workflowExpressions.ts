// Expression resolution for `{{ ... }}` templates in node parameters.
//
// Supported inside {{ }}:
//   {{ $json.a.b }}                     field of the current item
//   {{ $json["a b"] }} / {{ $json.a[0] }}
//   {{ $json }}                         the whole current item (JSON-stringified)
//   {{ $('Node Name').item.json.a }}    another node's first output item
//   {{ $node["Node Name"].json.a }}     same, legacy accessor form
//   {{ orgId }} / {{ timestamp }} / {{ triggeredBy }}   run context
//   {{ hardwareId }} / {{ foo.bar }}    bare path against the current item
//   {{ provider|created|updated|total|errorCount }}     sync-summary helpers
//
// This is a RESTRICTED resolver — pure path access plus a few named tokens.
// There is deliberately NO JavaScript evaluation (no eval/Function), so a
// template can never execute code or reach a database operator. Unknown
// expressions are left verbatim so authors notice they didn't resolve.

export interface ExpressionScope {
  // The current item's json (during per-item execution) or the first input
  // item's json / trigger payload otherwise.
  json: Record<string, any>
  orgId: string
  triggeredBy: string
  // Resolve a node name to its first output item's json (undefined if unknown).
  nodeItemJson?: (name: string) => Record<string, any> | undefined
}

// Property names that must never be traversed — blocks prototype-pollution /
// function exposure through crafted expressions.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

type Segment = string | number

// One `.ident`, `["str"]`, `['str']`, or `[123]` access step.
const ACCESS_STEP = /^\s*(?:\.([A-Za-z_$][\w$]*)|\[\s*(?:'([^']*)'|"([^"]*)"|(\d+))\s*\])/

function parseAccessPath(input: string): { segments: Segment[]; rest: string } | null {
  const segments: Segment[] = []
  let s = input
  while (/^\s*[.[]/.test(s)) {
    const m = s.match(ACCESS_STEP)
    if (!m) return null
    if (m[1] !== undefined) segments.push(m[1])
    else if (m[2] !== undefined) segments.push(m[2])
    else if (m[3] !== undefined) segments.push(m[3])
    else segments.push(Number(m[4]))
    s = s.slice(m[0].length)
  }
  return { segments, rest: s.trim() }
}

function resolvePath(root: any, segments: Segment[]): any {
  let cur = root
  for (const seg of segments) {
    if (cur == null) return undefined
    if (typeof seg === 'string' && BLOCKED_KEYS.has(seg)) return undefined
    cur = cur[seg as any]
    if (typeof cur === 'function') return undefined
  }
  return cur
}

function matchNodeRef(expr: string): { name: string; rest: string } | null {
  // $('Name') or $("Name")
  let m = expr.match(/^\$\(\s*'([^']*)'\s*\)/) || expr.match(/^\$\(\s*"([^"]*)"\s*\)/)
  if (m) return { name: m[1], rest: expr.slice(m[0].length).replace(/^\s*\.item/, '') }
  // $node['Name'] or $node["Name"]
  m = expr.match(/^\$node\s*\[\s*'([^']*)'\s*\]/) || expr.match(/^\$node\s*\[\s*"([^"]*)"\s*\]/)
  if (m) return { name: m[1], rest: expr.slice(m[0].length) }
  return null
}

// Resolve a single trimmed expression to a value, or `undefined` if unknown.
function resolveExpressionValue(expr: string, scope: ExpressionScope): any {
  const t = expr.trim()

  // Node reference: $('Name').item.json.path  /  $node["Name"].json.path
  const ref = matchNodeRef(t)
  if (ref) {
    const jm = ref.rest.match(/^\s*\.json/)
    if (!jm) return undefined
    const parsed = parseAccessPath(ref.rest.slice(jm[0].length))
    if (!parsed || parsed.rest) return undefined
    const nodeJson = scope.nodeItemJson?.(ref.name)
    return parsed.segments.length ? resolvePath(nodeJson, parsed.segments) : nodeJson
  }

  // Current item: $json / $json.path
  if (t === '$json') return scope.json
  if (t.startsWith('$json')) {
    const parsed = parseAccessPath(t.slice('$json'.length))
    if (!parsed || parsed.rest) return undefined
    return resolvePath(scope.json, parsed.segments)
  }

  // Named run-context tokens.
  if (t === 'orgId') return scope.orgId
  if (t === 'timestamp') return new Date().toISOString()
  if (t === 'triggeredBy') return scope.triggeredBy

  // Sync-summary helpers keep their legacy defaults so existing audit/notify
  // messages ({{created}} etc.) still render "0" rather than a literal.
  const json = scope.json || {}
  if (t === 'provider') return json.provider ?? ''
  if (t === 'created') return String(json.created ?? 0)
  if (t === 'updated') return String(json.updated ?? 0)
  if (t === 'errorCount') return String(json.errorCount ?? 0)
  if (t === 'total') return String(Number(json.created ?? 0) + Number(json.updated ?? 0))

  // Bare path against the current item: hardwareId, foo.bar, items[0].id …
  const head = t.match(/^([A-Za-z_$][\w$]*)/)
  if (head) {
    const parsed = parseAccessPath(t.slice(head[1].length))
    if (parsed && !parsed.rest) {
      if (BLOCKED_KEYS.has(head[1])) return undefined
      return resolvePath(scope.json, [head[1], ...parsed.segments])
    }
  }
  return undefined
}

function coerce(value: any, original: string): string {
  if (value === undefined || value === null) return original // leave verbatim
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function resolveExpression(template: string, scope: ExpressionScope): string {
  if (!template || typeof template !== 'string') return template
  return template.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const value = resolveExpressionValue(String(inner), scope)
    return coerce(value, match)
  })
}
