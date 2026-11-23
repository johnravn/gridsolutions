// src/features/vehicles/api/queries.ts
import { supabase } from '@shared/api/supabase'
import { postgrestIlikePatterns } from '@shared/api/fuzzySearch'

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
  owner_user_id: string | null
  owner_user_name: string | null
  deleted: boolean | null
}

/** Safety cap for empty/index loads — labeled in UI when hit. */
export const VEHICLES_INDEX_MAX_ROWS = 500

export type VehiclesIndexResult = {
  rows: Array<VehicleIndexRow>
  truncated: boolean
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
  owner_user_id: string | null
  owner_user_name: string | null
  created_at: string
}

type VehicleRowRaw = {
  id: string
  name: string
  registration_no?: string | null
  image_path?: string | null
  notes?: string | null
  fuel?: FuelType | null
  vehicle_category?: VehicleCategory | null
  internally_owned?: boolean | null
  external_owner_id?: string | null
  owner_user_id?: string | null
  deleted?: boolean | null
  created_at?: string
  external_owner?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
  owner_user?:
    | {
        user_id?: string
        display_name?: string | null
        email?: string | null
      }
    | Array<{
        user_id?: string
        display_name?: string | null
        email?: string | null
      }>
    | null
}

function mapOwnerUser(raw: VehicleRowRaw['owner_user']) {
  return Array.isArray(raw) ? raw[0] : raw
}

function mapExternalOwnerName(raw: VehicleRowRaw['external_owner']) {
  const owner = Array.isArray(raw) ? raw[0] : raw
  return owner?.name ?? null
}

/** Project a vehicles row (+ joins) into index/detail field shapes. */
export function mapVehicleRow(r: VehicleRowRaw): VehicleIndexRow {
  const ownerUser = mapOwnerUser(r.owner_user)
  return {
    id: r.id,
    name: r.name,
    registration_no: r.registration_no ?? null,
    image_path: r.image_path ?? null,
    fuel: r.fuel ?? null,
    vehicle_category: r.vehicle_category ?? null,
    internally_owned: !!r.internally_owned,
    external_owner_id: r.external_owner_id ?? null,
    external_owner_name: mapExternalOwnerName(r.external_owner),
    owner_user_id: r.owner_user_id ?? null,
    owner_user_name: ownerUser?.display_name ?? ownerUser?.email ?? null,
    deleted: r.deleted ?? null,
  }
}

function mapVehicleDetail(r: VehicleRowRaw): VehicleDetail {
  const base = mapVehicleRow(r)
  return {
    id: base.id,
    name: base.name,
    registration_no: base.registration_no,
    image_path: base.image_path,
    notes: r.notes ?? null,
    fuel: base.fuel,
    vehicle_category: base.vehicle_category,
    internally_owned: base.internally_owned,
    external_owner_id: base.external_owner_id,
    external_owner_name: base.external_owner_name,
    owner_user_id: base.owner_user_id,
    owner_user_name: base.owner_user_name,
    created_at: r.created_at ?? '',
  }
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
    queryFn: async (): Promise<VehiclesIndexResult> => {
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
          owner_user_id,
          deleted,
          external_owner:customers!vehicles_external_owner_id_fkey ( id, name ),
          owner_user:profiles!vehicles_owner_user_id_fkey ( user_id, display_name, email )
        `,
        )
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')

      if (!includeExternal) q = q.eq('internally_owned', true)

      const term = search.trim()
      if (term) {
        const patterns = postgrestIlikePatterns(term)
        const conditions = patterns.flatMap((pattern) => [
          `name.ilike.${pattern}`,
          `registration_no.ilike.${pattern}`,
        ])
        if (conditions.length > 0) {
          q = q.or(conditions.join(','))
        }
      }

      const { data, error } = await q
        .order('name', { ascending: true })
        .limit(VEHICLES_INDEX_MAX_ROWS + 1)
      if (error) throw error

      const truncated = (data?.length ?? 0) > VEHICLES_INDEX_MAX_ROWS
      const page = truncated
        ? (data ?? []).slice(0, VEHICLES_INDEX_MAX_ROWS)
        : (data ?? [])

      const rows = page.map((r) => mapVehicleRow(r as VehicleRowRaw))

      if (term) {
        const { fuzzySearch } = await import('@shared/lib/generalFunctions')
        return {
          rows: fuzzySearch(
            rows,
            term,
            [
              (row) => row.name,
              (row) => row.registration_no,
              (row) => row.external_owner_name,
              (row) => row.owner_user_name,
            ],
            0.25,
          ),
          truncated,
        }
      }

      return { rows, truncated }
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
          owner_user_id,
          created_at,
          external_owner:customers!vehicles_external_owner_id_fkey ( id, name ),
          owner_user:profiles!vehicles_owner_user_id_fkey ( user_id, display_name, email )
        `,
        )
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      return mapVehicleDetail(data as VehicleRowRaw)
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
  owner_user_id?: string | null
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

/** Check if a time period is a personal booking (job_id is null) */
export async function isPersonalBooking(
  timePeriodId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('time_periods')
    .select('job_id')
    .eq('id', timePeriodId)
    .single()
  if (error) throw error
  return data.job_id == null
}

async function assertPersonalBooking(timePeriodId: string): Promise<void> {
  const personal = await isPersonalBooking(timePeriodId)
  if (!personal) {
    throw new Error('Not a personal vehicle booking (job_id is set)')
  }
}

/** Update a personal vehicle booking. Rejects if the time period belongs to a job. */
export async function updatePersonalVehicleBooking(
  input: UpdatePersonalBookingInput,
): Promise<void> {
  await assertPersonalBooking(input.timePeriodId)
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = input.title
  if (input.startAt !== undefined) payload.start_at = input.startAt
  if (input.endAt !== undefined) payload.end_at = input.endAt
  if (Object.keys(payload).length === 0) return
  const { error } = await supabase
    .from('time_periods')
    .update(payload)
    .eq('id', input.timePeriodId)
    .is('job_id', null)
  if (error) throw error
}

/** Delete a personal vehicle booking (hard-delete; cascade removes reserved_vehicles). */
export async function deletePersonalVehicleBooking(
  timePeriodId: string,
): Promise<void> {
  await assertPersonalBooking(timePeriodId)
  const { error } = await supabase
    .from('time_periods')
    .delete()
    .eq('id', timePeriodId)
    .is('job_id', null)
  if (error) throw error
}

/* -------------------- Partners for owner dropdown -------------------- */
/** Re-export: single source lives under customers. */
export { partnerCustomersQuery } from '@features/customers/api/partners'

