import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'
import { assumedCapacityHours, clippedHours, countWeekdays } from './dates'
import { filterLowMarginJobs } from './margin'
import {
  aggregateJobsByMonth,
  enumerateMonthKeys,
  jobMonthKeyInRange,
} from './monthlyJobs'
import type { JobProfitabilityRow } from '../types'

describe('csv', () => {
  it('escapes commas and quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
  })

  it('builds csv with headers', () => {
    const csv = toCsv(
      ['A', 'B'],
      [
        [1, 'x'],
        [2, 'y,z'],
      ],
    )
    expect(csv).toBe('A,B\n1,x\n2,"y,z"')
  })
})

describe('dates / utilization math', () => {
  it('counts weekdays inclusive', () => {
    // Mon 2026-03-02 to Fri 2026-03-06 = 5 weekdays
    expect(countWeekdays('2026-03-02', '2026-03-06')).toBe(5)
    // includes weekend span: Mon–Sun = 5
    expect(countWeekdays('2026-03-02', '2026-03-08')).toBe(5)
  })

  it('assumes 7.5h per weekday', () => {
    expect(assumedCapacityHours('2026-03-02', '2026-03-06')).toBe(37.5)
  })

  it('clips interval hours to range', () => {
    const day = (h: number) => Date.UTC(2026, 2, 2, h)
    // period 8–18, range 10–14 → 4h
    expect(clippedHours(day(8), day(18), day(10), day(14))).toBe(4)
    // no overlap
    expect(clippedHours(day(8), day(9), day(10), day(14))).toBe(0)
  })
})

function jobRow(
  partial: Partial<JobProfitabilityRow> &
    Pick<JobProfitabilityRow, 'job_id' | 'job_number' | 'title'>,
): JobProfitabilityRow {
  return {
    customer_id: null,
    customer_name: null,
    project_lead_name: 'Unassigned',
    start_at: null,
    end_at: null,
    status: null,
    income: 0,
    expenses: 0,
    profit: 0,
    margin_pct: null,
    money_item_count: 0,
    money_incomplete: false,
    ...partial,
  }
}

describe('filterLowMarginJobs', () => {
  const rows: Array<JobProfitabilityRow> = [
    jobRow({
      job_id: '1',
      job_number: '000001',
      title: 'A',
      income: 100,
      expenses: 120,
      profit: -20,
      margin_pct: -20,
    }),
    jobRow({
      job_id: '2',
      job_number: '000002',
      title: 'B',
      income: 100,
      expenses: 90,
      profit: 10,
      margin_pct: 10,
    }),
    jobRow({
      job_id: '3',
      job_number: '000003',
      title: 'C',
      income: 100,
      expenses: 50,
      profit: 50,
      margin_pct: 50,
    }),
    jobRow({
      job_id: '4',
      job_number: '000004',
      title: 'D',
    }),
  ]

  it('filters unprofitable when threshold is 0', () => {
    const out = filterLowMarginJobs(rows, 0)
    expect(out.map((r) => r.job_id)).toEqual(['1'])
  })

  it('filters by margin threshold and sorts ascending', () => {
    const out = filterLowMarginJobs(rows, 15)
    expect(out.map((r) => r.job_id)).toEqual(['1', '2'])
  })
})

describe('aggregateJobsByMonth', () => {
  it('enumerates inclusive months', () => {
    expect(enumerateMonthKeys('2026-01-15', '2026-03-02')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('clips jobs that start before the range into the first month', () => {
    expect(
      jobMonthKeyInRange(
        {
          start_at: '2025-11-01T10:00:00.000Z',
          end_at: '2026-02-01T10:00:00.000Z',
        },
        '2026-01-01',
        '2026-03-31',
      ),
    ).toBe('2026-01')
  })

  it('sums money and counts jobs per month, filling empty months', () => {
    const out = aggregateJobsByMonth(
      [
        jobRow({
          job_id: 'a',
          job_number: '1',
          title: 'Jan A',
          start_at: '2026-01-10T12:00:00.000Z',
          income: 100,
          expenses: 40,
          profit: 60,
        }),
        jobRow({
          job_id: 'b',
          job_number: '2',
          title: 'Jan B',
          start_at: '2026-01-20T12:00:00.000Z',
          income: 50,
          expenses: 10,
          profit: 40,
        }),
        jobRow({
          job_id: 'c',
          job_number: '3',
          title: 'Mar',
          start_at: '2026-03-05T12:00:00.000Z',
          income: 200,
          expenses: 80,
          profit: 120,
        }),
      ],
      '2026-01-01',
      '2026-03-31',
    )

    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({
      month_key: '2026-01',
      income: 150,
      expenses: 50,
      profit: 100,
      job_count: 2,
    })
    expect(out[1]).toMatchObject({
      month_key: '2026-02',
      income: 0,
      expenses: 0,
      profit: 0,
      job_count: 0,
    })
    expect(out[2]).toMatchObject({
      month_key: '2026-03',
      income: 200,
      expenses: 80,
      profit: 120,
      job_count: 1,
    })
  })

  it('skips undated jobs', () => {
    const out = aggregateJobsByMonth(
      [
        jobRow({
          job_id: 'x',
          job_number: '9',
          title: 'No dates',
          income: 10,
          expenses: 0,
          profit: 10,
        }),
      ],
      '2026-01-01',
      '2026-01-31',
    )
    expect(out[0]).toMatchObject({ job_count: 0, income: 0 })
  })
})
