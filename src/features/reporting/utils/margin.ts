import type { JobProfitabilityRow, MarginThreshold } from '../types'

/**
 * Filter jobs to those below the margin threshold.
 * threshold 0 means unprofitable (profit < 0).
 * Other thresholds mean margin_pct < threshold (jobs with null margin excluded).
 */
export function filterLowMarginJobs(
  rows: Array<JobProfitabilityRow>,
  threshold: MarginThreshold,
): Array<JobProfitabilityRow> {
  const filtered =
    threshold === 0
      ? rows.filter((r) => r.profit < 0)
      : rows.filter((r) => r.margin_pct != null && r.margin_pct < threshold)

  return [...filtered].sort((a, b) => (a.margin_pct ?? 0) - (b.margin_pct ?? 0))
}

export const MARGIN_THRESHOLDS: Array<{
  value: MarginThreshold
  label: string
}> = [
  { value: 0, label: 'Unprofitable' },
  { value: 10, label: '< 10%' },
  { value: 15, label: '< 15%' },
  { value: 25, label: '< 25%' },
]
