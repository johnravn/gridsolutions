/** YYYY-MM-DD in local time (avoids UTC date shift from `toISOString().slice(0, 10)`). */
export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add whole calendar days in local time (stable across DST vs raw millisecond math). */
export function addLocalCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/**
 * Adds 3 hours to a datetime ISO string and returns a new ISO string.
 * Used as a Program-tab default end-time offset — keep callers intentional.
 */
export function addThreeHours(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  date.setHours(date.getHours() + 3)
  return date.toISOString()
}
