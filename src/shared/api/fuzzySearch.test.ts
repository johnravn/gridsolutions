import { describe, expect, it, vi } from 'vitest'
import { applyFuzzySearch, postgrestIlikePatterns } from './fuzzySearch'

function createMockQuery() {
  const or = vi.fn().mockReturnThis()
  return { or }
}

function like(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`,
    'i',
  )
  return re.test(text)
}

describe('postgrestIlikePatterns', () => {
  it('adds a compacted pattern so "1 ch" can match "1ch"', () => {
    expect(postgrestIlikePatterns('1 ch')).toEqual(
      expect.arrayContaining(['%1 ch%', '%1ch%', '%1%c%h%']),
    )
  })

  it('adds a single-character wildcard so "share" can match "shure"', () => {
    const patterns = postgrestIlikePatterns('share')
    expect(patterns).toContain('%share%')
    expect(patterns).toContain('%sh_re%')
  })

  it('keeps typo candidates like ungdsmfest → ungdomsfest', () => {
    const patterns = postgrestIlikePatterns('ungdsmfest')
    expect(patterns.some((pattern) => like(pattern, 'ungdomsfest'))).toBe(true)
  })
})

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

  it('adds spaced and typo patterns for terms longer than 2 chars', () => {
    const query = createMockQuery()
    applyFuzzySearch(query, 'abc', ['title'])
    const arg = query.or.mock.calls[0][0] as string
    expect(arg).toContain('title.ilike.%a%b%c%')
    expect(arg).toContain('title.ilike.%_bc%')
  })
})
