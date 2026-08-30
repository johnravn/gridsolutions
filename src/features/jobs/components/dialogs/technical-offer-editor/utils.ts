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

  const hours = diffMs / (1000 * 60 * 60)
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  return hours / days
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
