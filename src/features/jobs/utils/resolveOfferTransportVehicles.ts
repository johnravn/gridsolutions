export type OfferTransportVehicleCandidate = {
  id: string
  name: string
  internally_owned: boolean
  external_owner_id: string | null
  owner_user_id: string | null
  vehicle_category: string | null
}

export type OfferTransportLineInput = {
  vehicle_id?: string | null
  vehicle_name?: string | null
  vehicle_category?: string | null
  start_date?: string | null
  end_date?: string | null
  is_internal?: boolean
  vehicle?: { external_owner_id?: string | null } | null
}

export type ResolvedOfferTransportVehicle = {
  vehicleId: string
  vehicleName: string
  internallyOwned: boolean
  startAt: string
  endAt: string
}

/**
 * Mirrors vehicle selection used when creating bookings from an offer basis.
 * Returns one entry per transport line (null when no vehicle can be chosen).
 * Explicit vehicle_id wins; otherwise first unused matching category (internal preferred).
 */
export function resolveOfferTransportVehicles({
  transportItems,
  availableVehicles,
  defaultStart,
  defaultEnd,
}: {
  transportItems: Array<OfferTransportLineInput>
  availableVehicles: Array<OfferTransportVehicleCandidate>
  defaultStart: string
  defaultEnd: string
}): Array<ResolvedOfferTransportVehicle | null> {
  const usedVehicleIds = new Set<string>()
  const resolved: Array<ResolvedOfferTransportVehicle | null> = []

  for (const transportItem of transportItems) {
    const startAt = transportItem.start_date || defaultStart
    const endAt = transportItem.end_date || defaultEnd
    const category = transportItem.vehicle_category ?? null
    const existingVehicleId = transportItem.vehicle_id ?? null
    let chosen: OfferTransportVehicleCandidate | undefined

    if (existingVehicleId) {
      chosen = availableVehicles.find(
        (vehicle) => vehicle.id === existingVehicleId,
      )
      if (!chosen) {
        chosen = {
          id: existingVehicleId,
          name: transportItem.vehicle_name || 'Vehicle',
          internally_owned: !!transportItem.is_internal,
          external_owner_id: transportItem.is_internal
            ? null
            : (transportItem.vehicle?.external_owner_id ?? null),
          owner_user_id: null,
          vehicle_category: category,
        }
      }
    } else if (category) {
      const matches = availableVehicles.filter(
        (vehicle) => vehicle.vehicle_category === category,
      )
      const internalMatch = matches.find(
        (vehicle) =>
          vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
      )
      const externalMatch = matches.find(
        (vehicle) =>
          !vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
      )
      chosen = internalMatch ?? externalMatch ?? undefined
    }

    if (!chosen) {
      resolved.push(null)
      continue
    }

    usedVehicleIds.add(chosen.id)
    resolved.push({
      vehicleId: chosen.id,
      vehicleName: chosen.name,
      internallyOwned: chosen.internally_owned,
      startAt,
      endAt,
    })
  }

  return resolved
}
