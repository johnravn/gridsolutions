// src/features/jobs/api/moneyQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type JobMoneyItemSource =
  | 'offer'
  | 'crew'
  | 'conta'
  | 'manual'
  | 'logging'
export type JobMoneyItemType = 'income' | 'expense'
export type JobMoneyItemCategory =
  | 'crew'
  | 'equipment'
  | 'conta'
  | 'transport'
  | 'other'

export type JobMoneyItem = {
  id: string
  job_id: string
  company_id: string
  type: JobMoneyItemType
  description: string
  amount: number
  date: string | null
  reference: string | null
  source: JobMoneyItemSource
  source_id: string | null
  category: JobMoneyItemCategory | null
  created_at: string
  updated_at: string
}

export type JobMoneyItemInsert = {
  job_id: string
  company_id: string
  type: JobMoneyItemType
  description: string
  amount: number
  date?: string | null
  reference?: string | null
  source: JobMoneyItemSource
  source_id?: string | null
  category?: JobMoneyItemCategory | null
}

export type JobMoneyItemUpdate = {
  description?: string
  amount?: number
  date?: string | null
  reference?: string | null
  category?: JobMoneyItemCategory | null
}

export function jobMoneyItemsQuery(jobId: string) {
  return queryOptions<Array<JobMoneyItem>>({
    queryKey: ['jobs', jobId, 'money-items'],
    queryFn: async (): Promise<Array<JobMoneyItem>> => {
      const { data, error } = await supabase
        .from('job_money_items')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row) => ({
        ...row,
        type: row.type as JobMoneyItemType,
        source: row.source as JobMoneyItemSource,
        category: (row.category as JobMoneyItemCategory | null) ?? null,
        amount: Number(row.amount),
      }))
    },
  })
}

export async function insertJobMoneyItem(
  payload: JobMoneyItemInsert,
): Promise<string> {
  const { data, error } = await supabase
    .from('job_money_items')
    .insert({
      job_id: payload.job_id,
      company_id: payload.company_id,
      type: payload.type,
      description: payload.description,
      amount: payload.amount,
      date: payload.date ?? null,
      reference: payload.reference ?? null,
      source: payload.source,
      source_id: payload.source_id ?? null,
      category: payload.category ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateJobMoneyItem(
  id: string,
  payload: JobMoneyItemUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('job_money_items')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

export async function deleteJobMoneyItem(id: string): Promise<void> {
  const { error } = await supabase.from('job_money_items').delete().eq('id', id)
  if (error) throw error
}

/** Find a money item by job + source_id (e.g. transport-km for Save km upsert). */
export async function findJobMoneyItemBySourceId(
  jobId: string,
  sourceId: string,
): Promise<Pick<JobMoneyItem, 'id'> | null> {
  const { data, error } = await supabase
    .from('job_money_items')
    .select('id')
    .eq('job_id', jobId)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Insert or update the transport-km expense for a job.
 * Returns 'inserted' | 'updated'. Caller supplies amount/description.
 */
export async function upsertJobMoneyItemBySourceId(input: {
  jobId: string
  companyId: string
  sourceId: string
  type: JobMoneyItemType
  description: string
  amount: number
  date?: string | null
  reference?: string | null
  source: JobMoneyItemSource
  category?: JobMoneyItemCategory | null
}): Promise<'inserted' | 'updated'> {
  const existing = await findJobMoneyItemBySourceId(input.jobId, input.sourceId)
  if (existing) {
    await updateJobMoneyItem(existing.id, {
      description: input.description,
      amount: input.amount,
      date: input.date ?? null,
      reference: input.reference ?? null,
      category: input.category ?? null,
    })
    return 'updated'
  }
  await insertJobMoneyItem({
    job_id: input.jobId,
    company_id: input.companyId,
    type: input.type,
    description: input.description,
    amount: input.amount,
    date: input.date ?? null,
    reference: input.reference ?? null,
    source: input.source,
    source_id: input.sourceId,
    category: input.category ?? null,
  })
  return 'inserted'
}

/** Delete money items for a job matching source_id (idempotent). */
export async function deleteJobMoneyItemsBySourceId(
  jobId: string,
  sourceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('job_money_items')
    .delete()
    .eq('job_id', jobId)
    .eq('source_id', sourceId)
  if (error) throw error
}

/** Phase 2 UX will edit this; Phase 1 exposes the writer for Money transport suggestions. */
export async function updateJobTransportKmDriven(
  jobId: string,
  kmDriven: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      transport_km_driven: kmDriven,
      // Km changes the Money picture — clear lead verification.
      money_verified_at: null,
      money_verified_by: null,
    })
    .eq('id', jobId)
  if (error) throw error
}

export type JobMoneyVerification = {
  money_verified_at: string | null
  money_verified_by: string | null
  project_lead_user_id: string | null
}

export function jobMoneyVerificationQuery(jobId: string) {
  return queryOptions<JobMoneyVerification>({
    queryKey: ['jobs', jobId, 'money-verification'],
    queryFn: async (): Promise<JobMoneyVerification> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('money_verified_at, money_verified_by, project_lead_user_id')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return {
        money_verified_at: data.money_verified_at ?? null,
        money_verified_by: data.money_verified_by ?? null,
        project_lead_user_id: data.project_lead_user_id ?? null,
      }
    },
  })
}

/** Project lead (or company owner/super_user) marks Money as correct. */
export async function setJobMoneyVerified({
  jobId,
  verified,
  userId,
}: {
  jobId: string
  verified: boolean
  userId: string
}): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update(
      verified
        ? {
            money_verified_at: new Date().toISOString(),
            money_verified_by: userId,
          }
        : {
            money_verified_at: null,
            money_verified_by: null,
          },
    )
    .eq('id', jobId)
  if (error) throw error
}
