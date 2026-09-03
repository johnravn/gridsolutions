export function escapeForPostgrestOr(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** ILIKE patterns that treat spaces as optional and allow a single-letter typo. */
export function postgrestIlikePatterns(term: string): Array<string> {
  const safe = escapeForPostgrestOr(term)
  if (!safe) return []
  const compact = safe.replace(/\s+/g, '')
  const patterns = [`%${safe}%`]
  if (compact && compact !== safe) patterns.push(`%${compact}%`)
  if (compact.length > 2) {
    patterns.push(`%${compact.split('').join('%')}%`)
    for (let i = 0; i < compact.length; i++) {
      patterns.push(`%${compact.slice(0, i)}_${compact.slice(i + 1)}%`)
      const dropped = compact.slice(0, i) + compact.slice(i + 1)
      if (dropped.length > 2) {
        patterns.push(`%${dropped.split('').join('%')}%`)
      }
    }
  }
  return [...new Set(patterns)]
}

export const DEFAULT_CREW_HOURS_PER_DAY = 8

function localMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function isLocalMidnight(date: Date): boolean {
  return (
    date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
  )
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Hours billed per calendar day for hourly crew.
 *
 * Date-only windows (local midnight → midnight) return null so callers can
 * fall back to {@link DEFAULT_CREW_HOURS_PER_DAY} instead of 24.
 * Same-day windows use the actual duration. Multi-day windows with times use
 * the daily clock span from start time-of-day to end time-of-day.
 */
export function calculateHoursPerDay(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) return null

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  const diffMs = endDate.getTime() - startDate.getTime()
  if (diffMs <= 0) return null

  if (isLocalMidnight(startDate) && isLocalMidnight(endDate)) {
    return null
  }

  if (isSameLocalDay(startDate, endDate)) {
    return diffMs / (1000 * 60 * 60)
  }

  // Same clock time on different days is a date-only span (often UTC midnights),
  // not a 24-hour working day.
  if (localMinutesOfDay(startDate) === localMinutesOfDay(endDate)) {
    return null
  }

  let minutes = localMinutesOfDay(endDate) - localMinutesOfDay(startDate)
  if (minutes <= 0) minutes += 24 * 60
  return minutes / 60
}

/**
 * Resolve hours/day for hourly crew: keep a saved value unless it is the
 * legacy date-only 24h default, otherwise derive from the window or 8h.
 */
export function resolveHourlyHoursPerDay(
  start: string | null,
  end: string | null,
  storedHours?: number | null,
): number {
  const fromWindow = calculateHoursPerDay(start, end)
  if (
    storedHours != null &&
    Number.isFinite(storedHours) &&
    storedHours >= 0 &&
    !(storedHours === 24 && fromWindow == null)
  ) {
    return storedHours
  }
  return fromWindow ?? DEFAULT_CREW_HOURS_PER_DAY
}

// Helper function to format vehicle category for display
export function formatVehicleCategory(
  category:
    | 'passenger_car_small'
    | 'passenger_car_medium'
    | 'passenger_car_big'
    | 'van_small'
    | 'van_medium'
    | 'van_big'
    | 'C1'
    | 'C1E'
    | 'C'
    | 'CE'
    | null,
): string {
  if (!category) return '—'
  const map: Record<string, string> = {
    passenger_car_small: 'Passenger Car - Small',
    passenger_car_medium: 'Passenger Car - Medium',
    passenger_car_big: 'Passenger Car - Big',
    van_small: 'Van - Small',
    van_medium: 'Van - Medium',
    van_big: 'Van - Big',
    C1: 'C1',
    C1E: 'C1E',
    C: 'C',
    CE: 'CE',
  }
  return map[category] || category
}
