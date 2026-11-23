import { MONTH_OPTIONS, compareMonthYear, reportingYearOptions } from './dates'
import type { MonthYear } from './dates'

export type PeriodGranularity = 'month' | 'year'

export function normalizeMonthYearRange(
  a: MonthYear,
  b: MonthYear,
): { from: MonthYear; to: MonthYear } {
  return compareMonthYear(a, b) <= 0 ? { from: a, to: b } : { from: b, to: a }
}

export function monthYearKey(value: MonthYear): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}`
}

export function formatMonthYear(value: MonthYear): string {
  const label =
    MONTH_OPTIONS.find((m) => m.value === value.month)?.label ??
    String(value.month)
  return `${label} ${value.year}`
}

/** Compact label for the period trigger button. */
export function formatPeriodLabel(
  from: MonthYear,
  to: MonthYear,
  granularity: PeriodGranularity,
): string {
  const { from: start, to: end } = normalizeMonthYearRange(from, to)
  if (granularity === 'year') {
    if (start.year === end.year) return String(start.year)
    return `${start.year} – ${end.year}`
  }
  if (compareMonthYear(start, end) === 0) return formatMonthYear(start)
  return `${formatMonthYear(start)} – ${formatMonthYear(end)}`
}

/** Years shown in the month grid / year grid (oldest → newest for reading). */
export function periodPickerYears(now = new Date()): Array<number> {
  return [...reportingYearOptions(now, 8, 1)].reverse()
}

export function isMonthInRange(
  value: MonthYear,
  from: MonthYear,
  to: MonthYear,
): boolean {
  const { from: start, to: end } = normalizeMonthYearRange(from, to)
  return (
    compareMonthYear(value, start) >= 0 && compareMonthYear(value, end) <= 0
  )
}

export function isYearInRange(
  year: number,
  from: MonthYear,
  to: MonthYear,
): boolean {
  const { from: start, to: end } = normalizeMonthYearRange(from, to)
  return year >= start.year && year <= end.year
}

/** Year-mode selection → full calendar years (Jan…Dec). */
export function yearRangeToMonthYears(
  a: number,
  b: number,
): { from: MonthYear; to: MonthYear } {
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  return {
    from: { year: start, month: 1 },
    to: { year: end, month: 12 },
  }
}
