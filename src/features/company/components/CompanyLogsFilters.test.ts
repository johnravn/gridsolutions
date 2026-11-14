import { describe, expect, it } from 'vitest'
import {
  activityTypesForCategory,
  dateRangeFromFilters,
  DEFAULT_LOGS_FILTERS,
} from './CompanyLogsFilters'

describe('CompanyLogsFilters helpers', () => {
  it('returns undefined types for All', () => {
    expect(activityTypesForCategory('All')).toBeUndefined()
  })

  it('returns job activity types for Jobs', () => {
    expect(activityTypesForCategory('Jobs')).toEqual([
      'job_created',
      'job_status_changed',
      'job_deleted',
    ])
  })

  it('builds custom date bounds', () => {
    const range = dateRangeFromFilters({
      ...DEFAULT_LOGS_FILTERS,
      datePreset: 'custom',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-14',
    })
    expect(range.from).toMatch(/^2026-11-01/)
    expect(range.to).toMatch(/^2026-11-14/)
  })

  it('returns null bounds for all time', () => {
    expect(dateRangeFromFilters(DEFAULT_LOGS_FILTERS)).toEqual({
      from: null,
      to: null,
    })
  })
})
