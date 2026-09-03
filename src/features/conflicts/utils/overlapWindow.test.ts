import { describe, expect, it } from 'vitest'
import {
  formatOverlapDuration,
  overlapWindow,
  periodWindow,
} from './overlapWindow'

describe('overlapWindow', () => {
  it('returns the intersecting hours of two periods', () => {
    const overlap = overlapWindow(
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T18:00:00.000Z',
      '2026-01-01T10:00:00.000Z',
      '2026-01-01T20:00:00.000Z',
    )
    expect(overlap).not.toBeNull()
    expect(overlap?.start.toISOString()).toBe('2026-01-01T10:00:00.000Z')
    expect(overlap?.end.toISOString()).toBe('2026-01-01T18:00:00.000Z')
    expect(overlap?.durationMs).toBe(8 * 60 * 60 * 1000)
  })

  it('returns null when periods do not overlap', () => {
    expect(
      overlapWindow(
        '2026-01-01T08:00:00.000Z',
        '2026-01-01T10:00:00.000Z',
        '2026-01-01T12:00:00.000Z',
        '2026-01-01T14:00:00.000Z',
      ),
    ).toBeNull()
  })
})

describe('periodWindow', () => {
  it('returns the full window for an equipment over-capacity span', () => {
    const window = periodWindow(
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T12:30:00.000Z',
    )
    expect(window?.durationMs).toBe(4.5 * 60 * 60 * 1000)
  })
})

describe('formatOverlapDuration', () => {
  it('formats whole hours, fractional hours, and minutes', () => {
    expect(formatOverlapDuration(2 * 60 * 60 * 1000)).toBe('2 hours')
    expect(formatOverlapDuration(60 * 60 * 1000)).toBe('1 hour')
    expect(formatOverlapDuration(2.5 * 60 * 60 * 1000)).toBe('2.5 hours')
    expect(formatOverlapDuration(45 * 60 * 1000)).toBe('45 minutes')
  })
})
