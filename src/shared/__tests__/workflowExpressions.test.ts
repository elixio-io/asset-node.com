import { describe, expect, it } from 'vitest'
import { resolveExpression, type ExpressionScope } from '../workflowExpressions'

function scope(json: Record<string, any>, nodes: Record<string, Record<string, any>> = {}): ExpressionScope {
  return {
    json,
    orgId: 'org-1',
    triggeredBy: 'manual',
    nodeItemJson: (name: string) => nodes[name]
  }
}

describe('resolveExpression', () => {
  it('resolves $json and nested paths of the current item', () => {
    const s = scope({ hardwareId: 'hw-1', nested: { deep: 42 }, list: [{ id: 'a' }, { id: 'b' }] })
    expect(resolveExpression('{{ $json.hardwareId }}', s)).toBe('hw-1')
    expect(resolveExpression('{{ $json.nested.deep }}', s)).toBe('42')
    expect(resolveExpression('{{ $json.list[1].id }}', s)).toBe('b')
    expect(resolveExpression('id={{ $json["hardwareId"] }}', s)).toBe('id=hw-1')
  })

  it('stringifies objects for {{ $json }}', () => {
    expect(resolveExpression('{{ $json }}', scope({ a: 1 }))).toBe('{"a":1}')
  })

  it('resolves bare fields and dotted paths against the current item (back-compat)', () => {
    const s = scope({ hardwareId: 'hw-9', meta: { tag: 'x' } })
    expect(resolveExpression('{{ hardwareId }}', s)).toBe('hw-9')
    expect(resolveExpression('{{ meta.tag }}', s)).toBe('x')
  })

  it('resolves run-context tokens and sync helpers with legacy defaults', () => {
    const s = scope({ created: 3 })
    expect(resolveExpression('{{ orgId }}', s)).toBe('org-1')
    expect(resolveExpression('{{ triggeredBy }}', s)).toBe('manual')
    expect(resolveExpression('{{ created }}/{{ updated }}/{{ total }}', s)).toBe('3/0/3')
    expect(resolveExpression('{{ timestamp }}', s)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('resolves references to another node\'s output item', () => {
    const s = scope({}, { 'Get Hardware': { assetTag: 'LT-100' } })
    expect(resolveExpression("{{ $('Get Hardware').item.json.assetTag }}", s)).toBe('LT-100')
    expect(resolveExpression('{{ $node["Get Hardware"].json.assetTag }}', s)).toBe('LT-100')
  })

  it('leaves unknown expressions verbatim', () => {
    const s = scope({ a: 1 })
    expect(resolveExpression('{{ $json.missing }}', s)).toBe('{{ $json.missing }}')
    expect(resolveExpression('{{ unknownField }}', s)).toBe('{{ unknownField }}')
    expect(resolveExpression("{{ $('No Such Node').item.json.x }}", s)).toBe("{{ $('No Such Node').item.json.x }}")
  })

  it('never executes code or exposes prototype internals (injection-safe)', () => {
    const s = scope({ a: 1 })
    // No JS evaluation — arithmetic/JS is not run, it's an unknown expression.
    expect(resolveExpression('{{ 7*7 }}', s)).toBe('{{ 7*7 }}')
    expect(resolveExpression('{{ process.env.SECRET }}', s)).toBe('{{ process.env.SECRET }}')
    // Prototype / function access is blocked.
    expect(resolveExpression('{{ $json.constructor }}', s)).toBe('{{ $json.constructor }}')
    expect(resolveExpression('{{ $json.__proto__ }}', s)).toBe('{{ $json.__proto__ }}')
    expect(resolveExpression('{{ constructor.constructor }}', s)).toBe('{{ constructor.constructor }}')
  })

  it('handles multiple expressions and non-string/empty input', () => {
    const s = scope({ a: 'X', b: 'Y' })
    expect(resolveExpression('{{ a }}-{{ b }}', s)).toBe('X-Y')
    expect(resolveExpression('', s)).toBe('')
    expect(resolveExpression('no expressions here', s)).toBe('no expressions here')
  })
})
