import {
  groupConflictDisplayName,
  splitCrewConflicts,
  splitEquipmentConflicts,
  splitGroupConflicts,
  splitVehicleConflicts,
} from './conflictCategories'
import {
  formatNamedJob,
  joinWithAnd,
  overlapSidesFromPair,
} from './conflictCopy'
import { overlapWindow, periodWindow } from './overlapWindow'
import type { OverlapWindow } from './overlapWindow'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
  VehicleConflictRow,
} from '../api/queries'

export type ConflictKind = 'crew' | 'vehicle' | 'equipment' | 'group'
export type ConflictFilterKind = 'crew' | 'vehicle' | 'equipment'
export type ConflictTone = 'red' | 'amber'

export type ConflictCardItem =
  | {
      kind: 'crew'
      key: string
      tone: ConflictTone
      row: CrewConflictRow
    }
  | {
      kind: 'vehicle'
      key: string
      tone: ConflictTone
      row: VehicleConflictRow
    }
  | {
      kind: 'equipment'
      key: string
      tone: ConflictTone
      row: EquipmentConflictRow
    }
  | {
      kind: 'group'
      key: string
      tone: ConflictTone
      row: GroupConflictRow
    }

export type ConflictListFilters = {
  status: 'all' | 'unresolved' | 'forced'
  kind: 'all' | ConflictFilterKind
}

export const CONFLICT_KIND_LABEL: Record<ConflictFilterKind, string> = {
  crew: 'Crew',
  vehicle: 'Vehicle',
  equipment: 'Equipment',
}

export function conflictDisplayKind(kind: ConflictKind): ConflictFilterKind {
  return kind === 'group' ? 'equipment' : kind
}

export function conflictStatusLabel(tone: ConflictTone): string {
  return tone === 'red' ? 'Unresolved' : 'Forced'
}

export function conflictKindLabel(kind: ConflictKind): string {
  return CONFLICT_KIND_LABEL[conflictDisplayKind(kind)]
}

export function conflictListFooterLabel(count: number): string {
  return `${count} conflict${count !== 1 ? 's' : ''}`
}

export function conflictResourceName(item: ConflictCardItem): string {
  if (item.kind === 'crew')
    return item.row.user_display_name?.trim() || 'Unknown'
  if (item.kind === 'vehicle') return item.row.vehicle_name?.trim() || 'Unknown'
  if (item.kind === 'equipment') return item.row.item_name?.trim() || 'Unknown'
  return groupConflictDisplayName(item.row)
}

export function conflictJobLabels(item: ConflictCardItem): Array<string> {
  if (item.kind === 'equipment') {
    const ids = item.row.job_ids ?? []
    const titles = item.row.job_titles ?? []
    if (ids.length === 0) return [formatNamedJob(null, false)]
    return ids.map((id, index) => formatNamedJob(titles[index], !!id))
  }
  return overlapSidesFromPair(item.row).map((side) => side.title)
}

export function conflictJobsLine(item: ConflictCardItem): string {
  return joinWithAnd(conflictJobLabels(item))
}

export function conflictJobButtonItems(
  item: ConflictCardItem,
  formatPeriod: (start: string, end: string) => string,
): Array<{ jobId: string | null; title: string; period: string }> {
  if (item.kind === 'equipment') {
    const ids = item.row.job_ids ?? []
    const titles = item.row.job_titles ?? []
    const period = formatPeriod(item.row.start_at, item.row.end_at)
    if (ids.length === 0) {
      return [
        {
          jobId: null,
          title: formatNamedJob(null, false),
          period,
        },
      ]
    }
    return ids.map((id, index) => ({
      jobId: id,
      title: formatNamedJob(titles[index], !!id),
      period,
    }))
  }

  return overlapSidesFromPair(item.row).map((side) => ({
    jobId: side.jobId,
    title: side.title,
    period: formatPeriod(side.startAt, side.endAt),
  }))
}

export function conflictOpenJobs(
  item: ConflictCardItem,
): Array<{ jobId: string; title: string }> {
  const seen = new Set<string>()
  const jobs: Array<{ jobId: string; title: string }> = []

  if (item.kind === 'equipment') {
    const ids = item.row.job_ids ?? []
    const titles = item.row.job_titles ?? []
    for (const [index, id] of ids.entries()) {
      if (!id || seen.has(id)) continue
      seen.add(id)
      jobs.push({ jobId: id, title: formatNamedJob(titles[index], true) })
    }
    return jobs
  }

  for (const side of overlapSidesFromPair(item.row)) {
    if (!side.jobId || seen.has(side.jobId)) continue
    seen.add(side.jobId)
    jobs.push({ jobId: side.jobId, title: side.title })
  }
  return jobs
}

export function conflictInvolvesProjectLead(
  item: ConflictCardItem,
  projectLeadJobIds: ReadonlySet<string> | ReadonlyArray<string>,
): boolean {
  const ids =
    projectLeadJobIds instanceof Set
      ? projectLeadJobIds
      : new Set(projectLeadJobIds)
  if (ids.size === 0) return false
  return conflictOpenJobs(item).some((job) => ids.has(job.jobId))
}

