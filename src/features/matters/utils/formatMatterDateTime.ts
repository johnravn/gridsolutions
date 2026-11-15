const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

/** e.g. "3. december 2025" */
export function formatMatterDate(dateString: string): string {
  const d = new Date(dateString)
  const day = d.getDate()
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()
  return `${day}. ${month} ${year}`
}

/** e.g. "14:50" */
export function formatMatterTime(dateString: string): string {
  const d = new Date(dateString)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/** e.g. "8hrs 25m" */
export function formatMatterDuration(
  startDate: string,
  endDate: string,
): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  const totalMinutes = Math.round(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}hrs ${minutes}m`
  }
  if (hours > 0) {
    return `${hours}hrs`
  }
  return `${minutes}m`
}
