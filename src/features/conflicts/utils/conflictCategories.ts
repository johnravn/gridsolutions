import { mergeEquipmentConflicts } from './mergeEquipmentConflicts'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
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
