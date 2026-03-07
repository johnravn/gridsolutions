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
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
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
