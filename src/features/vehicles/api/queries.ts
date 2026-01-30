// src/features/vehicles/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type FuelType = 'electric' | 'diesel' | 'petrol'

export type VehicleCategory =
  | 'passenger_car_small'
  | 'passenger_car_medium'
  | 'passenger_car_big'
  | 'van_small'
  | 'van_medium'
  | 'van_big'
  | 'C1'
  | 'C1E'
  | 'C'
  | 'CE'

export type VehicleIndexRow = {
  id: string
  name: string
  registration_no: string | null
  image_path: string | null
  fuel: FuelType | null
  vehicle_category: VehicleCategory | null
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
  deleted: boolean | null
}

export type VehicleDetail = {
  id: string
  name: string
  registration_no: string | null
  image_path: string | null
  notes: string | null
  fuel: FuelType | null
  vehicle_category: VehicleCategory | null
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
  created_at: string
}

/* -------------------- Index -------------------- */
export function vehiclesIndexQuery({
  companyId,
  includeExternal,
  search,
}: {
  companyId: string
  includeExternal: boolean
  search: string
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'vehicles-index',
      includeExternal,
      search,
    ] as const,
    queryFn: async (): Promise<Array<VehicleIndexRow>> => {
      let q = supabase
        .from('vehicles')
        .select(
          `
          id,
          name,
          registration_no,
          image_path,
          fuel,
          vehicle_category,
          internally_owned,
          external_owner_id,
          deleted,
          external_owner:customers!vehicles_external_owner_id_fkey ( id, name )
        `,
        )
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')

      if (!includeExternal) q = q.eq('internally_owned', true)

      const term = search.trim()
      if (term) {
        // Fuzzy search: use multiple patterns for better matching
        const patterns = [
          `%${term}%`,
          term.length > 2 ? `%${term.split('').join('%')}%` : null,
        ].filter(Boolean) as Array<string>

        const conditions = patterns
          .flatMap((pattern) => [
            `name.ilike.${pattern}`,
            `registration_no.ilike.${pattern}`,
          ])
          .join(',')

        q = q.or(conditions)
      }

      const { data, error } = await q.order('name', { ascending: true })
      if (error) throw error

      return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        registration_no: r.registration_no ?? null,
        image_path: r.image_path ?? null,
        fuel: r.fuel ?? null,
        vehicle_category: r.vehicle_category ?? null,
        internally_owned: !!r.internally_owned,
        external_owner_id: r.external_owner_id ?? null,
        external_owner_name: r.external_owner?.name ?? null,
        deleted: r.deleted ?? null,
      }))
    },
  }
}

/* -------------------- Detail -------------------- */
export function vehicleDetailQuery({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) {
  return {
    queryKey: ['company', companyId, 'vehicle-detail', id] as const,
    queryFn: async (): Promise<VehicleDetail | null> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(
          `
          id,
          name,
          registration_no,
          image_path,
          notes,
          fuel,
          vehicle_category,
          internally_owned,
          external_owner_id,
          created_at,
          external_owner:customers!vehicles_external_owner_id_fkey ( id, name )
        `,
        )
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const d: any = data
      return {
        id: d.id,
        name: d.name,
        registration_no: d.registration_no ?? null,
        image_path: d.image_path ?? null,
        notes: d.notes ?? null,
        fuel: d.fuel ?? null,
        vehicle_category: d.vehicle_category ?? null,
        internally_owned: !!d.internally_owned,
        external_owner_id: d.external_owner_id ?? null,
        external_owner_name: d.external_owner?.name ?? null,
        created_at: d.created_at,
      }
    },
  }
}

/* -------------------- Upsert & delete -------------------- */
export type UpsertVehiclePayload = {
  id?: string
  company_id: string
  name: string
  registration_no?: string | null
  fuel?: FuelType | null
  vehicle_category?: VehicleCategory | null
  internally_owned: boolean
  external_owner_id?: string | null
  image_path?: string | null
  notes?: string | null
}

export async function upsertVehicle(payload: UpsertVehiclePayload) {
  const { id, ...rest } = payload
  const { data, error } = await supabase
    .from('vehicles')
    .upsert({ id, ...rest }, { onConflict: 'id' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function markVehicleDeleted({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) {
  const { error } = await supabase
    .from('vehicles')
    .update({ deleted: true })
    .eq('company_id', companyId)
    .eq('id', id)
  if (error) throw error
}

/* -------------------- Partners for owner dropdown -------------------- */
export function partnerCustomersQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'partner-customers'] as const,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_partner', true)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })

      if (error) throw error
      return data
    },
    staleTime: 60_000,
  }
}
