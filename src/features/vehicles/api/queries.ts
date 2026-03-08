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

/* -------------------- Personal vehicle bookings (outside jobs) -------------------- */
export type PersonalBookingInput = {
  companyId: string
  vehicleId: string
  title: string
  startAt: string
  endAt: string
}

/** Create a personal vehicle booking (time_period with job_id=null + reserved_vehicles). */
export async function createPersonalVehicleBooking(
  input: PersonalBookingInput,
): Promise<string> {
  const { data: tp, error: tpErr } = await supabase
    .from('time_periods')
    .insert({
      company_id: input.companyId,
      job_id: null,
      title: input.title,
      start_at: input.startAt,
      end_at: input.endAt,
      category: 'transport',
      deleted: false,
    })
    .select('id')
    .single()
  if (tpErr) throw tpErr

  const { error: rvErr } = await supabase.from('reserved_vehicles').insert({
    time_period_id: tp.id,
    vehicle_id: input.vehicleId,
  })
  if (rvErr) throw rvErr
  return tp.id
}

export type UpdatePersonalBookingInput = {
  timePeriodId: string
  title?: string
  startAt?: string
  endAt?: string
}

/** Update a personal vehicle booking. Caller must ensure job_id is null. */
export async function updatePersonalVehicleBooking(
  input: UpdatePersonalBookingInput,
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = input.title
  if (input.startAt !== undefined) payload.start_at = input.startAt
  if (input.endAt !== undefined) payload.end_at = input.endAt
  if (Object.keys(payload).length === 0) return
  const { error } = await supabase
    .from('time_periods')
    .update(payload)
    .eq('id', input.timePeriodId)
  if (error) throw error
}

/** Delete a personal vehicle booking (hard-delete; cascade removes reserved_vehicles). Caller must ensure job_id is null. */
export async function deletePersonalVehicleBooking(timePeriodId: string): Promise<void> {
  const { error } = await supabase
    .from('time_periods')
    .delete()
    .eq('id', timePeriodId)
  if (error) throw error
}

/** Check if a time period is a personal booking (job_id is null) */
export async function isPersonalBooking(timePeriodId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('time_periods')
    .select('job_id')
    .eq('id', timePeriodId)
    .single()
  if (error) throw error
  return data.job_id == null
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
