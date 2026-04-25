import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
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
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
      if (updateError) throw updateError
    },
    onSuccess: async (_, { jobId }) => {
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      // Don't show toast for auto-updates to avoid spam
    },
    onError: (err: any) => {
      // Silent error - don't spam user with auto-update failures
      console.error('Auto-update job status failed:', err?.message)
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

      const now = new Date().getTime()
      const startAt = new Date(currentJob.start_at!).getTime()
      const endAt = new Date(currentJob.end_at!).getTime()

      // Only check if job is confirmed or in_progress
      if (currentJob.status === 'confirmed') {
        // If current time is within job duration, change to in_progress
        if (now >= startAt && now <= endAt) {
          if (!updateStatus.isPending) {
            updateStatus.mutate({
              jobId: currentJob.id,
              newStatus: 'in_progress',
            })
          }
        }
      } else if (currentJob.status === 'in_progress') {
        // If current time is after job duration, change to completed
        if (now > endAt) {
          if (!updateStatus.isPending) {
            updateStatus.mutate({
              jobId: currentJob.id,
              newStatus: 'completed',
            })
          }
        }
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
