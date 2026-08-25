export type TimeInputMode = 'range' | 'hours'

export const MAX_LOGGED_HOURS = 24

export function parseHoursInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const hours = Number(normalized)
  if (!Number.isFinite(hours)) return null
  return hours
}

export function isValidLoggedHours(hours: number | null): hours is number {
  return hours != null && hours > 0 && hours <= MAX_LOGGED_HOURS
}

export function formatHoursInput(hours: number): string {
  if (!Number.isFinite(hours)) return ''
  const rounded = Math.round(hours * 100) / 100
  return String(rounded)
}

export function rangeToHours(startAt: string, endAt: string): number {
  if (!startAt || !endAt) return 0
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const hours = Math.max(0, end.getTime() - start.getTime()) / (1000 * 60 * 60)
  return Math.round(hours * 100) / 100
}

export function hoursToRange(
  dateIso: string,
  hours: number,
): { startAt: string; endAt: string } {
  const parsed = new Date(dateIso)
  if (Number.isNaN(parsed.getTime()) || !isValidLoggedHours(hours)) {
    return { startAt: dateIso, endAt: dateIso }
  }
  const start = new Date(parsed)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

export function looksLikeHoursOnlyEntry(startAt: string, endAt: string) {
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return false
  if (
    start.getHours() !== 0 ||
    start.getMinutes() !== 0 ||
    start.getSeconds() !== 0 ||
    start.getMilliseconds() !== 0
  ) {
    return false
  }
  return isValidLoggedHours(rangeToHours(startAt, endAt))
}

export function formatHoursBetween(startAt: string, endAt: string) {
  if (!startAt || !endAt) return '--'
  const hours = rangeToHours(startAt, endAt)
  return `${hours.toFixed(2)} hours`
}

export function hoursFromRangeOrDefault(startAt: string, endAt: string) {
  const hours = rangeToHours(startAt, endAt)
  if (hours > MAX_LOGGED_HOURS) return MAX_LOGGED_HOURS
  return isValidLoggedHours(hours) ? hours : 1
}
