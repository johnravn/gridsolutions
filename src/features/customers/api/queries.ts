import { supabase } from '@shared/api/supabase'
import {
  postgrestIlikeClause,
  postgrestIlikePatterns,
} from '@shared/api/fuzzySearch'
import { unwrapRelation } from '@shared/api/unwrapRelation'
import type { ContactRow, CrewPricingLevelInfo, CustomerRow } from '../types'

export type { ContactRow, CrewPricingLevelInfo, CustomerRow } from '../types'

/** Safety cap for empty/index loads — labeled in UI when hit. */
export const CUSTOMERS_INDEX_MAX_ROWS = 500

export type CustomersIndexResult = {
  rows: Array<CustomerRow>
  truncated: boolean
}

/* ---------- index ---------- */
export function customersIndexQuery({
  companyId,
  search,
  showRegular,
  showPartner,
}: {
  companyId: string
  search: string
  showRegular: boolean
  showPartner: boolean
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'customers-index',
      search,
      showRegular,
      showPartner,
    ] as const,
    queryFn: async (): Promise<CustomersIndexResult> => {
      let q = supabase
        .from('customers')
        .select(
          `id, company_id, name, email, phone, address, vat_number, is_partner, logo_path, accent_color, accent_color_custom, crew_pricing_level_id, discount_percent, created_at, conta_customer_id,
          crew_pricing_level:crew_pricing_level_id (id, name, crew_rate_per_day, crew_rate_per_hour)`,
        )
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')

      // Pull typo-tolerant candidates; Fuse ranks client-side below.
      if (search && search.trim()) {
        const patterns = postgrestIlikePatterns(search)
        if (patterns.length > 0) {
          q = q.or(
            patterns
              .map((pattern) => postgrestIlikeClause('name', pattern))
              .join(','),
          )
        }
      }

      q = q.order('name', { ascending: true })

      if (showRegular && !showPartner) q = q.eq('is_partner', false)
      if (!showRegular && showPartner) q = q.eq('is_partner', true)
      // if both on -> no filter; if both off -> show none
      if (!showRegular && !showPartner) return { rows: [], truncated: false }
      const { data, error } = await q.limit(CUSTOMERS_INDEX_MAX_ROWS + 1)
      if (error) throw error

      const truncated = (data?.length ?? 0) > CUSTOMERS_INDEX_MAX_ROWS
      const page = truncated
        ? (data ?? []).slice(0, CUSTOMERS_INDEX_MAX_ROWS)
        : Array.isArray(data)
          ? data
          : []

      // Normalize crew_pricing_level (PostgREST may return as array)
      const normalized: Array<CustomerRow> = page.map((row) => {
        const { crew_pricing_level, ...rest } = row as CustomerRow & {
          crew_pricing_level?: unknown
        }
        return {
          ...rest,
          crew_pricing_level:
            unwrapRelation<CrewPricingLevelInfo>(crew_pricing_level),
        }
      })

      // Apply client-side fuzzy matching for better results
      // This handles cases where database ilike isn't fuzzy enough
      if (search && search.trim()) {
        const { fuzzySearch } = await import('@shared/lib/generalFunctions')
        return {
          rows: fuzzySearch(
            normalized,
            search,
            [
              (item) => item.name,
              (item) => item.vat_number,
              (item) => item.address,
            ],
            0.25, // Lower threshold since we already filtered with ilike
          ),
          truncated,
        }
      }

      return { rows: normalized, truncated }
    },
  }
}

