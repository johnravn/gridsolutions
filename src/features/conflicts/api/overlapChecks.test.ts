import { describe, expect, it } from 'vitest'
import {
  formatOverlapDuration,
  overlapHoursBetweenPeriods,
} from './overlapChecks'

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
