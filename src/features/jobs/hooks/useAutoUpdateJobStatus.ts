import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getScheduledJobStatusTransition,
  persistJobStatusTransition,
} from '../utils/jobStatusAutoTransition'
import type { JobDetail } from '../types'

/**
 * Hook to automatically update job status based on timeframes:
 * - If current time is within job duration and status is "confirmed" → change to "in_progress"
 * - If current time is after job duration and status is "in_progress" → change to "completed"
 */
export function useAutoUpdateJobStatus(job: JobDetail | null | undefined) {
  const qc = useQueryClient()
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateStatus = useMutation({
    mutationFn: async ({
      jobId,
      newStatus,
    }: {
      jobId: string
      newStatus: 'in_progress' | 'completed'
    }) => {
      await persistJobStatusTransition(jobId, newStatus)
    },
    onSuccess: async (_, { jobId }) => {
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      await qc.invalidateQueries({ queryKey: ['company'], exact: false })
      // Don't show toast for auto-updates to avoid spam
    },
    onError: (err: unknown) => {
      // Silent error - don't spam user with auto-update failures
      console.error(
        'Auto-update job status failed:',
        err instanceof Error ? err.message : err,
      )
    },
  })

  useEffect(() => {
    if (!job || !job.start_at || !job.end_at) {
      return
    }

    // Skip if job is canceled, completed, invoiced, or paid (terminal states)
    if (['canceled', 'completed', 'invoiced', 'paid'].includes(job.status)) {
      return
    }

    const checkAndUpdate = () => {
      // Avoid background writes when the tab is not visible.
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return
      }

      // Re-check job data from query cache to get latest status
      const cachedJob = qc.getQueryData<JobDetail>(['jobs-detail', job.id])
      const currentJob = cachedJob || job

      // Skip if status changed to terminal state since last check
      if (
        ['canceled', 'completed', 'invoiced', 'paid'].includes(
          currentJob.status,
        )
      ) {
        return
      }

      const transition = getScheduledJobStatusTransition({
        id: currentJob.id,
        status: currentJob.status,
        start_at: currentJob.start_at,
        end_at: currentJob.end_at,
      })
      if (!transition) return

      if (!updateStatus.isPending) {
        updateStatus.mutate(transition)
      }
    }

    // Check immediately
    checkAndUpdate()

    // Check every minute (60000ms)
    updateIntervalRef.current = setInterval(checkAndUpdate, 60000)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [job?.id, job?.status, job?.start_at, job?.end_at, qc, updateStatus])
}
