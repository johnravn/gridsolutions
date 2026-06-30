export type PickerLocale = 'en' | 'nb'

const MONTH_NAMES: Record<PickerLocale, Array<string>> = {
  en: [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ],
  nb: [
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
  ],
}

/** Format a local calendar Date as YYYY-MM-DD (no timezone conversion). */
export function dateToLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Convert ISO string to local date string (YYYY-MM-DD). */
export function toLocalDate(iso: string): string {
  const d = new Date(iso)
  return dateToLocalDate(d)
}

/** Convert local datetime string (YYYY-MM-DDTHH:MM) to ISO string. */
export function fromLocalInput(local: string): string {
  if (!local) return ''
  return new Date(local).toISOString()
}

/** Parse ISO string; returns null for empty or invalid values. */
export function parseIso(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getMonthNames(locale: PickerLocale = 'en'): Array<string> {
  return MONTH_NAMES[locale]
}

/** Format date as "15. jun 2026". */
export function formatDateLabel(
  date: Date,
  locale: PickerLocale = 'en',
): string {
  const day = date.getDate()
  const month = getMonthNames(locale)[date.getMonth()]
  const year = date.getFullYear()
  return `${day}. ${month} ${year}`
}

/** Format time for display (e.g. "09:00", "09:30"). */
export function formatTimeLabel(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Format time for display at hour precision (e.g. "09:00"). */
export function formatHourLabel(hour: number): string {
  return formatTimeLabel(hour, 0)
}

/** Compact hour label for hour-picker grids (e.g. "08", "09"). */
export function formatHourGridLabel(hour: number): string {
  return String(hour).padStart(2, '0')
}

/** ISO at start of local day (00:00:00). */
export function startOfDay(localDate: string): string {
  return fromLocalInput(`${localDate}T00:00`)
}

/** ISO at end of local day (23:59:59.999). */
export function endOfDay(localDate: string): string {
  return fromLocalInput(`${localDate}T23:59:59.999`)
}

/** Compact minute label for minute-picker grids (e.g. "00", "05"). */
export function formatMinuteGridLabel(minute: number): string {
  return String(minute).padStart(2, '0')
}

/** ISO at specific local hour and minute. */
export function atTime(
  localDate: string,
  hour: number,
  minute: number,
): string {
  const h = String(hour).padStart(2, '0')
  const m = String(minute).padStart(2, '0')
  return fromLocalInput(`${localDate}T${h}:${m}`)
}

/** ISO at specific local hour (HH:00:00). */
export function atHour(localDate: string, hour: number): string {
  return atTime(localDate, hour, 0)
}

export function isSameLocalDate(a: Date, b: Date): boolean {
  return dateToLocalDate(a) === dateToLocalDate(b)
}

export function isToday(date: Date): boolean {
  return isSameLocalDate(date, new Date())
}

export function compareLocalDates(a: string, b: string): number {
  return a.localeCompare(b)
}

/** Swap if end is before start. */
export function normalizeDateRange(
  start: string,
  end: string,
): { start: string; end: string } {
  if (compareLocalDates(end, start) < 0) {
    return { start: end, end: start }
  }
  return { start, end }
}

export function isInvalidTimeRange(startAt: string, endAt: string): boolean {
  const startMs = parseIso(startAt)?.getTime()
  const endMs = parseIso(endAt)?.getTime()
  if (startMs == null || endMs == null) return false
  return endMs < startMs
}

/** True when ISO is at start of day with no specific hour chosen. */
export function isFullDayStart(iso: string): boolean {
  const d = parseIso(iso)
  if (!d) return false
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0
}

/** True when ISO is at end of day (23:59). */
export function isFullDayEnd(iso: string): boolean {
  const d = parseIso(iso)
  if (!d) return false
  return d.getHours() === 23 && d.getMinutes() === 59
}

export type CalendarDay = {
  day: number
  date: Date
  isCurrentMonth: boolean
}

export function buildCalendarDays(currentMonth: Date): Array<CalendarDay> {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const dayOfWeek = firstDay.getDay()
  const startPadding = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const daysInMonth = lastDay.getDate()

  const days: Array<CalendarDay> = []

  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startPadding - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i
    days.push({
      day,
      date: new Date(year, month - 1, day),
      isCurrentMonth: false,
    })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      day,
      date: new Date(year, month, day),
      isCurrentMonth: true,
    })
  }

  const remaining = 42 - days.length
  for (let day = 1; day <= remaining; day++) {
    days.push({
      day,
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
    })
  }

  return days
}

