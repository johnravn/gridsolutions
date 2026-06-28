import { impliedBookedGroupCount } from '@features/jobs/utils/groupBookingQuantity'
import { supabase } from '@shared/api/supabase'
import type { CompanyJobsWeekOffset } from './companyJobsWeekQuery'

export type WeekJobBookingSummary = {
  hasEquipment: boolean
  hasVehicles: boolean
  equipmentByCategory: Array<{ categoryName: string; quantity: number }>
  vehicleNames: Array<string>
  crewLabels: Array<string>
}

function unwrapJoin<T>(v: unknown): T | null {
  if (v == null) return null
  if (Array.isArray(v)) {
    const x = v[0]
    if (x === undefined || x === null) return null
    return x as T
  }
  return v as T
}

function equipmentCategoryFromRow(row: {
  item?: unknown
  source_group?: unknown
}): string {
  const item = unwrapJoin<{ category?: unknown }>(row.item)
  const itemCat = unwrapJoin<{ name?: string | null }>(item?.category)
  const itemName = itemCat?.name?.trim()
  if (itemName) return itemName

  const sg = unwrapJoin<{ category?: unknown }>(row.source_group)
  const sgCat = unwrapJoin<{ name?: string | null }>(sg?.category)
  const sgName = sgCat?.name?.trim()
  if (sgName) return sgName

  return 'Other'
}

/** Category label for a group booking chunk (prefer kit/group category over member item). */
function groupChunkCategoryName(row: {
  item?: unknown
  source_group?: unknown
}): string {
  const sg = unwrapJoin<{ category?: unknown }>(row.source_group)
  const sgCat = unwrapJoin<{ name?: string | null }>(sg?.category)
  const sgName = sgCat?.name?.trim()
  if (sgName) return sgName
  return equipmentCategoryFromRow(row)
}

function vehicleNameFromRow(row: { vehicle?: unknown }): string | null {
  const v = unwrapJoin<{ name?: string | null; deleted?: boolean | null }>(
    row.vehicle,
  )
  if (!v || v.deleted) return null
  const n = v.name?.trim()
  return n && n.length > 0 ? n : 'Vehicle'
}

type ReservedItemAggRow = {
  time_period_id: string
  source_kind: 'direct' | 'group' | string
  source_group_id: string | null
  item_id: string
  quantity: number | null
  item?: unknown
  source_group?: unknown
}

type ReservedVehicleAggRow = {
  time_period_id: string
  vehicle?: unknown
}

type ReservedCrewAggRow = {
  time_period_id: string
  user_id: string | null
  user?: unknown
  placeholder_name?: string | null
}

