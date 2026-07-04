import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type JobSubcontractorRow = {
  id: string
  job_id: string
  customer_id: string
  notes: string | null
  created_at: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
}

export type SubrentalBookingRow = {
  id: string
  quantity: number
  external_status: string | null
  external_note: string | null
  subcontractor_id: string | null
  subcontractor_name: string | null
  item_id: string
  item_name: string
  time_period_id: string
  period_title: string | null
  period_start_at: string | null
  period_end_at: string | null
}

export const jobSubcontractorsKey = (jobId: string) =>
  ['jobs', jobId, 'subcontractors'] as const

export const jobSubrentalBookingsKey = (jobId: string) =>
  ['jobs', jobId, 'subrental-bookings'] as const

export const jobSubcontractorsQuery = ({ jobId }: { jobId: string }) =>
  queryOptions({
    queryKey: jobSubcontractorsKey(jobId),
    queryFn: async (): Promise<Array<JobSubcontractorRow>> => {
      const { data, error } = await supabase
        .from('job_subcontractors')
        .select(
          `
          id,
          job_id,
          customer_id,
          notes,
          created_at,
          customer:customer_id ( id, name, email, phone )
        `,
        )
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => ({
        ...row,
        customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
      })) as Array<JobSubcontractorRow>
    },
    enabled: !!jobId,
    staleTime: 10_000,
  })

export const jobSubrentalBookingsQuery = ({ jobId }: { jobId: string }) =>
  queryOptions({
    queryKey: jobSubrentalBookingsKey(jobId),
    queryFn: async (): Promise<Array<SubrentalBookingRow>> => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'equipment')
      if (tpErr) throw tpErr

      const periodIds = (timePeriods ?? []).map((tp) => tp.id)
      if (periodIds.length === 0) return []

      const periodById = new Map((timePeriods ?? []).map((tp) => [tp.id, tp]))

      const { data: reservations, error: riErr } = await supabase
        .from('reserved_items')
        .select(
          `
          id,
          quantity,
          external_status,
          external_note,
          subcontractor_id,
          item_id,
          time_period_id,
          item:item_id ( id, name, item_kind ),
          subcontractor:subcontractor_id ( id, name )
        `,
        )
        .in('time_period_id', periodIds)
        .neq('status', 'canceled')
      if (riErr) throw riErr

      return (reservations ?? [])
        .filter((row) => {
          const item = Array.isArray(row.item) ? row.item[0] : row.item
          return item?.item_kind === 'subrental'
        })
        .map((row) => {
          const item = Array.isArray(row.item) ? row.item[0] : row.item
          const subcontractor = Array.isArray(row.subcontractor)
            ? row.subcontractor[0]
            : row.subcontractor
          const period = periodById.get(row.time_period_id)
          return {
            id: row.id,
            quantity: row.quantity,
            external_status: row.external_status,
            external_note: row.external_note,
            subcontractor_id: row.subcontractor_id,
            subcontractor_name: subcontractor?.name ?? null,
            item_id: row.item_id,
            item_name: item?.name ?? 'Unknown item',
            time_period_id: row.time_period_id,
            period_title: period?.title ?? null,
            period_start_at: period?.start_at ?? null,
            period_end_at: period?.end_at ?? null,
          }
        })
    },
    enabled: !!jobId,
    staleTime: 10_000,
  })

