import { describe, expect, it } from 'vitest'
import {
  getJobWeekSpan,
  getThreeWeekBounds,
  jobOverlapsWeek,
  partitionJobsByWeekSpan,
  weekSpanGridColumn,
} from './weekJobSpan'

describe('weekJobSpan', () => {
  // Fixed Monday so week bounds are stable: 2026-07-13 is a Monday
  const now = new Date('2026-07-15T12:00:00.000Z')
  const weeks = getThreeWeekBounds(now)

  it('getThreeWeekBounds returns Mon–Sun for offsets 0–2', () => {
    expect(weeks).toHaveLength(3)
    expect(weeks[0]!.start.getDay()).toBe(1)
    expect(weeks[0]!.end.getDay()).toBe(0)
  })

  it('jobOverlapsWeek matches start/end intersection', () => {
    const week = weeks[0]!
    expect(
      jobOverlapsWeek(
        {
          start_at: week.start.toISOString(),
          end_at: week.end.toISOString(),
        },
        week.start,
        week.end,
      ),
    ).toBe(true)
    expect(
      jobOverlapsWeek(
        {
          start_at: weeks[2]!.start.toISOString(),
          end_at: weeks[2]!.end.toISOString(),
        },
        week.start,
        week.end,
      ),
    ).toBe(false)
  })

  it('getJobWeekSpan returns multiple weeks for long jobs', () => {
    const job = {
      start_at: weeks[0]!.start.toISOString(),
      end_at: weeks[1]!.end.toISOString(),
    }
    expect(getJobWeekSpan(job, weeks)).toEqual([0, 1])
  })

  it('partitionJobsByWeekSpan moves multi-week jobs to spanning band', () => {
    const spanningJob = {
      id: 'a',
      start_at: weeks[0]!.start.toISOString(),
      end_at: weeks[2]!.end.toISOString(),
    }
    const single = {
      id: 'b',
      start_at: weeks[0]!.start.toISOString(),
      end_at: weeks[0]!.end.toISOString(),
    }
    const { spanning, singleByWeek } = partitionJobsByWeekSpan(
      [[spanningJob, single], [spanningJob], [spanningJob]],
      weeks,
    )
    expect(spanning).toHaveLength(1)
    expect(spanning[0]!.job.id).toBe('a')
    expect(spanning[0]!.startWeek).toBe(0)
    expect(spanning[0]!.endWeek).toBe(2)
    expect(singleByWeek[0].map((j) => j.id)).toEqual(['b'])
    expect(singleByWeek[1]).toEqual([])
    expect(singleByWeek[2]).toEqual([])
  })

  it('weekSpanGridColumn maps to CSS grid lines', () => {
    expect(weekSpanGridColumn(0, 0)).toBe('1 / 2')
    expect(weekSpanGridColumn(0, 1)).toBe('1 / 3')
    expect(weekSpanGridColumn(0, 2)).toBe('1 / 4')
    expect(weekSpanGridColumn(1, 2)).toBe('2 / 4')
  })
})
