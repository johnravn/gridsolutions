import { mergeEquipmentConflicts } from './mergeEquipmentConflicts'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
  VehicleConflictRow,
} from '../api/queries'

export function isForcedPair(forced1: boolean, forced2: boolean): boolean {
  return forced1 || forced2
}

export function splitCrewConflicts(rows: Array<CrewConflictRow>) {
  const unresolved: Array<CrewConflictRow> = []
  const forced: Array<CrewConflictRow> = []
  for (const row of rows) {
    if (isForcedPair(row.forced_1, row.forced_2)) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function splitVehicleConflicts(rows: Array<VehicleConflictRow>) {
  const unresolved: Array<VehicleConflictRow> = []
  const forced: Array<VehicleConflictRow> = []
  for (const row of rows) {
    if (isForcedPair(row.forced_1, row.forced_2)) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function splitEquipmentConflicts(rows: Array<EquipmentConflictRow>) {
  const merged = mergeEquipmentConflicts(rows)
  const unresolved: Array<EquipmentConflictRow> = []
  const forced: Array<EquipmentConflictRow> = []
  for (const row of merged) {
    if (row.has_forced) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function splitGroupConflicts(rows: Array<GroupConflictRow>) {
  const unresolved: Array<GroupConflictRow> = []
  const forced: Array<GroupConflictRow> = []
  for (const row of rows) {
    if (isForcedPair(row.forced_1, row.forced_2)) {
      forced.push(row)
    } else {
      unresolved.push(row)
    }
  }
  return { unresolved, forced }
}

export function groupConflictDisplayName(row: {
  group_name_1: string | null
  group_name_2: string | null
}): string {
  const left = row.group_name_1?.trim() || 'Unknown'
  const right = row.group_name_2?.trim() || 'Unknown'
  return left === right ? left : `${left} / ${right}`
}
