import { describe, expect, it } from 'vitest'
import {
  atHour,
  atTime,
  buildCalendarDays,
  buildRangeIso,
  endOfDay,
  extractRangeTimes,
  formatDateLabel,
  handleRangeDateClick,
  handleRangeHourClick,
  isInvalidTimeRange,
  normalizeDateRange,
  parseIso,
  startOfDay,
  toLocalDate,
} from './dateTimeUtils'

describe('dateTimeUtils', () => {
  it('round-trips local date from ISO', () => {
    expect(toLocalDate('2026-06-15T14:35:00.000Z')).toBe('2026-06-15')
  })

  it('returns null for invalid ISO', () => {
    expect(parseIso('not-a-date')).toBeNull()
    expect(parseIso('')).toBeNull()
  })

  it('formats date labels per locale', () => {
    const d = new Date('2026-05-15T10:00:00.000Z')
    expect(formatDateLabel(d, 'en')).toBe('15. may 2026')
    expect(formatDateLabel(d, 'nb')).toBe('15. mai 2026')
  })

  it('builds start and end of day ISO strings', () => {
    expect(startOfDay('2026-06-15')).toBe(
      new Date('2026-06-15T00:00').toISOString(),
    )
    expect(endOfDay('2026-06-15')).toBe(
      new Date('2026-06-15T23:59:59.999').toISOString(),
    )
  })

  it('builds ISO at specific hour', () => {
    expect(atHour('2026-06-15', 9)).toBe(
      new Date('2026-06-15T09:00').toISOString(),
    )
  })

  it('swaps reversed date range', () => {
    expect(normalizeDateRange('2026-06-20', '2026-06-15')).toEqual({
      start: '2026-06-15',
      end: '2026-06-20',
    })
  })

  it('handles range date clicks', () => {
    expect(
      handleRangeDateClick({ start: null, end: null }, '2026-06-15'),
    ).toEqual({
      start: '2026-06-15',
      end: '2026-06-15',
    })
    expect(
      handleRangeDateClick(
        { start: '2026-06-15', end: '2026-06-15' },
        '2026-06-20',
      ),
    ).toEqual({
      start: '2026-06-15',
      end: '2026-06-20',
    })
    expect(
      handleRangeDateClick(
        { start: '2026-06-15', end: '2026-06-15' },
        '2026-06-10',
      ),
    ).toEqual({
      start: '2026-06-10',
      end: '2026-06-15',
    })
    expect(
      handleRangeDateClick(
        { start: '2026-06-15', end: '2026-06-20' },
        '2026-06-25',
      ),
    ).toEqual({
      start: '2026-06-25',
      end: '2026-06-25',
    })
  })

  it('builds range ISO with full-day defaults', () => {
    const result = buildRangeIso('2026-06-15', '2026-06-18', {
      startHour: null,
      endHour: null,
      startMinute: null,
      endMinute: null,
    })
    expect(result.startAt).toBe(startOfDay('2026-06-15'))
    expect(result.endAt).toBe(endOfDay('2026-06-18'))
  })

  it('builds range ISO with specific hours and minutes', () => {
    const result = buildRangeIso('2026-06-15', '2026-06-15', {
      startHour: 9,
      endHour: 17,
      startMinute: 15,
      endMinute: 45,
    })
    expect(result.startAt).toBe(atTime('2026-06-15', 9, 15))
    expect(result.endAt).toBe(atTime('2026-06-15', 17, 45))
  })

  it('extracts hour selections from ISO values', () => {
    expect(
      extractRangeTimes(atHour('2026-06-15', 9), atHour('2026-06-15', 17)),
    ).toEqual({
      startHour: 9,
      endHour: 17,
      startMinute: 0,
      endMinute: 0,
    })
    expect(
      extractRangeTimes(
        atTime('2026-06-15', 9, 30),
        atTime('2026-06-15', 17, 45),
      ),
    ).toEqual({
      startHour: 9,
      endHour: 17,
      startMinute: 30,
      endMinute: 45,
    })
    expect(
      extractRangeTimes(startOfDay('2026-06-15'), endOfDay('2026-06-15')),
    ).toEqual({
      startHour: null,
      endHour: null,
      startMinute: null,
      endMinute: null,
    })
  })

  it('detects invalid time ranges', () => {
    expect(
      isInvalidTimeRange(atHour('2026-06-15', 14), atHour('2026-06-15', 10)),
    ).toBe(true)
    expect(
      isInvalidTimeRange(atHour('2026-06-15', 9), atHour('2026-06-15', 17)),
    ).toBe(false)
  })

  it('handles range hour clicks with swap', () => {
    expect(handleRangeHourClick({ start: null, end: null }, 9)).toEqual({
      start: 9,
      end: null,
    })
    expect(handleRangeHourClick({ start: 9, end: null }, 17)).toEqual({
      start: 9,
      end: 17,
    })
    expect(handleRangeHourClick({ start: 14, end: null }, 9)).toEqual({
      start: 9,
      end: 14,
    })
    expect(handleRangeHourClick({ start: 9, end: 17 }, 12)).toEqual({
      start: 12,
      end: null,
    })
  })

  it('builds calendar padding from previous month length', () => {
    // May 2026 — April has 30 days; padding must not overflow into May 1
    const days = buildCalendarDays(new Date(2026, 4, 1))

    for (const { day, date } of days) {
      expect(date.getDate()).toBe(day)
    }

    const mayFirst = days.filter(
      (d) => d.date.getFullYear() === 2026 && d.date.getMonth() === 4 && d.date.getDate() === 1,
    )
    expect(mayFirst).toHaveLength(1)
    expect(mayFirst[0]?.isCurrentMonth).toBe(true)
    expect(mayFirst[0]?.day).toBe(1)

    const paddedDay31 = days.filter((d) => !d.isCurrentMonth && d.day === 31)
    expect(paddedDay31).toHaveLength(0)
  })
})