export async function addJobSubcontractor({
  jobId,
  customerId,
  notes,
}: {
  jobId: string
  customerId: string
  notes?: string | null
}) {
  const { data: customer, error: customerErr } = await supabase
    .from('customers')
    .select('id, is_partner')
    .eq('id', customerId)
    .maybeSingle()
  if (customerErr) throw customerErr
  if (!customer?.is_partner) {
    throw new Error('Only partner customers can be added as subcontractors')
  }

  const { data, error } = await supabase
    .from('job_subcontractors')
    .insert({
      job_id: jobId,
      customer_id: customerId,
      notes: notes ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function removeJobSubcontractor(subcontractorRowId: string) {
  const { error } = await supabase
    .from('job_subcontractors')
    .delete()
    .eq('id', subcontractorRowId)
  if (error) throw error
}

export async function updateJobSubcontractorNotes({
  id,
  notes,
}: {
  id: string
  notes: string | null
}) {
  const { error } = await supabase
    .from('job_subcontractors')
    .update({ notes })
    .eq('id', id)
  if (error) throw error
}

export async function assignSubrentalBookingSubcontractor({
  reservedItemId,
  subcontractorId,
}: {
  reservedItemId: string
  subcontractorId: string | null
}) {
  const { error } = await supabase
    .from('reserved_items')
    .update({ subcontractor_id: subcontractorId })
    .eq('id', reservedItemId)
  if (error) throw error
}

export type JobSubcontractorQuoteRow = {
  id: string
  job_id: string
  job_subcontractor_id: string
  version_number: number
  total_amount: number
  note: string | null
  pdf_path: string | null
  pdf_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export const jobSubcontractorQuotesKey = (
  jobId: string,
  jobSubcontractorId?: string,
) =>
  ['jobs', jobId, 'subcontractor-quotes', jobSubcontractorId ?? 'all'] as const

export const jobSubcontractorQuotesQuery = ({
  jobId,
  jobSubcontractorId,
}: {
  jobId: string
  jobSubcontractorId?: string
}) =>
  queryOptions({
    queryKey: jobSubcontractorQuotesKey(jobId, jobSubcontractorId),
    queryFn: async (): Promise<Array<JobSubcontractorQuoteRow>> => {
      let query = supabase
        .from('job_subcontractor_quotes')
        .select('*')
        .eq('job_id', jobId)
        .order('version_number', { ascending: false })

      if (jobSubcontractorId) {
        query = query.eq('job_subcontractor_id', jobSubcontractorId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Array<JobSubcontractorQuoteRow>
    },
    enabled: !!jobId,
    staleTime: 10_000,
  })

export async function createJobSubcontractorQuote({
  jobId,
  jobSubcontractorId,
  totalAmount,
  note,
  pdfPath,
  pdfFilename,
  mimeType,
  sizeBytes,
}: {
  jobId: string
  jobSubcontractorId: string
  totalAmount: number
  note?: string | null
  pdfPath?: string | null
  pdfFilename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
}) {
  const { data: latest, error: latestError } = await supabase
    .from('job_subcontractor_quotes')
    .select('version_number')
    .eq('job_subcontractor_id', jobSubcontractorId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw latestError

  const versionNumber = (latest?.version_number ?? 0) + 1

  const { data, error } = await supabase
    .from('job_subcontractor_quotes')
    .insert({
      job_id: jobId,
      job_subcontractor_id: jobSubcontractorId,
      version_number: versionNumber,
      total_amount: totalAmount,
      note: note ?? null,
      pdf_path: pdfPath ?? null,
      pdf_filename: pdfFilename ?? null,
      mime_type: mimeType ?? null,
      size_bytes: sizeBytes ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function uploadJobSubcontractorQuotePdf({
  companyId,
  jobId,
  jobSubcontractorId,
  file,
}: {
  companyId: string
  jobId: string
  jobSubcontractorId: string
  file: File
}): Promise<{
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const timestamp = Date.now()
  const filename = `${timestamp}.${ext}`
  const path = `${companyId}/${jobId}/${jobSubcontractorId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('pretty_offer_quotes')
    .upload(path, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type || 'application/pdf',
    })

  if (uploadError) throw uploadError

  return {
    path,
    filename: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
  }
}

export async function getJobSubcontractorQuotePdfUrl(
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('pretty_offer_quotes')
    .createSignedUrl(path, 3600)

  if (error) throw error
  return data.signedUrl
}
