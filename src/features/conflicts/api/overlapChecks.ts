import { supabase } from '@shared/api/supabase'

export type OverlapConflict = {
  jobId?: string | null
  jobTitle: string | null
  startAt: string
  endAt: string
  customerName?: string | null
  projectLeadName?: string | null
  itemName?: string | null
  quantity?: number
}

export function dedupeOverlapConflicts(
  conflicts: Array<OverlapConflict>,
): Array<OverlapConflict> {
  const merged: Array<OverlapConflict> = []

  for (const conflict of conflicts) {
    const key = [
      conflict.itemName ?? '',
      conflict.jobId ?? conflict.jobTitle ?? '',
    ].join(':')
    const existing = merged.find((candidate) => {
      const candidateKey = [
        candidate.itemName ?? '',
        candidate.jobId ?? candidate.jobTitle ?? '',
      ].join(':')
      return (
        candidateKey === key &&
        periodsOverlap(
          candidate.startAt,
          candidate.endAt,
          conflict.startAt,
          conflict.endAt,
        )
      )
    })

    if (existing) {
      if (conflict.startAt < existing.startAt)
        existing.startAt = conflict.startAt
      if (conflict.endAt > existing.endAt) existing.endAt = conflict.endAt
      if ((conflict.quantity ?? 0) > (existing.quantity ?? 0)) {
        existing.quantity = conflict.quantity
      }
      continue
    }

    merged.push({ ...conflict })
  }

  return merged
}

type JobJoin = {
  title: string | null
  customer: { name: string | null } | null
  project_lead: { display_name: string | null; email: string | null } | null
} | null

type TimePeriodJoin = {
  start_at: string
  end_at: string
  job: JobJoin
} | null

function conflictFromTimePeriod(tp: TimePeriodJoin): OverlapConflict | null {
  if (!tp?.start_at || !tp.end_at) return null
  const job = tp.job
  return {
    jobTitle: job?.title ?? null,
    startAt: tp.start_at,
    endAt: tp.end_at,
    customerName: job?.customer?.name ?? null,
    projectLeadName:
      job?.project_lead?.display_name ?? job?.project_lead?.email ?? null,
  }
}

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && end1 > start2
}

export function overlapHoursBetweenPeriods(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime())
  const end = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime())
  if (end <= start) return 0
  return (end - start) / (1000 * 60 * 60)
}

export function formatOverlapDuration(hours: number): string {
  if (hours <= 0) return 'No overlap'
  if (hours < 1) {
    const mins = Math.round(hours * 60)
    return `${mins} min overlap`
  }
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10
    return `${rounded} h overlap`
  }
  const days = Math.floor(hours / 24)
  const remaining = Math.round(hours % 24)
  if (remaining === 0) return `${days} d overlap`
  return `${days} d ${remaining} h overlap`
}

export async function findCrewOverlaps({
  userIds,
  startAt,
  endAt,
  excludePeriodId,
}: {
  userIds: Array<string>
  startAt: string
  endAt: string
  excludePeriodId?: string
}): Promise<Map<string, Array<OverlapConflict>>> {
  const result = new Map<string, Array<OverlapConflict>>()
  if (userIds.length === 0) return result

  const { data, error } = await supabase
    .from('reserved_crew')
    .select(
      `
      user_id,
      time_period_id,
      time_period:time_period_id (
        start_at,
        end_at,
        job:job_id (
          title,
          customer:customer_id ( name ),
          project_lead:profiles!jobs_project_lead_user_id_fkey ( display_name, email )
        )
      )
    `,
    )
    .in('user_id', userIds)
    .neq('status', 'canceled')

  if (error) throw error

  for (const row of data ?? []) {
    const userId = row.user_id
    if (!userId) continue
    const tp = row.time_period as TimePeriodJoin
    if (!tp?.start_at || !tp.end_at) continue
    if (excludePeriodId && row.time_period_id === excludePeriodId) continue
    if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue

    const conflict = conflictFromTimePeriod(tp)
    if (!conflict) continue

    const conflicts = result.get(userId) ?? []
    conflicts.push(conflict)
    result.set(userId, conflicts)
  }

  return result
}

export async function findVehicleOverlaps({
  vehicleId,
  startAt,
  endAt,
  excludeReservationId,
}: {
  vehicleId: string
  startAt: string
  endAt: string
  excludeReservationId?: string
}): Promise<Array<OverlapConflict>> {
  const { data, error } = await supabase
    .from('reserved_vehicles')
    .select(
      `
      id,
      time_period:time_period_id (
        start_at,
        end_at,
        job:job_id (
          title,
          customer:customer_id ( name ),
          project_lead:profiles!jobs_project_lead_user_id_fkey ( display_name, email )
        )
      )
    `,
    )
    .eq('vehicle_id', vehicleId)
    .neq('status', 'canceled')

  if (error) throw error

  const conflicts: Array<OverlapConflict> = []
  for (const row of data ?? []) {
    if (excludeReservationId && row.id === excludeReservationId) continue
    const tp = row.time_period as TimePeriodJoin
    if (!tp?.start_at || !tp.end_at) continue
    if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue
    const conflict = conflictFromTimePeriod(tp)
    if (conflict) conflicts.push(conflict)
  }

  return conflicts
}

export async function getTimePeriodWindow(
  timePeriodId: string,
): Promise<{ startAt: string; endAt: string } | null> {
  const { data, error } = await supabase
    .from('time_periods')
    .select('start_at, end_at')
    .eq('id', timePeriodId)
    .maybeSingle()

  if (error) throw error
  if (!data?.start_at || !data.end_at) return null
  return { startAt: data.start_at, endAt: data.end_at }
}
