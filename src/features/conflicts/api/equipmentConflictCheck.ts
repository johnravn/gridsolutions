import { supabase } from '@shared/api/supabase'
import {
  
  dedupeOverlapConflicts
} from '@features/conflicts/api/overlapChecks'
import type {OverlapConflict} from '@features/conflicts/api/overlapChecks';
import type { OfferDetail } from '@features/jobs/types'

export type EquipmentConflictPreview = {
  summaryLines: Array<string>
  conflicts: Array<OverlapConflict>
}

type OfferItemQuantityInput = {
  groups: OfferDetail['groups']
}

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && start2 < end1
}

export async function buildOfferItemQuantityMap(
  offer: OfferItemQuantityInput,
): Promise<Map<string, number>> {
  const itemQuantityMap = new Map<string, number>()
  const groupIds = new Set<string>()
  const groupEntries: Array<{ group_id: string; quantity: number }> = []

  for (const group of offer.groups ?? []) {
    for (const item of group.items) {
      if (item.group_id) {
        groupIds.add(item.group_id)
        groupEntries.push({ group_id: item.group_id, quantity: item.quantity })
        continue
      }
      if (item.item_id) {
        const current = itemQuantityMap.get(item.item_id) ?? 0
        itemQuantityMap.set(item.item_id, current + item.quantity)
      }
    }
  }

  if (groupIds.size === 0) return itemQuantityMap

  const { data: groupItems, error: groupItemsError } = await supabase
    .from('group_items')
    .select('group_id, item_id, quantity')
    .in('group_id', Array.from(groupIds))

  if (groupItemsError) throw groupItemsError

  const groupItemsMap = new Map<
    string,
    Array<{ item_id: string; quantity: number }>
  >()
  for (const row of groupItems ?? []) {
    if (!row.item_id) continue
    const list = groupItemsMap.get(row.group_id) ?? []
    list.push({
      item_id: row.item_id,
      quantity: row.quantity ?? 1,
    })
    groupItemsMap.set(row.group_id, list)
  }

  for (const entry of groupEntries) {
    const members = groupItemsMap.get(entry.group_id) ?? []
    for (const member of members) {
      const current = itemQuantityMap.get(member.item_id) ?? 0
      itemQuantityMap.set(
        member.item_id,
        current + member.quantity * entry.quantity,
      )
    }
  }

  return itemQuantityMap
}

