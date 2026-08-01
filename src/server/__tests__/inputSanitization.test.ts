import { describe, it, expect } from 'vitest'
import { escapeRegex } from '../../server/utils/inputSanitization'

describe('escapeRegex()', () => {
  it('passes through plain alphanumeric text', () => {
    expect(escapeRegex('hello world')).toBe('hello world')
  })

  it('escapes dots', () => {
    expect(escapeRegex('file.txt')).toBe('file\\.txt')
  })

  it('escapes asterisks', () => {
    expect(escapeRegex('a*b')).toBe('a\\*b')
  })

  it('escapes plus signs', () => {
    expect(escapeRegex('a+b')).toBe('a\\+b')
  })

  it('escapes question marks', () => {
    expect(escapeRegex('what?')).toBe('what\\?')
  })

  it('escapes caret', () => {
    expect(escapeRegex('^start')).toBe('\\^start')
  })

  it('escapes dollar sign', () => {
    expect(escapeRegex('end$')).toBe('end\\$')
  })

  it('escapes curly braces', () => {
    expect(escapeRegex('a{3}')).toBe('a\\{3\\}')
  })

  it('escapes parentheses', () => {
    expect(escapeRegex('(group)')).toBe('\\(group\\)')
  })

  it('escapes pipe', () => {
    expect(escapeRegex('a|b')).toBe('a\\|b')
  })

  it('escapes square brackets', () => {
    expect(escapeRegex('[abc]')).toBe('\\[abc\\]')
  })

  it('escapes backslash', () => {
    expect(escapeRegex('path\\file')).toBe('path\\\\file')
  })

  it('handles empty string', () => {
    expect(escapeRegex('')).toBe('')
  })


  it('neutralises catastrophic backtracking pattern (a+)+$', () => {
    const escaped = escapeRegex('(a+)+$')
    expect(escaped).toBe('\\(a\\+\\)\\+\\$')
    expect(() => new RegExp(escaped)).not.toThrow()
  })

  it('neutralises .* wildcard', () => {
    const escaped = escapeRegex('.*')
    expect(escaped).toBe('\\.\\*')
  })

  it('neutralises complex nested quantifier (a+|b*)+', () => {
    const escaped = escapeRegex('(a+|b*)+')
    expect(escaped).toBe('\\(a\\+\\|b\\*\\)\\+')
  })

  it('neutralises OR injection admin|secret', () => {
    const escaped = escapeRegex('admin|secret')
    expect(escaped).toBe('admin\\|secret')
  })

  it('combined: multiple metacharacters in a real search', () => {
    const escaped = escapeRegex('item (v2.0) [beta]')
    expect(escaped).toBe('item \\(v2\\.0\\) \\[beta\\]')
  })
})
