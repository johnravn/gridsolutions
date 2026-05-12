import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getScheduledJobStatusTransition,
  persistJobStatusTransition,
} from '../utils/jobStatusAutoTransition'
import type { JobListRow } from '../types'

const TICK_MS = 60_000

/**
 * Applies the same time-based status transitions as {@link useAutoUpdateJobStatus},
 * but for every job currently loaded in the jobs index list. Without this, the list
 * stays on e.g. "in progress" until the user opens the inspector (where the detail hook runs).
 */
export function useAutoUpdateJobsListJobStatuses(
  jobs: Array<JobListRow> | undefined,
  enabled: boolean,
) {
  const qc = useQueryClient()
  const tickInFlightRef = useRef(false)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const relevantKey = jobs
    ?.filter((j) => j.status === 'confirmed' || j.status === 'in_progress')
    .map((j) => `${j.id}:${j.status}:${j.start_at ?? ''}:${j.end_at ?? ''}`)
    .join('|')

  useEffect(() => {
    if (!enabled) return

    const runTick = async () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return
      }
      if (tickInFlightRef.current) return
      tickInFlightRef.current = true
      try {
        const list = jobsRef.current ?? []
        if (list.length === 0) return

        const transitions: Array<{
          jobId: string
          newStatus: 'in_progress' | 'completed'
        }> = []
        for (const row of list) {
          const t = getScheduledJobStatusTransition(row)
          if (t) transitions.push(t)
        }
        for (const { jobId, newStatus } of transitions) {
          try {
            await persistJobStatusTransition(jobId, newStatus)
          } catch (e) {
            console.error(
              '[jobs list] auto status transition failed',
              jobId,
              e instanceof Error ? e.message : e,
            )
          }
        }
        if (transitions.length > 0) {
          await qc.invalidateQueries({ queryKey: ['company'], exact: false })
        }
      } finally {
        tickInFlightRef.current = false
      }
    }

    void runTick()
    const id = window.setInterval(() => void runTick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [enabled, qc, relevantKey])
}
