import { supabase } from '@shared/api/supabase'

export type CustomerRow = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  vat_number: string | null
  is_partner: boolean
  logo_path: string | null
  created_at: string
}

export type ContactRow = {
  id: string
  customer_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  created_at: string
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
    queryFn: async (): Promise<Array<CustomerRow>> => {
      let q = supabase
        .from('customers')
        .select(
          'id, company_id, name, email, phone, address, vat_number, is_partner, logo_path, created_at',
        )
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')

      // Apply fuzzy search using expanded ilike patterns
      if (search && search.trim()) {
        const term = search.trim()
        // Use multiple patterns for fuzzy matching:
        // 1. Exact substring match
        // 2. Match with characters in order but possibly spaced (handles typos)
        const patterns = [
          `%${term}%`,
          term.length > 2 ? `%${term.split('').join('%')}%` : null,
        ].filter(Boolean) as Array<string>

        const conditions = patterns
          .map((pattern) => `name.ilike.${pattern}`)
          .join(',')
        q = q.or(conditions)
      }

      q = q.order('name', { ascending: true })

      if (showRegular && !showPartner) q = q.eq('is_partner', false)
      if (!showRegular && showPartner) q = q.eq('is_partner', true)
      // if both on -> no filter; if both off -> show none
      if (!showRegular && !showPartner) return []
      const { data, error } = await q
      if (error) throw error

      // Apply client-side fuzzy matching for better results
      // This handles cases where database ilike isn't fuzzy enough
      if (search && search.trim()) {
        const { fuzzySearch } = await import('@shared/lib/generalFunctions')
        return fuzzySearch(
          (data || []) as Array<CustomerRow>,
          search,
          [(item) => item.name, (item) => item.email, (item) => item.phone],
          0.25, // Lower threshold since we already filtered with ilike
        )
      }

      return data as any
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
          'id, company_id, name, email, phone, address, vat_number, is_partner, logo_path, created_at',
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

      return { ...(c as any), contacts: contacts as any }
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
}) {
  const body = {
    company_id: payload.company_id,
    name: payload.name.trim(),
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    vat_number: payload.vat_number ?? null,
    is_partner: !!payload.is_partner,
    logo_path: payload.logo_path ?? null,
  }
  if (payload.id) {
    const { error } = await supabase
      .from('customers')
      .update(body)
      .eq('id', payload.id)
      .eq('company_id', payload.company_id)
    if (error) throw error
    return
  } else {
    const { error } = await supabase.from('customers').insert(body)
    if (error) throw error
    return
  }
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
  const { error } = await supabase.from('contacts').update(rest).eq('id', id)
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
        .order('start_at', { ascending: false, nullsLast: true })
        .limit(3)
      if (error) throw error
      return (data || []) as any
    },
  }
}
