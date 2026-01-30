export type RangeOption = 'month' | 'year' | 'last-year'

export type RangeInfo = {
  from: string
  to: string
  label: string
}

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
    const label = start.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
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
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  return months.map((label, index) => {
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
