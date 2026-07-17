import type {
  CrewConflictRow,
  EquipmentConflictRow,
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

export function hasAnyConflicts({
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
}: {
  crewConflicts: ReadonlyArray<CrewConflictRow>
  vehicleConflicts: ReadonlyArray<VehicleConflictRow>
  equipmentConflicts: ReadonlyArray<EquipmentConflictRow>
}): boolean {
  return (
    crewConflicts.length > 0 ||
    vehicleConflicts.length > 0 ||
    equipmentConflicts.length > 0
  )
}
