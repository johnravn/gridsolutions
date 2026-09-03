import {
  endOfDay,
  startOfDay,
} from '@shared/ui/components/pickers/dateTimeUtils'

export type JobsIndexDateOverlap =
  | { kind: 'none' }
  | { kind: 'bounded'; rangeStart: string; rangeEnd: string }
  | { kind: 'upcoming'; rangeStart: string }
  | { kind: 'past'; rangeEnd: string }

/**
 * Jobs list date filter: overlap the selected local-day range.
 * Upcoming is open-ended from the start of `dateFrom`.
 * Past is open-ended through the end of `dateTo` (no lower bound).
 */
export function jobsIndexDateOverlapFilters(overlap: JobsIndexDateOverlap): {
  notNullStart: boolean
  startAtLte: string | null
  endAtOrFilter: string | null
} {
  if (overlap.kind === 'none') {
    return { notNullStart: false, startAtLte: null, endAtOrFilter: null }
  }
  if (overlap.kind === 'upcoming') {
    return {
      notNullStart: true,
      startAtLte: null,
      endAtOrFilter: `end_at.is.null,end_at.gte.${overlap.rangeStart}`,
    }
  }
  if (overlap.kind === 'past') {
    return {
      notNullStart: true,
      startAtLte: overlap.rangeEnd,
      endAtOrFilter: null,
    }
  }
  return {
    notNullStart: true,
    startAtLte: overlap.rangeEnd,
    endAtOrFilter: `end_at.is.null,end_at.gte.${overlap.rangeStart}`,
  }
}

export function resolveJobsIndexDateOverlap(
  dateFrom?: string,
  dateTo?: string,
): JobsIndexDateOverlap {
  const from = dateFrom?.trim() ?? ''
  const to = dateTo?.trim() ?? ''
  if (!from && !to) return { kind: 'none' }
  if (from && !to) {
    return { kind: 'upcoming', rangeStart: startOfDay(from) }
  }
  if (!from && to) {
    return { kind: 'past', rangeEnd: endOfDay(to) }
  }
  if (from && to) {
    return {
      kind: 'bounded',
      rangeStart: startOfDay(from),
      rangeEnd: endOfDay(to),
    }
  }
  return { kind: 'none' }
}

/** Whether a job overlaps the resolved date filter (for tests and docs). */
export function jobOverlapsDateFilter(
  job: { start_at: string | null; end_at: string | null },
  overlap: JobsIndexDateOverlap,
): boolean {
  if (overlap.kind === 'none') return true
  if (!job.start_at) return false
  const start = new Date(job.start_at).getTime()
  if (Number.isNaN(start)) return false
  const end = job.end_at ? new Date(job.end_at).getTime() : null
  const endMs = end != null && !Number.isNaN(end) ? end : null

  if (overlap.kind === 'upcoming') {
    const from = new Date(overlap.rangeStart).getTime()
    if (endMs == null) return true
    return endMs >= from
  }

  if (overlap.kind === 'past') {
    const rangeEnd = new Date(overlap.rangeEnd).getTime()
    return start <= rangeEnd
  }

  const rangeStart = new Date(overlap.rangeStart).getTime()
  const rangeEnd = new Date(overlap.rangeEnd).getTime()
  if (start > rangeEnd) return false
  if (endMs == null) return true
  return endMs >= rangeStart
}
