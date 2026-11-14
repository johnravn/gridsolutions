import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'
import { assumedCapacityHours, clippedHours, countWeekdays } from './dates'
import { filterLowMarginJobs } from './margin'
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