export function getInitialMonth(value: string): Date {
  const parsed = parseIso(value)
  if (parsed) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function buildYearRange(from = 1930, yearsAhead = 10): Array<number> {
  const currentYear = new Date().getFullYear()
  const years: Array<number> = []
  for (let y = from; y <= currentYear + yearsAhead; y++) {
    years.push(y)
  }
  return years
}

export type DateRangeSelection = {
  start: string | null
  end: string | null
}

/** Handle range date click: returns updated selection. */
export function handleRangeDateClick(
  current: DateRangeSelection,
  clickedLocalDate: string,
): DateRangeSelection {
  const { start, end } = current

  const hasMultiDayRange = start != null && end != null && start !== end

  if (!start || hasMultiDayRange) {
    return { start: clickedLocalDate, end: clickedLocalDate }
  }

  const effectiveEnd = end ?? start
  if (start === clickedLocalDate && effectiveEnd === clickedLocalDate) {
    return { start, end: effectiveEnd }
  }

  const normalized = normalizeDateRange(start, clickedLocalDate)
  return { start: normalized.start, end: normalized.end }
}

export type HourRangeSelection = {
  start: number | null
  end: number | null
}

/** Swap if end hour is before start hour. */
export function normalizeHourRange(
  start: number,
  end: number,
): { start: number; end: number } {
  if (end < start) {
    return { start: end, end: start }
  }
  return { start, end }
}

/** Handle range hour click: first sets start, second sets end (swaps if needed). */
export function handleRangeHourClick(
  current: HourRangeSelection,
  clickedHour: number,
): HourRangeSelection {
  const { start, end } = current

  if (start == null || (start != null && end != null)) {
    return { start: clickedHour, end: null }
  }

  const normalized = normalizeHourRange(start, clickedHour)
  return { start: normalized.start, end: normalized.end }
}

export function isHourInRange(
  hour: number,
  start: number | null,
  end: number | null,
): 'start' | 'end' | 'between' | false {
  if (start == null) return false
  if (hour === start) return 'start'
  if (end == null) return false
  if (hour === end) return 'end'
  if (hour > start && hour < end) return 'between'
  return false
}

export function isDateInRange(
  localDate: string,
  start: string | null,
  end: string | null,
): 'start' | 'end' | 'between' | false {
  if (!start) return false
  if (localDate === start) return 'start'
  if (!end) return false
  if (localDate === end) return 'end'
  if (
    compareLocalDates(localDate, start) > 0 &&
    compareLocalDates(localDate, end) < 0
  ) {
    return 'between'
  }
  return false
}

export function isMinuteInRange(
  minute: number,
  start: number | null,
  end: number | null,
): 'start' | 'end' | 'between' | false {
  if (start == null) return false
  if (minute === start) return 'start'
  if (end == null) return false
  if (minute === end) return 'end'
  if (minute > start && minute < end) return 'between'
  return false
}

export function buildMinuteOptions(step: number): Array<number> {
  const options: Array<number> = []
  for (let m = 0; m < 60; m += step) {
    options.push(m)
  }
  return options
}

export type RangeTimeSelection = {
  startHour: number | null
  endHour: number | null
  startMinute: number | null
  endMinute: number | null
}

export function buildRangeIso(
  startDate: string,
  endDate: string,
  times: RangeTimeSelection,
): { startAt: string; endAt: string } {
  const startAt =
    times.startHour != null
      ? atTime(startDate, times.startHour, times.startMinute ?? 0)
      : startOfDay(startDate)
  const endAt =
    times.endHour != null
      ? atTime(endDate, times.endHour, times.endMinute ?? 0)
      : endOfDay(endDate)
  return { startAt, endAt }
}

export function extractRangeTimes(
  startAt: string,
  endAt: string,
): RangeTimeSelection {
  const start = parseIso(startAt)
  const end = parseIso(endAt)
  const startHasTime = start && !isFullDayStart(startAt)
  const endHasTime = end && !isFullDayEnd(endAt)
  return {
    startHour: startHasTime ? start!.getHours() : null,
    endHour: endHasTime ? end!.getHours() : null,
    startMinute: startHasTime ? start!.getMinutes() : null,
    endMinute: endHasTime ? end!.getMinutes() : null,
  }
}
