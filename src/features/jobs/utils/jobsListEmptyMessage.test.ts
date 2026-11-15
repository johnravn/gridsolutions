import { describe, expect, it } from 'vitest'
import { jobsListEmptyMessage } from './jobsListEmptyMessage'

describe('jobsListEmptyMessage', () => {
  it('describes scoped series empties', () => {
    expect(jobsListEmptyMessage({ scoped: true, hasFilter: false })).toBe(
      'No jobs in this series',
    )
    expect(jobsListEmptyMessage({ scoped: true, hasFilter: true })).toBe(
      'No jobs match your filters',
    )
  })

  it('describes main list empties', () => {
    expect(jobsListEmptyMessage({ scoped: false, hasFilter: false })).toBe(
      'No jobs yet',
    )
    expect(jobsListEmptyMessage({ scoped: false, hasFilter: true })).toBe(
      'No jobs match your filters',
    )
  })
})
