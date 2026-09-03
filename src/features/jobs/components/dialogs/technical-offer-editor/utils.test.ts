import { describe, expect, it } from 'vitest'
import {
  calculateHoursPerDay,
  countCompanyVehiclesByCategory,
  DEFAULT_CREW_HOURS_PER_DAY,
  postgrestIlikePatterns,
  resolveHourlyHoursPerDay,
} from './utils'

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString()
}

describe('postgrestIlikePatterns', () => {
  it('adds a compacted pattern so "1 ch" can match "1ch"', () => {
    expect(postgrestIlikePatterns('1 ch')).toEqual(
      expect.arrayContaining(['%1 ch%', '%1ch%', '%1%c%h%']),
    )
  })

  it('skips the compact duplicate when the term has no spaces', () => {
    expect(postgrestIlikePatterns('1ch')).toEqual(
      expect.arrayContaining(['%1ch%', '%1%c%h%']),
    )
  })

  it('adds a single-character wildcard so "share" can match "shure"', () => {
    const patterns = postgrestIlikePatterns('share')
    expect(patterns).toContain('%share%')
    expect(patterns).toContain('%sh_re%')
  })
})

describe('calculateHoursPerDay', () => {
  it('does not treat a date-only midnight span as 24 hours', () => {
    expect(
      calculateHoursPerDay(localIso(2026, 5, 1), localIso(2026, 5, 4)),
    ).toBeNull()
  })

  it('uses the actual duration on a single calendar day', () => {
    expect(
      calculateHoursPerDay(
        localIso(2026, 5, 1, 8, 0),
        localIso(2026, 5, 1, 16, 0),
      ),
    ).toBe(8)
  })

  it('uses start and end clock times as hours per day across multiple days', () => {
    expect(
      calculateHoursPerDay(
        localIso(2026, 5, 1, 8, 0),
        localIso(2026, 5, 3, 18, 0),
      ),
    ).toBe(10)
  })

  it('handles an overnight clock window', () => {
    expect(
      calculateHoursPerDay(
        localIso(2026, 5, 1, 22, 0),
        localIso(2026, 5, 2, 6, 0),
      ),
    ).toBe(8)
  })
})

describe('resolveHourlyHoursPerDay', () => {
  it('defaults date-only windows to 8 hours, not 24', () => {
    expect(
      resolveHourlyHoursPerDay(localIso(2026, 5, 1), localIso(2026, 5, 2)),
    ).toBe(DEFAULT_CREW_HOURS_PER_DAY)
  })

  it('keeps a saved hours value', () => {
    expect(
      resolveHourlyHoursPerDay(
        localIso(2026, 5, 1, 8),
        localIso(2026, 5, 1, 16),
        6,
      ),
    ).toBe(6)
  })

  it('ignores a legacy stored 24h value on a date-only window', () => {
    expect(
      resolveHourlyHoursPerDay(localIso(2026, 5, 1), localIso(2026, 5, 2), 24),
    ).toBe(DEFAULT_CREW_HOURS_PER_DAY)
  })
})

describe('countCompanyVehiclesByCategory', () => {
  it('counts company-owned vehicles per category and skips deleted/external', () => {
    expect(
      countCompanyVehiclesByCategory([
        { vehicle_category: 'van_medium', internally_owned: true },
        { vehicle_category: 'van_medium', internally_owned: true },
        { vehicle_category: 'van_big', internally_owned: true },
        { vehicle_category: 'van_medium', internally_owned: false },
        {
          vehicle_category: 'van_medium',
          internally_owned: true,
          deleted: true,
        },
        { vehicle_category: null, internally_owned: true },
      ]),
    ).toEqual({
      van_medium: 2,
      van_big: 1,
    })
  })
})