/* ---------- detail ---------- */
export function customerDetailQuery({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) {
  return {
    queryKey: ['company', companyId, 'customer-detail', id] as const,
    queryFn: async (): Promise<
      CustomerRow & { contacts: Array<ContactRow> }
    > => {
      const { data: c, error } = await supabase
        .from('customers')
        .select(
          `id, company_id, name, email, phone, address, vat_number, is_partner, logo_path, accent_color, accent_color_custom, crew_pricing_level_id, discount_percent, created_at,
          conta_customer_id, conta_days_until_payment_reminder, conta_days_until_estimate_overdue,
          conta_invoice_delivery_method, conta_invoice_count, conta_total_invoiced, conta_total_unpaid,
          conta_last_synced_at,
          crew_pricing_level:crew_pricing_level_id (id, name, crew_rate_per_day, crew_rate_per_hour)`,
        )
        .eq('company_id', companyId)
        .eq('id', id)
        .or('deleted.is.null,deleted.eq.false')
        .maybeSingle()
      if (error) throw error
      if (!c) throw new Error('Not found')

      const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('id, customer_id, name, email, phone, title, notes, created_at')
        .eq('customer_id', id)
        .order('name', { ascending: true })
      if (cErr) throw cErr

      const raw = c as CustomerRow & { crew_pricing_level?: unknown }
      return {
        ...raw,
        crew_pricing_level: unwrapRelation<CrewPricingLevelInfo>(
          raw.crew_pricing_level,
        ),
        contacts: (contacts ?? []) as Array<ContactRow>,
      }
    },
  }
}

/* ---------- create/update customer ---------- */
export async function upsertCustomer(payload: {
  id?: string
  company_id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  vat_number?: string | null
  is_partner?: boolean
  logo_path?: string | null
  accent_color?: string | null
  accent_color_custom?: string | null
  crew_pricing_level_id?: string | null
  discount_percent?: number | null
}) {
  const body: {
    company_id: string
    name: string
    address: string | null
    vat_number: string | null
    is_partner: boolean
    logo_path: string | null
    accent_color?: string | null
    accent_color_custom?: string | null
    crew_pricing_level_id?: string | null
    discount_percent?: number | null
    email?: string | null
    phone?: string | null
  } = {
    company_id: payload.company_id,
    name: payload.name.trim(),
    address: payload.address ?? null,
    vat_number: payload.vat_number ?? null,
    is_partner: !!payload.is_partner,
    logo_path: payload.logo_path ?? null,
  }
  // Important: only set email/phone if explicitly provided.
  // This prevents unrelated updates (e.g., logo upload) from wiping existing values.
  if (payload.email !== undefined) body.email = payload.email
  if (payload.phone !== undefined) body.phone = payload.phone
  if (payload.crew_pricing_level_id !== undefined)
    body.crew_pricing_level_id = payload.crew_pricing_level_id
  if (payload.discount_percent !== undefined)
    body.discount_percent = payload.discount_percent
  if (payload.accent_color !== undefined)
    body.accent_color = payload.accent_color
  if (payload.accent_color_custom !== undefined)
    body.accent_color_custom = payload.accent_color_custom
  if (payload.id) {
    const { error } = await supabase
      .from('customers')
      .update(body)
      .eq('id', payload.id)
      .eq('company_id', payload.company_id)
    if (error) throw error
    return { id: payload.id }
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(body)
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

/* ---------- contacts CRUD ---------- */
export async function addContact(payload: {
  company_id: string
  customer_id: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}) {
  const { error } = await supabase.from('contacts').insert({
    company_id: payload.company_id,
    customer_id: payload.customer_id,
    name: payload.name.trim(),
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    title: payload.title ?? null,
    notes: payload.notes ?? null,
  })
  if (error) throw error
}

export async function updateContact(payload: {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}) {
  const { id, ...rest } = payload
  const update: {
    name?: string
    email?: string | null
    phone?: string | null
    title?: string | null
    notes?: string | null
  } = {}
  if (rest.name !== undefined && rest.name !== null) update.name = rest.name
  if (rest.email !== undefined) update.email = rest.email
  if (rest.phone !== undefined) update.phone = rest.phone
  if (rest.title !== undefined) update.title = rest.title
  if (rest.notes !== undefined) update.notes = rest.notes

  const { error } = await supabase.from('contacts').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteContact(payload: { id: string }) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', payload.id)
  if (error) throw error
}

/* ---------- delete customer ---------- */
export async function deleteCustomer(payload: {
  companyId: string
  id: string
}) {
  const { error } = await supabase
    .from('customers')
    .update({ deleted: true })
    .eq('id', payload.id)
    .eq('company_id', payload.companyId)
  if (error) throw error
}

/* ---------- recent jobs for customer ---------- */
export function customerRecentJobsQuery({
  companyId,
  customerId,
}: {
  companyId: string
  customerId: string
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'customer-recent-jobs',
      customerId,
    ] as const,
    queryFn: async (): Promise<
      Array<{
        id: string
        title: string
        status: string
        start_at: string | null
        end_at: string | null
      }>
    > => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status, start_at, end_at')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('start_at', { ascending: false, nullsFirst: false })
        .limit(3)
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        title: string
        status: string
        start_at: string | null
        end_at: string | null
      }>
    },
  }
}