export function countProjectLeadConflicts(
  items: Array<ConflictCardItem>,
  projectLeadJobIds: ReadonlyArray<string>,
): number {
  const ids = new Set(projectLeadJobIds)
  if (ids.size === 0) return 0
  return items.filter((item) => conflictInvolvesProjectLead(item, ids)).length
}

export function conflictOverlap(item: ConflictCardItem): OverlapWindow | null {
  if (item.kind === 'equipment') {
    return periodWindow(item.row.start_at, item.row.end_at)
  }
  return overlapWindow(
    item.row.start_1,
    item.row.end_1,
    item.row.start_2,
    item.row.end_2,
  )
}

export function conflictItemId(
  kind: ConflictKind,
  tone: ConflictTone,
  row:
    | CrewConflictRow
    | VehicleConflictRow
    | EquipmentConflictRow
    | GroupConflictRow,
): string {
  if (kind === 'crew') {
    const crew = row as CrewConflictRow
    return `crew-${tone}-${crew.user_id}-${crew.period_id_1}-${crew.period_id_2}`
  }
  if (kind === 'vehicle') {
    const vehicle = row as VehicleConflictRow
    return `vehicle-${tone}-${vehicle.vehicle_id}-${vehicle.period_id_1}-${vehicle.period_id_2}`
  }
  if (kind === 'equipment') {
    const equipment = row as EquipmentConflictRow
    const ids = [...(equipment.job_ids ?? [])].sort().join('|')
    return `equipment-${tone}-${equipment.item_id}-${ids}-${equipment.start_at}-${equipment.end_at}`
  }
  const group = row as GroupConflictRow
  return `group-${tone}-${group.group_id_1}-${group.group_id_2}-${group.period_id_1}-${group.period_id_2}`
}

export function countConflictItems(
  crewConflicts: Array<CrewConflictRow>,
  vehicleConflicts: Array<VehicleConflictRow>,
  equipmentConflicts: Array<EquipmentConflictRow>,
  groupConflicts: Array<GroupConflictRow> = [],
) {
  const crew = splitCrewConflicts(crewConflicts)
  const vehicles = splitVehicleConflicts(vehicleConflicts)
  const equipment = splitEquipmentConflicts(equipmentConflicts)
  const groups = splitGroupConflicts(groupConflicts)
  return (
    crew.unresolved.length +
    crew.forced.length +
    vehicles.unresolved.length +
    vehicles.forced.length +
    equipment.unresolved.length +
    equipment.forced.length +
    groups.unresolved.length +
    groups.forced.length
  )
}

export function buildConflictCards(
  crewConflicts: Array<CrewConflictRow>,
  vehicleConflicts: Array<VehicleConflictRow>,
  equipmentConflicts: Array<EquipmentConflictRow>,
  groupConflicts: Array<GroupConflictRow> = [],
): Array<ConflictCardItem> {
  const crew = splitCrewConflicts(crewConflicts)
  const vehicles = splitVehicleConflicts(vehicleConflicts)
  const equipment = splitEquipmentConflicts(equipmentConflicts)
  const groups = splitGroupConflicts(groupConflicts)
  const items: Array<ConflictCardItem> = []

  const pushCrew = (rows: Array<CrewConflictRow>, tone: ConflictTone) => {
    for (const row of rows) {
      items.push({
        kind: 'crew',
        key: conflictItemId('crew', tone, row),
        tone,
        row,
      })
    }
  }
  const pushVehicle = (rows: Array<VehicleConflictRow>, tone: ConflictTone) => {
    for (const row of rows) {
      items.push({
        kind: 'vehicle',
        key: conflictItemId('vehicle', tone, row),
        tone,
        row,
      })
    }
  }
  const pushEquipment = (
    rows: Array<EquipmentConflictRow>,
    tone: ConflictTone,
  ) => {
    for (const row of rows) {
      items.push({
        kind: 'equipment',
        key: conflictItemId('equipment', tone, row),
        tone,
        row,
      })
    }
  }
  const pushGroup = (rows: Array<GroupConflictRow>, tone: ConflictTone) => {
    for (const row of rows) {
      items.push({
        kind: 'group',
        key: conflictItemId('group', tone, row),
        tone,
        row,
      })
    }
  }

  pushCrew(crew.unresolved, 'red')
  pushVehicle(vehicles.unresolved, 'red')
  pushEquipment(equipment.unresolved, 'red')
  pushGroup(groups.unresolved, 'red')
  pushCrew(crew.forced, 'amber')
  pushVehicle(vehicles.forced, 'amber')
  pushEquipment(equipment.forced, 'amber')
  pushGroup(groups.forced, 'amber')

  return items
}

export function filterConflictItems(
  items: Array<ConflictCardItem>,
  filters: ConflictListFilters,
): Array<ConflictCardItem> {
  return items.filter((item) => {
    if (
      filters.kind !== 'all' &&
      conflictDisplayKind(item.kind) !== filters.kind
    ) {
      return false
    }
    if (filters.status === 'unresolved' && item.tone !== 'red') return false
    if (filters.status === 'forced' && item.tone !== 'amber') return false
    return true
  })
}
