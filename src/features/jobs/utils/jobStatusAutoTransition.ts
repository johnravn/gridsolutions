import { supabase } from '@shared/api/supabase'
import type { JobStatus } from '../types'

export type JobStatusWindowRow = {
  id: string
  status: JobStatus
  start_at: string | null
  end_at: string | null
}

/**
 * If the job should move to the next status based on wall clock and start/end,
 * returns the transition to persist.
 *
 * Mirrors server `auto_update_jobs_to_in_progress`:
 * - confirmed → in_progress when now is inside [start_at, end_at]
 * - confirmed | in_progress → completed when now > end_at
 * - planned / requested are never auto-promoted
 */
export function getScheduledJobStatusTransition(
  job: JobStatusWindowRow,
): { jobId: string; newStatus: 'in_progress' | 'completed' } | null {
  if (!job.start_at || !job.end_at) return null
  if (['canceled', 'completed', 'invoiced', 'paid'].includes(job.status)) {
    return null
  }

  const now = Date.now()
  const startAt = new Date(job.start_at).getTime()
  const endAt = new Date(job.end_at).getTime()

  if (now > endAt) {
    if (job.status === 'in_progress' || job.status === 'confirmed') {
      return { jobId: job.id, newStatus: 'completed' }
    }
    return null
  }

  if (job.status === 'confirmed' && now >= startAt && now <= endAt) {
    return { jobId: job.id, newStatus: 'in_progress' }
  }

  return null
}

export async function persistJobStatusTransition(
  jobId: string,
  newStatus: 'in_progress' | 'completed',
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: newStatus })
    .eq('id', jobId)
  if (error) throw error
}
