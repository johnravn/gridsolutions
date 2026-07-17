import { addWeeks, endOfWeek, startOfWeek } from 'date-fns'
import type { CompanyJobsWeekOffset } from '../api/companyJobsWeekQuery'

export type WeekBounds = {
  offset: CompanyJobsWeekOffset
  start: Date
  end: Date
}

export function getThreeWeekBounds(now: Date = new Date()): Array<WeekBounds> {
  return ([0, 1, 2] as const).map((offset) => {
    const base = addWeeks(now, offset)
    return {
      offset,
      start: startOfWeek(base, { weekStartsOn: 1 }),
      end: endOfWeek(base, { weekStartsOn: 1 }),
    }
  })
}

/** Same overlap rule as companyJobsWeekQuery: start <= weekEnd AND (end null OR end >= weekStart) */
export function jobOverlapsWeek(
  job: { start_at: string | null; end_at: string | null },
  weekStart: Date,
  weekEnd: Date,
): boolean {
  if (!job.start_at) return false
  const start = new Date(job.start_at)
  if (start > weekEnd) return false
  if (job.end_at == null) return true
  return new Date(job.end_at) >= weekStart
}

export function getJobWeekSpan(
  job: { start_at: string | null; end_at: string | null },
  weeks: Array<WeekBounds> = getThreeWeekBounds(),
): Array<CompanyJobsWeekOffset> {
  return weeks
    .filter((w) => jobOverlapsWeek(job, w.start, w.end))
    .map((w) => w.offset)
}

export type SpanningJobPlacement<T extends { id: string }> = {
  job: T
  startWeek: CompanyJobsWeekOffset
  endWeek: CompanyJobsWeekOffset
}

/**
 * Split jobs into spanning (2+ weeks in window) and single-week lists per offset.
 * Spanning jobs are deduped by id.
 */
export function partitionJobsByWeekSpan<
  T extends { id: string; start_at: string | null; end_at: string | null },
>(
  jobsByWeek: [
    Array<T>, // week 0
    Array<T>, // week 1
    Array<T>, // week 2
  ],
  weeks: Array<WeekBounds> = getThreeWeekBounds(),
): {
  spanning: Array<SpanningJobPlacement<T>>
  singleByWeek: [Array<T>, Array<T>, Array<T>]
} {
  const byId = new Map<string, T>()
  for (const list of jobsByWeek) {
    for (const job of list) {
      if (!byId.has(job.id)) byId.set(job.id, job)
    }
  }

  const spanning: Array<SpanningJobPlacement<T>> = []
  const spanningIds = new Set<string>()

  for (const job of byId.values()) {
    const offsets = getJobWeekSpan(job, weeks)
    if (offsets.length >= 2) {
      const startWeek = offsets[0]
      const endWeek = offsets[offsets.length - 1]
      spanning.push({ job, startWeek, endWeek })
      spanningIds.add(job.id)
    }
  }

  spanning.sort((a, b) => {
    const aStart = a.job.start_at ?? ''
    const bStart = b.job.start_at ?? ''
    return aStart.localeCompare(bStart)
  })

  const singleByWeek: [Array<T>, Array<T>, Array<T>] = [
    jobsByWeek[0].filter((j) => !spanningIds.has(j.id)),
    jobsByWeek[1].filter((j) => !spanningIds.has(j.id)),
    jobsByWeek[2].filter((j) => !spanningIds.has(j.id)),
  ]

  return { spanning, singleByWeek }
}

/** CSS grid column line: week 0 → 1, week 1 → 2, week 2 → 3; end is exclusive so +2 */
export function weekSpanGridColumn(
  startWeek: CompanyJobsWeekOffset,
  endWeek: CompanyJobsWeekOffset,
): string {
  return `${startWeek + 1} / ${endWeek + 2}`
}
