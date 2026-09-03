import { supabase } from '@shared/api/supabase'
import { fetchGroupLineageIds } from '@features/inventory/api/flattenGroupItems'

export type OverlapConflict = {
  jobId?: string | null
  jobTitle: string | null
  startAt: string
  endAt: string
  customerName?: string | null
  projectLeadName?: string | null
  itemName?: string | null
  itemId?: string | null
  quantity?: number
  sourceGroupId?: string | null
  sourceGroupName?: string | null
  sourceGroupQuantity?: number
}

export function dedupeOverlapConflicts(
  conflicts: Array<OverlapConflict>,
): Array<OverlapConflict> {
  const merged: Array<OverlapConflict> = []

  for (const conflict of conflicts) {
    const key = [
      conflict.sourceGroupId ?? '',
      conflict.itemId ?? conflict.itemName ?? '',
      conflict.jobId ?? conflict.jobTitle ?? '',
    ].join(':')
    const existing = merged.find((candidate) => {
      const candidateKey = [
        candidate.sourceGroupId ?? '',
        candidate.itemId ?? candidate.itemName ?? '',
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
  id?: string | null
  title: string | null
  customer: { name: string | null } | null
  project_lead: { display_name: string | null; email: string | null } | null
} | null

type TimePeriodJoin = {
  start_at: string
  end_at: string
  job_id?: string | null
  job: JobJoin
} | null

function conflictFromTimePeriod(tp: TimePeriodJoin): OverlapConflict | null {
  if (!tp?.start_at || !tp.end_at) return null
  const job = tp.job
  return {
    jobId: tp.job_id ?? job?.id ?? null,
    jobTitle: job?.title ?? null,
    startAt: tp.start_at,
    endAt: tp.end_at,
    customerName: job?.customer?.name ?? null,
    projectLeadName:
      job?.project_lead?.display_name ?? job?.project_lead?.email ?? null,
  }
}

export function personalEventOverlapConflict(event: {
  title: string
  start_at: string
  end_at: string
}): OverlapConflict {
  return {
    jobTitle: `Personal: ${event.title}`,
    startAt: event.start_at,
    endAt: event.end_at,
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
  excludePersonalEventId,
  skipForcedCrew,
}: {
  userIds: Array<string>
  startAt: string
  endAt: string
  excludePeriodId?: string
  excludePersonalEventId?: string
  skipForcedCrew?: boolean
}): Promise<Map<string, Array<OverlapConflict>>> {
  const result = new Map<string, Array<OverlapConflict>>()
  if (userIds.length === 0) return result

  const { data, error } = await supabase
    .from('reserved_crew')
    .select(
      `
      user_id,
      time_period_id,
      forced,
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
    if (skipForcedCrew && row.forced) continue
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

  let personalQ = supabase
    .from('personal_calendar_events')
    .select('id, user_id, title, start_at, end_at')
    .in('user_id', userIds)
    .lt('start_at', endAt)
    .gt('end_at', startAt)

  if (excludePersonalEventId) {
    personalQ = personalQ.neq('id', excludePersonalEventId)
  }

  const { data: personalRows, error: personalErr } = await personalQ
  if (personalErr) throw personalErr

  for (const row of personalRows ?? []) {
    if (!periodsOverlap(startAt, endAt, row.start_at, row.end_at)) continue
    const conflicts = result.get(row.user_id) ?? []
    conflicts.push(personalEventOverlapConflict(row))
    result.set(row.user_id, conflicts)
  }

  return result
}

export async function findVehicleOverlaps({
  vehicleId,
  startAt,
  endAt,
  excludeReservationId,
  excludeJobId,
}: {
  vehicleId: string
  startAt: string
  endAt: string
  excludeReservationId?: string
  /** Ignore bookings on this job (e.g. sync will replace them). */
  excludeJobId?: string
}): Promise<Array<OverlapConflict>> {
  const { data, error } = await supabase
    .from('reserved_vehicles')
    .select(
      `
      id,
      time_period:time_period_id (
        start_at,
        end_at,
        job_id,
        job:job_id (
          id,
          title,
          customer:customer_id ( name ),
          project_lead:profiles!jobs_project_lead_user_id_fkey ( display_name, email )
        )
      )
    `,
    )
    .eq('vehicle_id', vehicleId)

  if (error) throw error

  const conflicts: Array<OverlapConflict> = []
  for (const row of data ?? []) {
    if (excludeReservationId && row.id === excludeReservationId) continue
    const tp = row.time_period as TimePeriodJoin
    if (!tp?.start_at || !tp.end_at) continue
    const jobId = tp.job_id ?? tp.job?.id ?? null
    if (excludeJobId && jobId === excludeJobId) continue
    if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue
    const conflict = conflictFromTimePeriod(tp)
    if (conflict) conflicts.push(conflict)
  }

  return conflicts
}

export type GroupOverlapRow = {
  source_group_id: string | null
  item_id?: string | null
  quantity?: number | null
  time_period_id: string | null
  time_period: TimePeriodJoin
}

export function collectGroupOverlapConflicts({
  bookedGroupIds,
  lineageByGroupId,
  groupNameById,
  itemNameById,
  rows,
  startAt,
  endAt,
  excludePeriodId,
  excludeJobId,
}: {
  bookedGroupIds: Array<string>
  lineageByGroupId: Map<string, Array<string>>
  groupNameById: Map<string, string>
  itemNameById?: Map<string, string>
  rows: Array<GroupOverlapRow>
  startAt: string
  endAt: string
  excludePeriodId?: string
  excludeJobId?: string
}): Map<string, Array<OverlapConflict>> {
  const result = new Map<string, Array<OverlapConflict>>()

  for (const groupId of bookedGroupIds) {
    const related = new Set(lineageByGroupId.get(groupId) ?? [groupId])
    const groupName = groupNameById.get(groupId) ?? 'Group'
    const conflicts: Array<OverlapConflict> = []

    for (const row of rows) {
      if (!row.source_group_id || !related.has(row.source_group_id)) continue
      if (excludePeriodId && row.time_period_id === excludePeriodId) continue
      const tp = row.time_period
      if (!tp?.start_at || !tp.end_at) continue
      const jobId = tp.job_id ?? tp.job?.id ?? null
      if (excludeJobId && jobId === excludeJobId) continue
      if (!periodsOverlap(startAt, endAt, tp.start_at, tp.end_at)) continue
      const conflict = conflictFromTimePeriod(tp)
      if (!conflict) continue
      const itemId = row.item_id ?? null
      const itemName = itemId ? (itemNameById?.get(itemId) ?? 'Item') : null
      conflicts.push({
        ...conflict,
        itemId,
        itemName,
        quantity: row.quantity ?? conflict.quantity,
        sourceGroupId: groupId,
        sourceGroupName: groupName,
      })
    }

    if (conflicts.length > 0) {
      result.set(groupId, dedupeOverlapConflicts(conflicts))
    }
  }

  return result
}

export async function findGroupOverlaps({
  groupIds,
  startAt,
  endAt,
  excludePeriodId,
  excludeJobId,
}: {
  groupIds: Array<string>
  startAt: string
  endAt: string
  excludePeriodId?: string
  excludeJobId?: string
}): Promise<Map<string, Array<OverlapConflict>>> {
  const requestedIds = Array.from(new Set(groupIds.filter(Boolean)))
  if (requestedIds.length === 0) return new Map()

  const { data: groupRows, error: groupErr } = await supabase
    .from('item_groups')
    .select('id, name, unique')
    .in('id', requestedIds)

  if (groupErr) throw groupErr

  const groupNameById = new Map<string, string>()
  const exclusiveIds: Array<string> = []
  for (const row of groupRows ?? []) {
    if (!row.id) continue
    groupNameById.set(row.id, row.name?.trim() || 'Group')
    if (row.unique) exclusiveIds.push(row.id)
  }

  // Non-unique kits share stock via leaf items; exclusive overlap is unique groups only.
  if (exclusiveIds.length === 0) return new Map()

  const lineageByGroupId = await fetchGroupLineageIds(exclusiveIds)
  const relatedIds = new Set<string>()
  for (const groupId of exclusiveIds) {
    const lineage = lineageByGroupId.get(groupId) ?? [groupId]
    lineageByGroupId.set(groupId, lineage)
    for (const id of lineage) relatedIds.add(id)
  }

  let query = supabase
    .from('reserved_items')
    .select(
      `
      source_group_id,
      item_id,
      quantity,
      time_period_id,
      time_period:time_period_id!inner (
        start_at,
        end_at,
        job_id,
        job:job_id (
          id,
          title,
          customer:customer_id ( name ),
          project_lead:profiles!jobs_project_lead_user_id_fkey ( display_name, email )
        )
      )
    `,
    )
    .eq('source_kind', 'group')
    .in('source_group_id', Array.from(relatedIds))
    .lt('time_period.start_at', endAt)
    .gt('time_period.end_at', startAt)

  if (excludePeriodId) {
    query = query.neq('time_period_id', excludePeriodId)
  }

  const { data, error } = await query

  // reserved_items has no booking status — a row existing means it is booked.

  if (error) throw new Error(error.message)

  const itemIds = Array.from(
    new Set(
      ((data ?? []) as Array<GroupOverlapRow>)
        .map((row) => row.item_id)
        .filter((id): id is string => !!id),
    ),
  )
  const itemNameById = new Map<string, string>()
  if (itemIds.length > 0) {
    const { data: itemRows, error: itemErr } = await supabase
      .from('items')
      .select('id, name')
      .in('id', itemIds)
    if (itemErr) throw itemErr
    for (const row of itemRows ?? []) {
      if (!row.id) continue
      itemNameById.set(row.id, row.name?.trim() || 'Item')
    }
  }

  return collectGroupOverlapConflicts({
    bookedGroupIds: exclusiveIds,
    lineageByGroupId,
    groupNameById,
    itemNameById,
    rows: (data ?? []) as Array<GroupOverlapRow>,
    startAt,
    endAt,
    excludePeriodId,
    excludeJobId,
  })
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