export async function getEquipmentConflictsForOfferBooking({
  offer,
  companyId,
  jobId,
  startAt,
  endAt,
}: {
  offer: OfferDetail
  companyId: string
  jobId: string
  startAt: string
  endAt: string
}): Promise<EquipmentConflictPreview> {
  const itemQuantityMap = await buildOfferItemQuantityMap(offer)
  if (itemQuantityMap.size === 0) {
    return { summaryLines: [], conflicts: [] }
  }

  const allItemIds = Array.from(itemQuantityMap.keys())
  const { data: inventoryRows, error: inventoryErr } = await supabase
    .from('inventory_index')
    .select('id, name, on_hand')
    .eq('company_id', companyId)
    .eq('is_group', false)
    .in('id', allItemIds)

  if (inventoryErr) throw inventoryErr

  const itemNameMap = new Map<string, string>()
  const itemOnHandMap = new Map<string, number>()
  for (const row of inventoryRows ?? []) {
    if (!row.id) continue
    itemNameMap.set(row.id, row.name || 'Item')
    itemOnHandMap.set(row.id, row.on_hand ?? 0)
  }

  const { data: equipmentPeriods, error: periodsErr } = await supabase
    .from('time_periods')
    .select('id, start_at, end_at, job_id')
    .eq('company_id', companyId)
    .eq('category', 'equipment')
    .eq('deleted', false)

  if (periodsErr) throw periodsErr

  const overlappingPeriodIds = new Set<string>()
  for (const period of equipmentPeriods ?? []) {
    if (
      period.job_id !== jobId &&
      periodsOverlap(startAt, endAt, period.start_at, period.end_at)
    ) {
      overlappingPeriodIds.add(period.id)
    }
  }

  if (overlappingPeriodIds.size === 0) {
    return { summaryLines: [], conflicts: [] }
  }

  const { data: overlappingReservations, error: reservationsErr } =
    await supabase
      .from('reserved_items')
      .select(
        `
        id,
        item_id,
        quantity,
        status,
        time_period:time_period_id (
          start_at,
          end_at,
          job_id
        )
      `,
      )
      .in('item_id', allItemIds)
      .in('time_period_id', Array.from(overlappingPeriodIds))

  if (reservationsErr) throw reservationsErr

  const overlappingJobIds = new Set<string>()
  for (const res of overlappingReservations ?? []) {
    const tp = res.time_period as { job_id: string | null } | null
    if (tp?.job_id) overlappingJobIds.add(tp.job_id)
  }

  const overlappingJobMap = new Map<
    string,
    {
      title: string | null
      customerName: string | null
      projectLeadName: string | null
    }
  >()

  if (overlappingJobIds.size > 0) {
    const { data: overlappingJobs, error: jobsErr } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        customer:customer_id ( name ),
        project_lead:profiles!jobs_project_lead_user_id_fkey ( display_name, email )
      `,
      )
      .in('id', Array.from(overlappingJobIds))

    if (jobsErr) throw jobsErr

    for (const row of overlappingJobs ?? []) {
      overlappingJobMap.set(row.id, {
        title: row.title,
        customerName: row.customer?.name ?? null,
        projectLeadName:
          row.project_lead?.display_name ?? row.project_lead?.email ?? null,
      })
    }
  }

  const existingReservedMap = new Map<string, number>()
  const plannedReservedMap = new Map<string, number>()
  for (const res of overlappingReservations ?? []) {
    if (res.status === 'canceled') continue
    const current = existingReservedMap.get(res.item_id) ?? 0
    existingReservedMap.set(res.item_id, current + res.quantity)
    if (res.status === 'planned') {
      const plannedCurrent = plannedReservedMap.get(res.item_id) ?? 0
      plannedReservedMap.set(res.item_id, plannedCurrent + res.quantity)
    }
  }

  const summaryLines: Array<string> = []
  const conflicts: Array<OverlapConflict> = []

  for (const [itemId, newQty] of itemQuantityMap.entries()) {
    const onHand = itemOnHandMap.get(itemId) ?? 0
    const existingQty = existingReservedMap.get(itemId) ?? 0
    const finalTotal = existingQty + newQty
    const hasCapacityConflict = onHand > 0 && finalTotal > onHand
    const plannedQty = plannedReservedMap.get(itemId) ?? 0
    const hasPlannedConflict =
      plannedQty > 0 && newQty > 0 && !hasCapacityConflict

    if (!hasCapacityConflict && !hasPlannedConflict) continue

    const itemName = itemNameMap.get(itemId) ?? 'Item'

    if (hasCapacityConflict) {
      const existingPart =
        existingQty > 0 ? ` (${existingQty} already reserved)` : ''
      summaryLines.push(
        `${itemName}: Booking ${newQty}${existingPart}, but only ${onHand} available`,
      )
    } else {
      summaryLines.push(
        `${itemName}: ${plannedQty} already planned in overlapping period`,
      )
    }

    const itemReservations = (overlappingReservations ?? []).filter(
      (res) => res.item_id === itemId && res.status !== 'canceled',
    )

    for (const res of itemReservations) {
      const tp = res.time_period as {
        start_at: string
        end_at: string
        job_id: string | null
      } | null
      if (!tp?.start_at || !tp.end_at || !tp.job_id) continue
      const conflictJob = overlappingJobMap.get(tp.job_id)
      conflicts.push({
        jobId: tp.job_id,
        itemName,
        quantity: res.quantity,
        jobTitle: conflictJob?.title ?? null,
        startAt: tp.start_at,
        endAt: tp.end_at,
        customerName: conflictJob?.customerName ?? null,
        projectLeadName: conflictJob?.projectLeadName ?? null,
      })
    }
  }

  return {
    summaryLines,
    conflicts: dedupeOverlapConflicts(conflicts),
  }
}
