import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import { subscribeRealtimeChannelWithRetry } from './subscribeRealtimeChannelWithRetry'
import type { JobListRow, JobStatus } from '@features/jobs/types'
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined

const disableAppRealtime =
  import.meta.env.VITE_DISABLE_APP_REALTIME === 'true' ||
  import.meta.env.VITE_DISABLE_APP_REALTIME === '1'

/** Local stack: give Realtime a moment after boot / db reset; settle after removeChannel to avoid socket churn. */
function localRealtimeSubscribeOptions(): {
  initialDelayMs: number
  reconnectSettleMs: number
} {
  if (!supabaseUrl || !/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    return { initialDelayMs: 0, reconnectSettleMs: 0 }
  }
  return { initialDelayMs: 1_800, reconnectSettleMs: 450 }
}

type TpRow = { job_id?: string | null; company_id?: string | null }

function jobIdsFromTimePeriodPayload(
  payload: RealtimePostgresChangesPayload<TpRow>,
): Array<string> {
  const ids = new Set<string>()
  const n = payload.new as TpRow | null
  const o = payload.old as TpRow | null
  if (n?.job_id) ids.add(n.job_id)
  if (o?.job_id) ids.add(o.job_id)
  return [...ids]
}

function timePeriodIdFromReservedPayload(
  payload: RealtimePostgresChangesPayload<{ time_period_id?: string | null }>,
): string | null {
  const n = payload.new as { time_period_id?: string | null } | null
  const o = payload.old as { time_period_id?: string | null } | null
  return n?.time_period_id ?? o?.time_period_id ?? null
}

function patchJobsListRows(
  rows: Array<JobListRow>,
  jobId: string,
  patch: Partial<JobListRow>,
): Array<JobListRow> {
  return rows.map((r) => (r.id === jobId ? { ...r, ...patch } : r))
}

function realtimeRecordToJobListPatch(
  raw: Record<string, unknown> | null | undefined,
): Partial<JobListRow> | null {
  if (!raw) return null
  const patch: Partial<JobListRow> = {}
  if (typeof raw.status === 'string') patch.status = raw.status as JobStatus
  if (typeof raw.archived === 'boolean') patch.archived = raw.archived
  if (typeof raw.title === 'string') patch.title = raw.title
  if (raw.jobnr !== undefined && raw.jobnr !== null) {
    const n = typeof raw.jobnr === 'number' ? raw.jobnr : Number(raw.jobnr)
    if (!Number.isNaN(n)) patch.jobnr = n
  }
  if (typeof raw.start_at === 'string' || raw.start_at === null)
    patch.start_at = raw.start_at
  if (typeof raw.end_at === 'string' || raw.end_at === null)
    patch.end_at = raw.end_at
  if (
    typeof raw.customer_contact_id === 'string' ||
    raw.customer_contact_id === null
  )
    patch.customer_contact_id = raw.customer_contact_id
  return Object.keys(patch).length > 0 ? patch : null
}

type JobsIndexInfiniteCache = {
  pages: Array<{ rows: Array<JobListRow>; count: number; page: number }>
  pageParams: Array<number>
}

/** Merge jobs realtime payloads into cached Jobs page lists so badges update immediately. */
function patchJobsListCachesFromRealtime(
  qc: QueryClient,
  companyId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  const jobId =
    (payload.new as { id?: string } | null)?.id ??
    (payload.old as { id?: string } | null)?.id
  if (!jobId) return

  if (payload.eventType === 'DELETE') {
    qc.setQueriesData<Array<JobListRow>>(
      { queryKey: ['company', companyId, 'jobs-index'], exact: false },
      (old) => (old ? old.filter((r) => r.id !== jobId) : old),
    )
    qc.setQueriesData<{ rows: Array<JobListRow>; count: number }>(
      { queryKey: ['company', companyId, 'jobs-index-page'], exact: false },
      (old) => {
        if (!old) return old
        const rows = old.rows.filter((r) => r.id !== jobId)
        if (rows.length === old.rows.length) return old
        return {
          rows,
          count: Math.max(0, old.count - 1),
        }
      },
    )
    qc.setQueriesData<JobsIndexInfiniteCache>(
      { queryKey: ['company', companyId, 'jobs-index-infinite'], exact: false },
      (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => {
            const rows = page.rows.filter((r) => r.id !== jobId)
            if (rows.length === page.rows.length) return page
            return {
              ...page,
              rows,
              count: Math.max(0, page.count - 1),
            }
          }),
        }
      },
    )
    return
  }

  const patch = realtimeRecordToJobListPatch(
    payload.new as Record<string, unknown> | null,
  )
  if (!patch) return

  qc.setQueriesData<Array<JobListRow>>(
    { queryKey: ['company', companyId, 'jobs-index'], exact: false },
    (old) => {
      if (!old) return old
      return patchJobsListRows(old, jobId, patch)
    },
  )
  qc.setQueriesData<{ rows: Array<JobListRow>; count: number }>(
    { queryKey: ['company', companyId, 'jobs-index-page'], exact: false },
    (old) => {
      if (!old) return old
      return {
        ...old,
        rows: patchJobsListRows(old.rows, jobId, patch),
      }
    },
  )
  qc.setQueriesData<JobsIndexInfiniteCache>(
    { queryKey: ['company', companyId, 'jobs-index-infinite'], exact: false },
    (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          rows: patchJobsListRows(page.rows, jobId, patch),
        })),
      }
    },
  )
}

