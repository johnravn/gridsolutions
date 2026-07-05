export type VehicleOwnerKind = 'company' | 'partner' | 'person'

export type VehicleOwnershipFields = {
  internally_owned: boolean
  external_owner_id?: string | null
  owner_user_id?: string | null
  external_owner_name?: string | null
  owner_user_name?: string | null
}

export function vehicleOwnerKind(
  vehicle: VehicleOwnershipFields,
): VehicleOwnerKind {
  if (vehicle.internally_owned) return 'company'
  if (vehicle.owner_user_id) return 'person'
  return 'partner'
}

export function vehicleOwnerKey(vehicle: VehicleOwnershipFields): string {
  const kind = vehicleOwnerKind(vehicle)
  if (kind === 'company') return 'company'
  if (kind === 'person') return `person:${vehicle.owner_user_id}`
  return `partner:${vehicle.external_owner_id ?? 'unknown'}`
}

export function vehicleOwnerLabel(vehicle: VehicleOwnershipFields): string {
  const kind = vehicleOwnerKind(vehicle)
  if (kind === 'company') return 'Internal (your company)'
  if (kind === 'person') return vehicle.owner_user_name ?? 'Personal'
  return vehicle.external_owner_name ?? 'External'
}

export function vehicleRequiresExternalStatus(
  vehicle: VehicleOwnershipFields,
): boolean {
  return !vehicle.internally_owned
}

export function vehicleOwnerBadge(vehicle: VehicleOwnershipFields): {
  label: string
  color: 'indigo' | 'violet' | 'amber'
} {
  const kind = vehicleOwnerKind(vehicle)
  if (kind === 'company') {
    return { label: 'Internal', color: 'indigo' }
  }
  if (kind === 'person') {
    return { label: vehicle.owner_user_name ?? 'Personal', color: 'amber' }
  }
  return { label: vehicle.external_owner_name ?? 'External', color: 'violet' }
}
