import { describe, expect, it } from 'vitest'
import {
  filterProgramPeriods,
  formatProgramDateTime,
  formatProgramDuration,
  formatProgramTime,
  groupProgramPeriods,
  mapProgramPeriodsToTimelineItems,
  sortProgramPeriods,
} from './programTimeline'
import type { TimePeriodLite } from '../types'

const periods: Array<TimePeriodLite> = [
  {
    id: '1',
    job_id: 'job-1',
    company_id: 'co-1',
    title: 'Job duration',
    start_at: '2026-07-01T08:00:00.000Z',
    end_at: '2026-07-01T20:00:00.000Z',
    category: 'program',
  },
  {
    id: '2',
    job_id: 'job-1',
    company_id: 'co-1',
    title: 'Load In',
    start_at: '2026-07-01T09:00:00.000Z',
    end_at: '2026-07-01T11:00:00.000Z',
    category: 'program',
    program_group: 'Day 1',
  },
  {
    id: '3',
    job_id: 'job-1',
    company_id: 'co-1',
    title: 'Soundcheck',
    start_at: '2026-07-01T12:00:00.000Z',
    end_at: '2026-07-01T13:30:00.000Z',
    category: 'crew',
  },
]

describe('programTimeline', () => {
  it('filters out job duration and non-program periods', () => {
    expect(filterProgramPeriods(periods)).toHaveLength(1)
    expect(filterProgramPeriods(periods)[0]?.title).toBe('Load In')
  })

  it('sorts periods by start time', () => {
    const shuffled = [periods[2]!, periods[1]!]
    expect(sortProgramPeriods(shuffled).map((p) => p.title)).toEqual([
      'Load In',
      'Soundcheck',
    ])
  })

  it('maps program periods to immutable timeline block items', () => {
    const items = mapProgramPeriodsToTimelineItems(
      'block-1',
      periods,
      () => 'item-1',
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      block_id: 'block-1',
      label: 'Load In',
      summary: 'Day 1',
      start_at: '2026-07-01T09:00:00.000Z',
      end_at: '2026-07-01T11:00:00.000Z',
      sort_order: 0,
    })
  })

  it('formats duration text', () => {
    expect(
      formatProgramDuration(
        '2026-07-01T09:00:00.000Z',
        '2026-07-01T11:00:00.000Z',
      ),
    ).toBe('2h')
    expect(
      formatProgramDuration(
        '2026-07-01T09:00:00.000Z',
        '2026-07-01T09:45:00.000Z',
      ),
    ).toBe('45m')
    expect(
      formatProgramDuration(
        '2026-07-01T09:00:00.000Z',
        '2026-07-01T10:30:00.000Z',
      ),
    ).toBe('1h 30m')
  })

  it('groups periods by program_group', () => {
    const programOnly = filterProgramPeriods(periods)
    const grouped = groupProgramPeriods(programOnly)
    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.[0]).toBe('Day 1')
    expect(grouped[0]?.[1]).toHaveLength(1)
  })

  it('formats program time and datetime labels', () => {
    expect(formatProgramTime('2026-07-01T09:05:00.000Z')).toMatch(
      /^\d{2}:\d{2}$/,
    )
    expect(formatProgramDateTime('2026-07-01T09:05:00.000Z')).toContain('juli')
  })
})
