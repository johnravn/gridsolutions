export const DATE_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: -1 },
] as const

export type DateRangeIndex = 0 | 1 | 2 | 3

export function dateRangeFromIndex(rangeIndex: number): {
  fromDate: string
  toDate: string
} {
  const to = new Date()
  const days = DATE_RANGES[rangeIndex]?.days ?? 30
  const from = new Date(to)
  if (days === -1) {
    from.setMonth(0, 1)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(from.getDate() - days)
  }
  to.setHours(23, 59, 59, 999)
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  }
}

export function rangeBounds(fromDate: string, toDate: string) {
  const from = new Date(fromDate)
  from.setHours(0, 0, 0, 0)
  const to = new Date(toDate)
  to.setHours(23, 59, 59, 999)
  return { from, to, fromISO: from.toISOString(), toISO: to.toISOString() }
}

/** Count weekdays (Mon–Fri) inclusive between two calendar dates. */
export function countWeekdays(fromDate: string, toDate: string): number {
  const { from, to } = rangeBounds(fromDate, toDate)
  let count = 0
  const cur = new Date(from)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(to)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count += 1
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export const HOURS_PER_WEEKDAY = 7.5

export function assumedCapacityHours(fromDate: string, toDate: string): number {
  return countWeekdays(fromDate, toDate) * HOURS_PER_WEEKDAY
}

/** Clip [start, end] interval to [rangeStart, rangeEnd], return hours. */
export function clippedHours(
  startMs: number,
  endMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
): number {
  const clippedStart = Math.max(startMs, rangeStartMs)
  const clippedEnd = Math.min(endMs, rangeEndMs)
  if (clippedEnd <= clippedStart) return 0
  return (clippedEnd - clippedStart) / (1000 * 60 * 60)
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelFromKey(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1)
  return date.toLocaleDateString('nb-NO', {
    month: 'short',
    year: 'numeric',
  })
}
