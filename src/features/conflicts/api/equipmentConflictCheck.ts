import { supabase } from '@shared/api/supabase'
import { flattenGroupLeafItems } from '@features/inventory/api/flattenGroupItems'
import {
  dedupeOverlapConflicts,
  findGroupOverlaps,
} from '@features/conflicts/api/overlapChecks'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'
import type { OfferDetail } from '@features/jobs/types'

export type EquipmentConflictPreview = {
  summaryLines: Array<string>
  conflicts: Array<OverlapConflict>
  conflictingItemIds: Array<string>
}

export type BasisBookingConflictPreview = EquipmentConflictPreview & {
  jobStartAt: string
  jobEndAt: string
}

type OfferItemQuantityInput = {
  groups?: OfferDetail['groups']
}

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && start2 < end1
}

async function buildOfferGroupMembership(
  offer: OfferItemQuantityInput,
): Promise<{
  quantityById: Map<string, number>
  membership: Map<
    string,
    { groupId: string; groupName: string; quantity: number }
  >
}> {
  const quantityById = new Map<string, number>()
  const nameById = new Map<string, string>()
  const groupIds = new Set<string>()

  for (const group of offer.groups ?? []) {
    for (const line of group.items ?? []) {
      if (!line.group_id) continue
      groupIds.add(line.group_id)
      quantityById.set(
        line.group_id,
        (quantityById.get(line.group_id) ?? 0) + Math.max(0, line.quantity),
      )
      const name = line.group?.name?.trim()
      if (name && !nameById.has(line.group_id)) {
        nameById.set(line.group_id, name)
      }
    }
  }

  const membership = new Map<
    string,
    { groupId: string; groupName: string; quantity: number }
  >()
  if (groupIds.size === 0) return { quantityById, membership }

  const leafMap = await flattenGroupLeafItems(Array.from(groupIds))
  for (const [groupId, members] of leafMap) {
    const groupName = nameById.get(groupId) ?? 'Group'
    const quantity = Math.max(1, quantityById.get(groupId) ?? 1)
    for (const member of members) {
      if (!member.item_id || membership.has(member.item_id)) continue
      membership.set(member.item_id, { groupId, groupName, quantity })
    }
  }

  return { quantityById, membership }
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

  const groupItemsMap = await flattenGroupLeafItems(Array.from(groupIds))

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
  const { quantityById: offerGroupQuantityById, membership } =
    await buildOfferGroupMembership(offer)
  const offerGroupIds = Array.from(offerGroupQuantityById.keys())

  const summaryLines: Array<string> = []
  const conflicts: Array<OverlapConflict> = []
  const conflictingItemIds: Array<string> = []

  if (offerGroupIds.length > 0) {
    const groupOverlaps = await findGroupOverlaps({
      groupIds: offerGroupIds,
      startAt,
      endAt,
      excludeJobId: jobId,
    })
    for (const overlaps of groupOverlaps.values()) {
      if (overlaps.length === 0) continue
      const groupName =
        overlaps[0]?.sourceGroupName ?? overlaps[0]?.itemName ?? 'Group'
      summaryLines.push(`${groupName}: already booked in an overlapping period`)
      const groupId = overlaps[0]?.sourceGroupId
      const groupQuantity = groupId
        ? (offerGroupQuantityById.get(groupId) ?? 1)
        : 1
      for (const overlap of overlaps) {
        conflicts.push({
          ...overlap,
          sourceGroupQuantity: overlap.sourceGroupQuantity ?? groupQuantity,
        })
      }
    }
  }

  if (itemQuantityMap.size === 0) {
    return {
      summaryLines,
      conflicts: dedupeOverlapConflicts(conflicts),
      conflictingItemIds,
    }
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
    return {
      summaryLines,
      conflicts: dedupeOverlapConflicts(conflicts),
      conflictingItemIds,
    }
  }

  const { data: overlappingReservations, error: reservationsErr } =
    await supabase
      .from('reserved_items')
      .select(
        `
        id,
        item_id,
        quantity,
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
  for (const res of overlappingReservations ?? []) {
    const current = existingReservedMap.get(res.item_id) ?? 0
    existingReservedMap.set(res.item_id, current + res.quantity)
  }

  for (const [itemId, newQty] of itemQuantityMap.entries()) {
    const onHand = itemOnHandMap.get(itemId) ?? 0
    const existingQty = existingReservedMap.get(itemId) ?? 0
    const finalTotal = existingQty + newQty
    const hasCapacityConflict = onHand > 0 && finalTotal > onHand

    if (!hasCapacityConflict) continue

    conflictingItemIds.push(itemId)
    const itemName = itemNameMap.get(itemId) ?? 'Item'
    const source = membership.get(itemId)
    if (!source) {
      const existingPart =
        existingQty > 0 ? ` (${existingQty} already reserved)` : ''
      summaryLines.push(
        `${itemName}: Booking ${newQty}${existingPart}, but only ${onHand} available`,
      )
    }

    const itemReservations = (overlappingReservations ?? []).filter(
      (res) => res.item_id === itemId,
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
        itemId,
        itemName,
        quantity: res.quantity,
        jobTitle: conflictJob?.title ?? null,
        startAt: tp.start_at,
        endAt: tp.end_at,
        customerName: conflictJob?.customerName ?? null,
        projectLeadName: conflictJob?.projectLeadName ?? null,
        sourceGroupId: source?.groupId ?? null,
        sourceGroupName: source?.groupName ?? null,
        sourceGroupQuantity: source?.quantity,
      })
    }
  }

  return {
    summaryLines,
    conflicts: dedupeOverlapConflicts(conflicts),
    conflictingItemIds,
  }
}
