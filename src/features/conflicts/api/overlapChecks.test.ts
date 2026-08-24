import { describe, expect, it } from 'vitest'
import {
  collectGroupOverlapConflicts,
  formatOverlapDuration,
  overlapHoursBetweenPeriods,
} from './overlapChecks'
import type { GroupOverlapRow } from './overlapChecks'

describe('overlapHoursBetweenPeriods', () => {
  it('returns overlap hours between two periods', () => {
    const hours = overlapHoursBetweenPeriods(
      '2026-01-01T08:00:00Z',
      '2026-01-01T18:00:00Z',
      '2026-01-01T12:00:00Z',
      '2026-01-01T20:00:00Z',
    )
    expect(hours).toBe(6)
  })

  it('returns 0 when periods do not overlap', () => {
    const hours = overlapHoursBetweenPeriods(
      '2026-01-01T08:00:00Z',
      '2026-01-01T10:00:00Z',
      '2026-01-01T12:00:00Z',
      '2026-01-01T14:00:00Z',
    )
    expect(hours).toBe(0)
  })
})

describe('formatOverlapDuration', () => {
  it('formats sub-hour overlap in minutes', () => {
    expect(formatOverlapDuration(0.5)).toBe('30 min overlap')
  })

  it('formats multi-day overlap', () => {
    expect(formatOverlapDuration(30)).toBe('1 d 6 h overlap')
  })
})

describe('collectGroupOverlapConflicts', () => {
  const startAt = '2026-01-01T08:00:00Z'
  const endAt = '2026-01-01T18:00:00Z'

  function overlapRow(
    overrides: Partial<GroupOverlapRow> = {},
  ): GroupOverlapRow {
    return {
      source_group_id: 'g1',
      time_period_id: 'p-other',
      time_period: {
        start_at: '2026-01-01T10:00:00Z',
        end_at: '2026-01-01T16:00:00Z',
        job_id: 'job-b',
        job: {
          id: 'job-b',
          title: 'Job B',
          customer: { name: 'Acme' },
          project_lead: { display_name: 'Pat', email: null },
        },
      },
      ...overrides,
    }
  }

  it('flags an overlapping booking of the same group', () => {
    const result = collectGroupOverlapConflicts({
      bookedGroupIds: ['g1'],
      lineageByGroupId: new Map([['g1', ['g1']]]),
      groupNameById: new Map([['g1', 'Kit']]),
      rows: [overlapRow()],
      startAt,
      endAt,
      excludePeriodId: 'p-self',
    })

    expect(result.get('g1')).toEqual([
      expect.objectContaining({
        itemName: 'Kit',
        jobTitle: 'Job B',
        jobId: 'job-b',
      }),
    ])
  })

  it('treats nested relatives as overlaps', () => {
    const result = collectGroupOverlapConflicts({
      bookedGroupIds: ['child'],
      lineageByGroupId: new Map([['child', ['parent', 'child']]]),
      groupNameById: new Map([['child', 'Child kit']]),
      rows: [overlapRow({ source_group_id: 'parent' })],
      startAt,
      endAt,
    })

    expect(result.get('child')?.[0]?.itemName).toBe('Child kit')
  })

  it('ignores sibling rows on the same time period', () => {
    const result = collectGroupOverlapConflicts({
      bookedGroupIds: ['g1'],
      lineageByGroupId: new Map([['g1', ['g1']]]),
      groupNameById: new Map([['g1', 'Kit']]),
      rows: [overlapRow({ time_period_id: 'p-self' })],
      startAt,
      endAt,
      excludePeriodId: 'p-self',
    })

    expect(result.size).toBe(0)
  })

  it('ignores rows on the excluded job', () => {
    const result = collectGroupOverlapConflicts({
      bookedGroupIds: ['g1'],
      lineageByGroupId: new Map([['g1', ['g1']]]),
      groupNameById: new Map([['g1', 'Kit']]),
      rows: [overlapRow()],
      startAt,
      endAt,
      excludeJobId: 'job-b',
    })

    expect(result.size).toBe(0)
  })

  it('ignores non-overlapping periods', () => {
    const result = collectGroupOverlapConflicts({
      bookedGroupIds: ['g1'],
      lineageByGroupId: new Map([['g1', ['g1']]]),
      groupNameById: new Map([['g1', 'Kit']]),
      rows: [overlapRow()],
      startAt: '2026-02-01T08:00:00Z',
      endAt: '2026-02-01T18:00:00Z',
    })

    expect(result.size).toBe(0)
  })
})
