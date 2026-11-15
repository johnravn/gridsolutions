export type RangeOption = 'month' | 'year' | 'last-year'

export type RangeInfo = {
  from: string
  to: string
  label: string
}

/** Format date for logging page: "3. aug 2026" */
export function formatLoggingDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.getDate()
  const month = LOGGING_MONTHS_ABBREV[d.getMonth()]
  const year = d.getFullYear()
  return `${day}. ${month} ${year}`
}

const LOGGING_MONTHS_ABBREV = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
]

export function getRange(
  range: RangeOption,
  selectedMonth?: string,
): RangeInfo {
  const now = new Date()
  const year = now.getFullYear()

  if (range === 'month') {
    const { month, year: selectedYear } = parseMonthInput(selectedMonth, now)
    const start = new Date(selectedYear, month, 1)
    const end = new Date(selectedYear, month + 1, 1)
    const label = `${LOGGING_MONTHS_ABBREV[month]} ${start.getFullYear()}`
    return { from: start.toISOString(), to: end.toISOString(), label }
  }

  if (range === 'last-year') {
    const start = new Date(year - 1, 0, 1)
    const end = new Date(year, 0, 1)
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      label: `${year - 1}`,
    }
  }

  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  return { from: start.toISOString(), to: end.toISOString(), label: `${year}` }
}

export function formatMonthInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getMonthOptions(year: number) {
  return LOGGING_MONTHS_ABBREV.map((label, index) => {
    const month = String(index + 1).padStart(2, '0')
    return {
      label,
      value: `${year}-${month}`,
      monthIndex: index,
    }
  })
}

function parseMonthInput(value: string | undefined, fallback: Date) {
  if (!value) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() }
  }
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() }
  }
  return { year, month: monthIndex }
}

/** Round "now" to the next hour boundary for a default 1-hour entry. */
export function getDefaultTimes() {
  const start = new Date()
  const minutes = start.getMinutes()
  start.setMinutes(0, 0, 0)
  if (minutes >= 30) {
    start.setHours(start.getHours() + 1)
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

export function getYearFromIso(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getFullYear()
}

export function getMonthKeyFromDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function toMonthKey(value: string) {
  const match = value.match(/^(\d{4}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 7)
  }
  return getMonthKeyFromDate(parsed)
}

export function isRangeOverlappingLockedPeriod({
  startAt,
  endAt,
  lockedMonthSet,
}: {
  startAt: string
  endAt: string
  lockedMonthSet: Set<string>
}) {
  if (!startAt || !endAt || lockedMonthSet.size === 0) return false
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false
  }
  if (end.getTime() < start.getTime()) return false

  const cursor = new Date(start)
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)
  const endMonth = new Date(end)
  endMonth.setDate(1)
  endMonth.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= endMonth.getTime()) {
    if (lockedMonthSet.has(getMonthKeyFromDate(cursor))) return true
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return false
}

export function shiftRangeToMonth({
  startAt,
  endAt,
  monthKey,
}: {
  startAt: string
  endAt: string
  monthKey: string
}) {
  if (!startAt || !endAt || !monthKey) return null
  if (toMonthKey(startAt) === monthKey) return null
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const nextDay = Math.min(start.getDate(), lastDay)

  const nextStart = new Date(start)
  nextStart.setFullYear(year, monthIndex, nextDay)
  const nextEnd = new Date(nextStart.getTime() + durationMs)
  return { startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() }
}

export function getEndFallback(startAt: string) {
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return startAt
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return end.toISOString()
}

export function buildLockedMonthSet(
  periods: Array<{ period_start: string; is_locked: boolean }>,
): Set<string> {
  const set = new Set<string>()
  for (const period of periods) {
    if (!period.is_locked) continue
    set.add(toMonthKey(period.period_start))
  }
  return set
}
