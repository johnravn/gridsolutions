import type { Query, QueryClient } from '@tanstack/react-query'

/**
 * Invalidate schedule/booking caches for specific jobs after reserved_* /
 * time_periods realtime events.
 *
 * Intentionally does **not** invalidate company-wide `get_conflicts_*` keys or
 * every `conflicts/job` cache — those were the main post-save storms (Phase D).
 * Home conflict cards may stay warm until staleTime / remount; Bookings banner
 * uses per-job keys which are invalidated below.
 */
export function invalidateScheduleQueries(
  qc: QueryClient,
  companyId: string,
  jobIds: Iterable<string>,
) {
  const ids = [
    ...new Set(
      [...jobIds].filter((id): id is string => typeof id === 'string' && !!id),
    ),
  ]

  // Schedule surfaces (day/resource calendars) still need a refresh.
  void qc.invalidateQueries({
    queryKey: ['company', companyId, 'calendar'],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['company', companyId, 'vehicle-calendar'],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['company', companyId, 'vehicle-calendar-past'],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['company', companyId, 'item-calendar'],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['company', companyId, 'crew-calendar'],
    exact: false,
  })

  // Home week booking chips: only caches whose job-id list includes an affected job.
  if (ids.length > 0) {
    void qc.invalidateQueries({
      predicate: (query) =>
        homeWeekBookingsQueryTouchesJobs(query, companyId, ids),
    })
  }

  for (const jobId of ids) {
    void qc.invalidateQueries({
      queryKey: ['conflicts', 'job', jobId],
      exact: false,
    })
    void qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'time_periods'],
      exact: false,
    })
    void qc.invalidateQueries({ queryKey: ['jobs.crew', jobId], exact: false })
    void qc.invalidateQueries({
      queryKey: ['jobs.equipment', jobId],
      exact: false,
    })
    void qc.invalidateQueries({
      queryKey: ['jobs.transport', jobId],
      exact: false,
    })
    void qc.invalidateQueries({
      queryKey: ['company', companyId, 'job-calendar', jobId],
    })
    void qc.invalidateQueries({
      queryKey: ['jobs.packing', jobId],
      exact: false,
    })
    void qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'bookings-snapshot-for-offers'],
      exact: false,
    })
  }
}

/** Key shape: ['home', companyId, 'company-jobs-week-bookings', weekOffset, sortedIds] */
export function homeWeekBookingsQueryTouchesJobs(
  query: Query,
  companyId: string,
  jobIds: ReadonlyArray<string>,
): boolean {
  const key = query.queryKey
  if (
    key[0] !== 'home' ||
    key[1] !== companyId ||
    key[2] !== 'company-jobs-week-bookings'
  ) {
    return false
  }
  const sortedIds = key[4]
  if (typeof sortedIds !== 'string') return true
  if (sortedIds.length === 0) return false
  const set = new Set(sortedIds.split(',').filter(Boolean))
  return jobIds.some((id) => set.has(id))
}

/** True when a jobs realtime payload changed schedule-relevant date fields. */
export function jobsPayloadChangedScheduleDates(payload: {
  eventType?: string
  new?: Record<string, unknown> | null
  old?: Record<string, unknown> | null
}): boolean {
  if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
    return true
  }
  const n = payload.new
  const o = payload.old
  if (!n || !o) return true
  return n.start_at !== o.start_at || n.end_at !== o.end_at
}
