/** Calendar month (1–12) + year for Reporting range pickers. */
export type MonthYear = {
  year: number
  month: number
}

export function currentMonthYear(now = new Date()): MonthYear {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function compareMonthYear(a: MonthYear, b: MonthYear): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Inclusive calendar range from the first day of `from` through the last day
 * of `to`. Order is normalized so the earlier month always starts the range.
 * Same month/year → that month only.
 */
export function dateRangeFromMonthYears(
  from: MonthYear,
  to: MonthYear,
): { fromDate: string; toDate: string } {
  const [start, end] = compareMonthYear(from, to) <= 0 ? [from, to] : [to, from]
  const fromDate = `${start.year}-${pad2(start.month)}-01`
  const lastDay = new Date(end.year, end.month, 0).getDate()
  const toDate = `${end.year}-${pad2(end.month)}-${pad2(lastDay)}`
  return { fromDate, toDate }
}

/** Month labels for Select (nb-NO short). */
export const MONTH_OPTIONS: Array<{ value: number; label: string }> =
  Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const label = new Date(2020, i, 1).toLocaleDateString('nb-NO', {
      month: 'short',
    })
    return { value: month, label }
  })

/** Years for Select: `past` years back through `future` years ahead. */
export function reportingYearOptions(
  now = new Date(),
  past = 8,
  future = 1,
): Array<number> {
  const current = now.getFullYear()
  const years: Array<number> = []
  for (let y = current + future; y >= current - past; y -= 1) {
    years.push(y)
  }
  return years
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
