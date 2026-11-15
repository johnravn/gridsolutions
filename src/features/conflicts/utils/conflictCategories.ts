import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
  PairConflictBase,
  VehicleConflictRow,
} from '../api/queries'

export function isForcedPair(forced1: boolean, forced2: boolean): boolean {
  return forced1 || forced2
}

export function vehicleConflictToneByPeriodId(
  rows: Array<VehicleConflictRow>,
): Map<string, 'unresolved' | 'forced'> {
  const tones = new Map<string, 'unresolved' | 'forced'>()
  for (const row of rows) {
    const tone: 'unresolved' | 'forced' = isForcedPair(
      row.forced_1,
      row.forced_2,
    )
      ? 'forced'
      : 'unresolved'
    for (const periodId of [row.period_id_1, row.period_id_2]) {
      if (!periodId) continue
      if (tones.get(periodId) === 'unresolved') continue
      tones.set(periodId, tone)
    }
  }
  return tones
}

/** Split pair conflicts; rows should already be merged at the query boundary. */
export function splitPairConflicts<TRow extends PairConflictBase>(
  rows: Array<TRow>,
): { unresolved: Array<TRow>; forced: Array<TRow> } {
  const unresolved: Array<TRow> = []
  const forced: Array<TRow> = []
  for (const row of rows) {
    if (isForcedPair(row.forced_1, row.forced_2)) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function splitCrewConflicts(rows: Array<CrewConflictRow>) {
  return splitPairConflicts(rows)
}

export function splitVehicleConflicts(rows: Array<VehicleConflictRow>) {
  return splitPairConflicts(rows)
}

/**
 * Split equipment conflicts by has_forced.
 * Callers should pass rows already merged via equipmentConflictsQuery /
 * jobBookingConflictsQuery (merge lives once at the query boundary).
 */
export function splitEquipmentConflicts(rows: Array<EquipmentConflictRow>) {
  const unresolved: Array<EquipmentConflictRow> = []
  const forced: Array<EquipmentConflictRow> = []
  for (const row of rows) {
    if (row.has_forced) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function splitGroupConflicts(rows: Array<GroupConflictRow>) {
  return splitPairConflicts(rows)
}

export function groupConflictDisplayName(row: {
  group_name_1: string | null
  group_name_2: string | null
}): string {
  const left = row.group_name_1?.trim() || 'Unknown'
  const right = row.group_name_2?.trim() || 'Unknown'
  return left === right ? left : `${left} / ${right}`
}