function invalidateScheduleQueries(
  qc: QueryClient,
  companyId: string,
  jobIds: Iterable<string>,
) {
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
  void qc.invalidateQueries({
    queryKey: ['conflicts', 'crew', companyId],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['conflicts', 'vehicle', companyId],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['conflicts', 'equipment', companyId],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['conflicts', 'job'],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['jobs', 'crew-role-ids', companyId],
    exact: false,
  })
  void qc.invalidateQueries({
    queryKey: ['home', companyId, 'company-jobs-week-bookings'],
    exact: false,
  })

  for (const jobId of jobIds) {
    void qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'time_periods'],
      exact: false,
    })
    void qc.invalidateQueries({ queryKey: ['jobs.crew', jobId], exact: false })
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

/**
 * Single Realtime channel for matters inbox + jobs + schedule (one WebSocket, one subscribe).
 * Avoids connection storms from three parallel hooks (worse under React Strict Mode).
 */
export function useCompanyAppRealtimeSync(
  userId: string | null,
  companyId: string | null,
  queryClient: QueryClient,
) {
  const pendingTpIdsRef = React.useRef<Set<string>>(new Set())
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const flushReservedBatch = React.useCallback(async () => {
    const company = companyId
    if (!company) return

    const ids = [...pendingTpIdsRef.current]
    pendingTpIdsRef.current.clear()
    if (ids.length === 0) return

    const { data, error } = await supabase
      .from('time_periods')
      .select('job_id, company_id')
      .in('id', ids)

    if (error) {
      console.error('[realtime] schedule flush lookup failed', error.message)
      invalidateScheduleQueries(queryClient, company, [])
      return
    }

    const rows = data
    const relevant = rows.filter((r) => r.company_id === company)
    if (rows.length > 0 && relevant.length === 0) return

    const jobIds = new Set<string>()
    for (const row of relevant) {
      if (row.job_id) jobIds.add(row.job_id)
    }
    invalidateScheduleQueries(queryClient, company, jobIds)
  }, [companyId, queryClient])

  const scheduleReservedFlush = React.useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void flushReservedBatch()
    }, 250)
  }, [flushReservedBatch])

  React.useEffect(() => {
    if (!userId || disableAppRealtime) return

    const invalidateMatters = () => {
      void queryClient.invalidateQueries({
        queryKey: ['matters'],
        exact: false,
      })
    }

    const onReservedEvent = (
      payload: RealtimePostgresChangesPayload<{
        time_period_id?: string | null
      }>,
    ) => {
      const tpId = timePeriodIdFromReservedPayload(payload)
      if (tpId) pendingTpIdsRef.current.add(tpId)
      scheduleReservedFlush()
    }

    const cid = companyId
    const { initialDelayMs, reconnectSettleMs } =
      localRealtimeSubscribeOptions()

    const unsubscribe = subscribeRealtimeChannelWithRetry(
      supabase,
      `app-data:${userId}:${cid ?? 'none'}`,
      (channel) => {
        let ch = channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'matter_recipients',
            filter: `user_id=eq.${userId}`,
          },
          invalidateMatters,
        )
        if (!cid) return ch
        ch = ch
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'matters',
              filter: `company_id=eq.${cid}`,
            },
            invalidateMatters,
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'jobs',
              filter: `company_id=eq.${cid}`,
            },
            (payload) => {
              patchJobsListCachesFromRealtime(queryClient, cid, payload)

              const newRow = payload.new as { id?: string } | null | undefined
              const oldRow = payload.old as { id?: string } | null | undefined
              const jobId = newRow?.id ? newRow.id : oldRow?.id

              void queryClient.invalidateQueries({
                queryKey: ['company', cid, 'jobs-index'],
                exact: false,
              })
              void queryClient.invalidateQueries({
                queryKey: ['company', cid, 'jobs-index-page'],
                exact: false,
              })
              void queryClient.invalidateQueries({
                queryKey: ['home', cid, 'jobs-ready-to-invoice'],
                exact: false,
              })
              void queryClient.invalidateQueries({
                queryKey: ['home', cid, 'company-jobs-week'],
                exact: false,
              })
              void queryClient.invalidateQueries({
                queryKey: ['home', cid, 'company-jobs-week-bookings'],
                exact: false,
              })
              void queryClient.invalidateQueries({
                queryKey: ['company', cid, 'calendar'],
                exact: false,
              })
              if (jobId) {
                void queryClient.invalidateQueries({
                  queryKey: ['company', cid, 'job-calendar', jobId],
                })
                void queryClient.invalidateQueries({
                  queryKey: ['jobs-detail', jobId],
                })
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'time_periods',
              filter: `company_id=eq.${cid}`,
            },
            (payload: RealtimePostgresChangesPayload<TpRow>) => {
              const row =
                (payload.new as TpRow | null) ?? (payload.old as TpRow | null)
              if (row?.company_id && row.company_id !== cid) return

              const jobIds = jobIdsFromTimePeriodPayload(payload)
              invalidateScheduleQueries(queryClient, cid, jobIds)
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reserved_crew' },
            onReservedEvent,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reserved_items' },
            onReservedEvent,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reserved_vehicles' },
            onReservedEvent,
          )
        return ch
      },
      {
        initialDelayMs,
        reconnectSettleMs,
        maxAttempts: 12,
        baseDelayMs: 900,
      },
    )

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      pendingTpIdsRef.current.clear()
      unsubscribe()
    }
  }, [userId, companyId, queryClient, scheduleReservedFlush])
}