export function companyWeekJobsBookingsQuery({
  companyId,
  weekOffset,
  jobsMeta,
}: {
  companyId: string
  weekOffset: CompanyJobsWeekOffset
  jobsMeta: Array<{ id: string; leadUserId: string | null }>
}) {
  const sortedIds = [...jobsMeta.map((j) => j.id)].sort().join(',')

  return {
    queryKey: [
      'home',
      companyId,
      'company-jobs-week-bookings',
      weekOffset,
      sortedIds,
    ] as const,
    queryFn: async (): Promise<Record<string, WeekJobBookingSummary>> => {
      const empty: Record<string, WeekJobBookingSummary> = {}
      if (jobsMeta.length === 0) return empty

      const leadByJob = new Map<string, string | null>()
      for (const j of jobsMeta) {
        leadByJob.set(j.id, j.leadUserId)
      }

      const jobIds = jobsMeta.map((j) => j.id)

      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, job_id, category')
        .in('job_id', jobIds)
        .eq('deleted', false)

      if (tpErr) throw tpErr

      const tpList = timePeriods
      const tpToJob = new Map<string, string>()
      const allTpIds: Array<string> = []
      const transportTpIds: Array<string> = []
      const crewTpIds: Array<string> = []

      for (const tp of tpList) {
        if (!tp.id || !tp.job_id) continue
        tpToJob.set(tp.id, tp.job_id)
        allTpIds.push(tp.id)
        if (tp.category === 'transport') transportTpIds.push(tp.id)
        if (tp.category === 'crew') crewTpIds.push(tp.id)
      }

      const initSummary = (): WeekJobBookingSummary => ({
        hasEquipment: false,
        hasVehicles: false,
        equipmentByCategory: [],
        vehicleNames: [],
        crewLabels: [],
      })

      const byJob: Record<string, WeekJobBookingSummary> = {}
      for (const id of jobIds) {
        byJob[id] = initSummary()
      }

      /**
       * Per job → category → counts: direct rows sum `quantity`; each group
       * booking chunk (same source_group + time period) contributes
       * impliedBookedGroupCount once under the kit's category.
       */
      const equipmentQtyByJobCategory = new Map<string, Map<string, number>>()

      const bump = (jobId: string, categoryName: string, delta: number) => {
        if (delta <= 0) return
        let m = equipmentQtyByJobCategory.get(jobId)
        if (!m) {
          m = new Map()
          equipmentQtyByJobCategory.set(jobId, m)
        }
        m.set(categoryName, (m.get(categoryName) ?? 0) + delta)
      }

      if (allTpIds.length > 0) {
        const { data: itemRows, error: itemErr } = await supabase
          .from('reserved_items')
          .select(
            `
            time_period_id,
            source_kind,
            source_group_id,
            item_id,
            quantity,
            status,
            item:item_id ( category:category_id ( name ) ),
            source_group:source_group_id ( category:category_id ( name ) )
          `,
          )
          .in('time_period_id', allTpIds)
          .neq('status', 'canceled')

        if (itemErr) throw itemErr

        const rows = itemRows as unknown as Array<ReservedItemAggRow>
        const groupChunkMap = new Map<string, Array<ReservedItemAggRow>>()
        const groupIdsForTemplate = new Set<string>()

        for (const row of rows) {
          const jobId = tpToJob.get(row.time_period_id)
          if (!jobId) continue
          const isGroup =
            row.source_kind === 'group' &&
            row.source_group_id != null &&
            row.source_group_id.length > 0
          if (isGroup) {
            const chunkKey = `${jobId}:${row.source_group_id}:${row.time_period_id}`
            const list = groupChunkMap.get(chunkKey) ?? []
            list.push(row)
            groupChunkMap.set(chunkKey, list)
            groupIdsForTemplate.add(row.source_group_id)
            continue
          }

          const qty = row.quantity ?? 0
          if (qty <= 0) continue
          bump(jobId, equipmentCategoryFromRow(row), qty)
        }

        const groupItemsByGroupId = new Map<
          string,
          Array<{ item_id: string; quantity: number }>
        >()
        if (groupIdsForTemplate.size > 0) {
          const { data: groupItemsRows, error: giErr } = await supabase
            .from('group_items')
            .select('group_id, item_id, quantity')
            .in('group_id', Array.from(groupIdsForTemplate))
          if (giErr) throw giErr
          for (const row of groupItemsRows) {
            if (!row.group_id || !row.item_id) continue
            const list = groupItemsByGroupId.get(row.group_id) ?? []
            list.push({
              item_id: row.item_id,
              quantity: row.quantity,
            })
            groupItemsByGroupId.set(row.group_id, list)
          }
        }

        for (const [chunkKey, chunkRows] of groupChunkMap) {
          const jobId = chunkKey.split(':')[0]
          if (!jobId) continue
          const first = chunkRows[0]
          const gid = first?.source_group_id
          if (!gid) continue
          const template = groupItemsByGroupId.get(gid) ?? []
          const groupCount =
            template.length > 0
              ? impliedBookedGroupCount(
                  template,
                  chunkRows.map((r) => ({
                    item_id: r.item_id,
                    quantity: r.quantity ?? 0,
                  })),
                )
              : 1
          bump(jobId, groupChunkCategoryName(first), groupCount)
        }
      }

      if (transportTpIds.length > 0) {
        const { data: vehRows, error: vehErr } = await supabase
          .from('reserved_vehicles')
          .select(
            `
            time_period_id,
            status,
            vehicle:vehicle_id ( id, name, deleted )
          `,
          )
          .in('time_period_id', transportTpIds)
          .neq('status', 'canceled')

        if (vehErr) throw vehErr

        const namesByJob = new Map<string, Set<string>>()

        const vrows = vehRows as unknown as Array<ReservedVehicleAggRow>
        for (const row of vrows) {
          const jobId = tpToJob.get(row.time_period_id)
          if (!jobId) continue
          const name = vehicleNameFromRow(row)
          if (!name) continue
          let set = namesByJob.get(jobId)
          if (!set) {
            set = new Set()
            namesByJob.set(jobId, set)
          }
          set.add(name)
        }

        for (const [jobId, set] of namesByJob) {
          byJob[jobId].hasVehicles = set.size > 0
          byJob[jobId].vehicleNames = [...set].sort((a, b) =>
            a.localeCompare(b, 'nb'),
          )
        }
      }

      for (const [jobId, catMap] of equipmentQtyByJobCategory) {
        const pairs = [...catMap.entries()].map(([categoryName, quantity]) => ({
          categoryName,
          quantity,
        }))
        pairs.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'nb'))
        byJob[jobId].hasEquipment = pairs.some((p) => p.quantity > 0)
        byJob[jobId].equipmentByCategory = pairs
      }

      if (crewTpIds.length > 0) {
        const { data: crewRows, error: crewErr } = await supabase
          .from('reserved_crew')
          .select(
            `
            time_period_id,
            user_id,
            status,
            placeholder_name,
            user:user_id ( user_id, display_name, email )
          `,
          )
          .in('time_period_id', crewTpIds)
          .in('status', ['planned', 'confirmed'])

        if (crewErr) throw crewErr

        const crewByJob = new Map<string, Map<string, string>>()

        const crows = crewRows as unknown as Array<ReservedCrewAggRow>
        for (const row of crows) {
          const jobId = tpToJob.get(row.time_period_id)
          if (!jobId) continue

          const leadId = leadByJob.get(jobId)
          const uid = row.user_id
          if (uid && leadId && uid === leadId) continue

          let label: string | null = null
          if (uid) {
            const u = unwrapJoin<{
              display_name?: string | null
              email?: string | null
            }>(row.user)
            label = u?.display_name?.trim() || u?.email?.trim() || null
          } else {
            const ph = row.placeholder_name
            if (ph?.trim()) label = ph.trim()
          }
          if (!label) continue

          let userMap = crewByJob.get(jobId)
          if (!userMap) {
            userMap = new Map()
            crewByJob.set(jobId, userMap)
          }
          const dedupeKey = uid ?? `ph:${label}`
          if (!userMap.has(dedupeKey)) userMap.set(dedupeKey, label)
        }

        for (const [jobId, userMap] of crewByJob) {
          byJob[jobId].crewLabels = [...userMap.values()].sort((a, b) =>
            a.localeCompare(b, 'nb'),
          )
        }
      }

      return byJob
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  }
}
