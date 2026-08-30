import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
  VehicleConflictRow,
} from '../api/queries'

function involvesProjectLeadJob(
  projectLeadJobIds: Set<string>,
  ...jobIds: Array<string | null | undefined>
): boolean {
  return jobIds.some((id) => id != null && projectLeadJobIds.has(id))
}

export function filterCrewConflictsByProjectLead(
  rows: Array<CrewConflictRow>,
  projectLeadJobIds: ReadonlyArray<string>,
): Array<CrewConflictRow> {
  const ids = new Set(projectLeadJobIds)
  return rows.filter((row) =>
    involvesProjectLeadJob(ids, row.job_id_1, row.job_id_2),
  )
}

export function filterVehicleConflictsByProjectLead(
  rows: Array<VehicleConflictRow>,
  projectLeadJobIds: ReadonlyArray<string>,
): Array<VehicleConflictRow> {
  const ids = new Set(projectLeadJobIds)
  return rows.filter((row) =>
    involvesProjectLeadJob(ids, row.job_id_1, row.job_id_2),
  )
}

export function filterEquipmentConflictsByProjectLead(
  rows: Array<EquipmentConflictRow>,
  projectLeadJobIds: ReadonlyArray<string>,
): Array<EquipmentConflictRow> {
  const ids = new Set(projectLeadJobIds)
  return rows.filter((row) =>
    (row.job_ids ?? []).some((jobId) => ids.has(jobId)),
  )
}

export function filterGroupConflictsByProjectLead(
  rows: Array<GroupConflictRow>,
  projectLeadJobIds: ReadonlyArray<string>,
): Array<GroupConflictRow> {
  const ids = new Set(projectLeadJobIds)
  return rows.filter((row) =>
    involvesProjectLeadJob(ids, row.job_id_1, row.job_id_2),
  )
}

export function hasAnyConflicts({
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  groupConflicts = [],
}: {
  crewConflicts: ReadonlyArray<CrewConflictRow>
  vehicleConflicts: ReadonlyArray<VehicleConflictRow>
  equipmentConflicts: ReadonlyArray<EquipmentConflictRow>
  groupConflicts?: ReadonlyArray<GroupConflictRow>
}): boolean {
  return (
    crewConflicts.length > 0 ||
    vehicleConflicts.length > 0 ||
    equipmentConflicts.length > 0 ||
    groupConflicts.length > 0
  )
}

function periodStillOpen(endAt: string, now: Date): boolean {
  return new Date(endAt).getTime() >= now.getTime()
}

/** Unresolved overlaps stay visible; forced overlaps drop off after they end. */
export function keepAttentionPairConflicts<
  T extends {
    forced_1: boolean
    forced_2: boolean
    end_1: string
    end_2: string
  },
>(rows: ReadonlyArray<T>, now: Date): Array<T> {
  return rows.filter((row) => {
    if (!row.forced_1 && !row.forced_2) return true
    return periodStillOpen(row.end_1, now) || periodStillOpen(row.end_2, now)
  })
}

export function keepAttentionEquipmentConflicts(
  rows: ReadonlyArray<EquipmentConflictRow>,
  now: Date,
): Array<EquipmentConflictRow> {
  return rows.filter(
    (row) => !row.has_forced || periodStillOpen(row.end_at, now),
  )
}
