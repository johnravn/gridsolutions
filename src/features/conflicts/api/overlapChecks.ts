import { supabase } from '@shared/api/supabase'

export type OverlapConflict = {
  jobTitle: string | null
  startAt: string
  endAt: string
}

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && end1 > start2
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
        job:job_id ( title )
      )
    `,
    )
    .in('user_id', userIds)
    .neq('status', 'canceled')

  if (error) throw error

  for (const row of data ?? []) {
    const userId = row.user_id
    if (!userId) continue
    const tp = row.time_period as {
      start_at: string
      end_at: string
      job: { title: string | null } | null
    } | null
    if (!tp?.start_at || !tp.end_at) continue
    if (excludePeriodId && row.time_period_id === excludePeriodId) continue
    if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue

    const conflicts = result.get(userId) ?? []
    conflicts.push({
      jobTitle: tp.job?.title ?? null,
      startAt: tp.start_at,
      endAt: tp.end_at,
    })
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
        job:job_id ( title )
      )
    `,
    )
    .eq('vehicle_id', vehicleId)
    .neq('status', 'canceled')

  if (error) throw error

  const conflicts: Array<OverlapConflict> = []
  for (const row of data ?? []) {
    if (excludeReservationId && row.id === excludeReservationId) continue
    const tp = row.time_period as {
      start_at: string
      end_at: string
      job: { title: string | null } | null
    } | null
    if (!tp?.start_at || !tp.end_at) continue
    if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue
    conflicts.push({
      jobTitle: tp.job?.title ?? null,
      startAt: tp.start_at,
      endAt: tp.end_at,
    })
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
