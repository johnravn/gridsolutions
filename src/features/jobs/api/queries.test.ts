import { describe, expect, it, vi } from 'vitest'

vi.mock('@shared/api/supabase', () => ({
  supabase: {},
}))

import {
  getJobsIndexNextPageParam,
  jobsIndexIdInOrFilter,
  jobsIndexInfiniteQuery,
  jobsIndexSearchOrFilter,
  mergePostgrestAndOrFilters,
} from './queries'
import type { JobsIndexPageResult } from './queries'

function page(
  partial: Partial<JobsIndexPageResult> &
    Pick<JobsIndexPageResult, 'fetched' | 'page'>,
): JobsIndexPageResult {
  return {
    rows: [],
    count: 0,
    ...partial,
  }
}

describe('getJobsIndexNextPageParam', () => {
  it('returns the next page while the last fetch filled the page size', () => {
    const first = page({ fetched: 50, page: 1, count: 120 })
    expect(getJobsIndexNextPageParam(first, [first], 50)).toBe(2)
  })

  it('stops on a short page even if the reported count is higher', () => {
    const first = page({ fetched: 22, page: 1, count: 1000 })
    expect(getJobsIndexNextPageParam(first, [first], 50)).toBeUndefined()
  })

  it('keeps paging when estimated count under-reports a full page', () => {
    const first = page({ fetched: 50, page: 1, count: 22 })
    expect(getJobsIndexNextPageParam(first, [first], 50)).toBe(2)
  })

  it('stops when the database returns an empty page', () => {
    const first = page({ fetched: 50, page: 1, count: 200 })
    const empty = page({ fetched: 0, page: 2, count: 200 })
    expect(getJobsIndexNextPageParam(empty, [first, empty], 50)).toBeUndefined()
  })

  it('keeps paging when freelancer filtering shrinks visible rows', () => {
    const first = page({ fetched: 50, page: 1, count: 80 })
    expect(getJobsIndexNextPageParam(first, [first], 50)).toBe(2)
  })
})

describe('jobsIndexSearchOrFilter', () => {
  it('returns null for empty search', () => {
    expect(jobsIndexSearchOrFilter({ search: '   ' })).toBeNull()
  })

  it('matches title and numeric job numbers', () => {
    expect(jobsIndexSearchOrFilter({ search: '42' })).toBe(
      'title.ilike.%42%,jobnr.eq.42',
    )
  })

  it('strips a leading # so job-number searches match', () => {
    expect(jobsIndexSearchOrFilter({ search: '#42' })).toBe(
      'title.ilike.%42%,jobnr.eq.42',
    )
  })

  it('includes customer and customer-user ids so name search pages correctly', () => {
    expect(
      jobsIndexSearchOrFilter({
        search: 'Acme',
        customerIds: ['cust-1', 'cust-2'],
        customerUserIds: ['user-1'],
      }),
    ).toBe(
      'title.ilike.%Acme%,customer_id.in.(cust-1,cust-2),customer_user_id.in.(user-1)',
    )
  })

  it('strips PostgREST separators from the search term', () => {
    expect(jobsIndexSearchOrFilter({ search: 'Foo, (Bar)' })).toBe(
      'title.ilike.%Foo Bar%',
    )
  })
})

describe('jobsIndexInfiniteQuery', () => {
  it('includes list filters in the query key so pages reset on search and status', () => {
    const q = jobsIndexInfiniteQuery({
      companyId: 'company-1',
      search: 'nordic',
      sortBy: 'start_at',
      sortDir: 'asc',
      statuses: ['completed'],
    })

    expect(q.queryKey).toEqual([
      'company',
      'company-1',
      'jobs-index-infinite',
      'nordic',
      undefined,
      undefined,
      'start_at',
      'asc',
      undefined,
      undefined,
      false,
      null,
      ['completed'],
      true,
      null,
      50,
    ])
  })
})

describe('jobsIndexIdInOrFilter', () => {
  it('returns null for an empty list', () => {
    expect(jobsIndexIdInOrFilter([])).toBeNull()
  })

  it('chunks large id lists', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    const filter = jobsIndexIdInOrFilter(ids)
    expect(filter).toContain('id.in.(id-0')
    expect(filter).toContain(',id.in.(id-100)')
  })
})

describe('mergePostgrestAndOrFilters', () => {
  it('returns null when every part is empty', () => {
    expect(mergePostgrestAndOrFilters(null, undefined, '')).toBeNull()
  })

  it('returns a single filter unchanged', () => {
    expect(mergePostgrestAndOrFilters('end_at.is.null,end_at.gte.x')).toBe(
      'end_at.is.null,end_at.gte.x',
    )
  })

  it('ands multiple or-groups so they are not overwritten', () => {
    expect(
      mergePostgrestAndOrFilters('id.in.(a)', 'end_at.is.null,end_at.gte.x'),
    ).toBe('and(or(id.in.(a)),or(end_at.is.null,end_at.gte.x))')
  })
})
