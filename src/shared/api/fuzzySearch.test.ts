import { describe, expect, it, vi } from 'vitest'
import { applyFuzzySearch } from './fuzzySearch'

function createMockQuery() {
  const or = vi.fn().mockReturnThis()
  return { or }
}

describe('applyFuzzySearch', () => {
  it('returns query unchanged for empty search term', () => {
    const query = createMockQuery()
    const result = applyFuzzySearch(query, '', ['name'])
    expect(result).toBe(query)
    expect(query.or).not.toHaveBeenCalled()
  })

  it('returns query unchanged for whitespace-only term', () => {
    const query = createMockQuery()
    applyFuzzySearch(query, '   ', ['name'])
    expect(query.or).not.toHaveBeenCalled()
  })

  it('builds or conditions for columns', () => {
    const query = createMockQuery()
    applyFuzzySearch(query, 'john', ['name', 'email'])
    expect(query.or).toHaveBeenCalledOnce()
    const arg = query.or.mock.calls[0][0] as string
    expect(arg).toContain('name.ilike.%john%')
    expect(arg).toContain('email.ilike.%john%')
  })

  it('adds spaced pattern for terms longer than 2 chars', () => {
    const query = createMockQuery()
    applyFuzzySearch(query, 'abc', ['title'])
    const arg = query.or.mock.calls[0][0] as string
    expect(arg).toContain('title.ilike.%a%b%c%')
  })
})
