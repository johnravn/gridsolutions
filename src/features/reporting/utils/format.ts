export function formatCurrency(value: number) {
  return new Intl.NumberFormat('no-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatPercent(value: number | null) {
  if (value == null) return '—'
  return `${value}%`
}

export function formatHours(value: number) {
  return `${value.toFixed(1)} h`
}

export function marginPct(income: number, profit: number): number | null {
  if (income <= 0) return null
  return Math.round((profit / income) * 10000) / 100
}

export function formatJobNumber(jobnr: number | null | undefined): string {
  if (jobnr == null) return '—'
  return String(jobnr).padStart(6, '0')
}
