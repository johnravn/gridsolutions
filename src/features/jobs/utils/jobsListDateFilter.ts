import {
  addWeeks,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import { dateToLocalDate } from '@shared/ui/components/pickers/dateTimeUtils'

export type JobsDatePreset =
  | 'all'
  | 'this_week'
  | 'next_2_weeks'
  | 'this_month'
  | 'upcoming'
  | 'past'
  | 'year'
  | 'custom'

export function jobsListYearRange(year: number): {
  dateFrom: string
  dateTo: string
} {
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  }
}

export function resolveJobsListYear(
  dateFrom: string,
  dateTo: string,
): number | null {
  const match = /^(\d{4})-01-01$/.exec(dateFrom.trim())
  if (!match) return null
  const year = Number(match[1])
  if (dateTo.trim() !== `${year}-12-31`) return null
  return year
}

export function jobsListDatePresetRange(
  preset: Exclude<JobsDatePreset, 'all' | 'custom' | 'year'>,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  if (preset === 'upcoming') {
    return { dateFrom: dateToLocalDate(now), dateTo: '' }
  }

  if (preset === 'past') {
    const yesterday = subDays(now, 1)
    return { dateFrom: '', dateTo: dateToLocalDate(yesterday) }
  }

  if (preset === 'this_week') {
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return { dateFrom: dateToLocalDate(start), dateTo: dateToLocalDate(end) }
  }

  if (preset === 'next_2_weeks') {
    const start = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 })
    const end = endOfWeek(addWeeks(now, 2), { weekStartsOn: 1 })
    return { dateFrom: dateToLocalDate(start), dateTo: dateToLocalDate(end) }
  }

  const start = startOfMonth(now)
  const end = endOfMonth(now)
  return { dateFrom: dateToLocalDate(start), dateTo: dateToLocalDate(end) }
}

export function resolveJobsDatePreset(
  dateFrom: string,
  dateTo: string,
  now: Date = new Date(),
): JobsDatePreset {
  if (!dateFrom && !dateTo) return 'all'

  if (resolveJobsListYear(dateFrom, dateTo) != null) return 'year'

  const presets: Array<Exclude<JobsDatePreset, 'all' | 'custom' | 'year'>> = [
    'this_week',
    'next_2_weeks',
    'this_month',
    'upcoming',
    'past',
  ]
  for (const preset of presets) {
    const range = jobsListDatePresetRange(preset, now)
    if (range.dateFrom === dateFrom && range.dateTo === dateTo) return preset
  }
  return 'custom'
}

/** Years offered in the Jobs When → Year picker (newest first). */
export function jobsListYearOptions(now: Date = new Date()): Array<number> {
  const current = now.getFullYear()
  const years: Array<number> = []
  for (let year = current + 1; year >= current - 20; year -= 1) {
    years.push(year)
  }
  return years
}
