// src/features/jobs/api/moneyQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  JOB_MONEY_VERIFY_STATUSES,
  JOB_MONEY_VERIFY_STATUS_HINT,
  SERIES_MONEY_VERIFY_STATUS_HINT,
  isJobStatusEligibleForMoneyVerify,
  isSeriesEligibleForMoneyVerify,
} from '../utils/moneyVerifyStatus'

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
  job_id: string | null
  recurring_job_id: string | null
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
  /** Exactly one of job_id / recurring_job_id must be set. */
  job_id?: string | null
  recurring_job_id?: string | null
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
  type?: JobMoneyItemType
  description?: string
  amount?: number
  date?: string | null
  reference?: string | null
  category?: JobMoneyItemCategory | null
}

function mapMoneyItemRow(row: Record<string, unknown>): JobMoneyItem {
  return {
    id: row.id as string,
    job_id: (row.job_id as string | null) ?? null,
    recurring_job_id: (row.recurring_job_id as string | null) ?? null,
    company_id: row.company_id as string,
    type: row.type as JobMoneyItemType,
    description: row.description as string,
    amount: Number(row.amount),
    date: (row.date as string | null) ?? null,
    reference: (row.reference as string | null) ?? null,
    source: row.source as JobMoneyItemSource,
    source_id: (row.source_id as string | null) ?? null,
    category: (row.category as JobMoneyItemCategory | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
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
      return (data ?? []).map((row) =>
        mapMoneyItemRow(row as Record<string, unknown>),
      )
    },
  })
}

export function recurringJobMoneyItemsQuery(recurringJobId: string) {
  return queryOptions<Array<JobMoneyItem>>({
    queryKey: ['recurring-jobs', recurringJobId, 'money-items'],
    queryFn: async (): Promise<Array<JobMoneyItem>> => {
      const { data, error } = await supabase
        .from('job_money_items')
        .select('*')
        .eq('recurring_job_id', recurringJobId)
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row) =>
        mapMoneyItemRow(row as Record<string, unknown>),
      )
    },
  })
}

export async function insertJobMoneyItem(
  payload: JobMoneyItemInsert,
): Promise<string> {
  const jobId = payload.job_id ?? null
  const recurringJobId = payload.recurring_job_id ?? null
  if ((jobId == null) === (recurringJobId == null)) {
    throw new Error(
      'Money item requires exactly one of job_id or recurring_job_id',
    )
  }

  const { data, error } = await supabase
    .from('job_money_items')
    .insert({
      job_id: jobId,
      recurring_job_id: recurringJobId,
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
  status: string
}

export function jobMoneyVerificationQuery(jobId: string) {
  return queryOptions<JobMoneyVerification>({
    queryKey: ['jobs', jobId, 'money-verification'],
    queryFn: async (): Promise<JobMoneyVerification> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'money_verified_at, money_verified_by, project_lead_user_id, status',
        )
        .eq('id', jobId)
        .single()
      if (error) throw error
      return {
        money_verified_at: data.money_verified_at ?? null,
        money_verified_by: data.money_verified_by ?? null,
        project_lead_user_id: data.project_lead_user_id ?? null,
        status: data.status,
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
  if (verified) {
    const { data: job, error: statusError } = await supabase
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single()
    if (statusError) throw statusError
    if (!isJobStatusEligibleForMoneyVerify(job.status)) {
      throw new Error(JOB_MONEY_VERIFY_STATUS_HINT)
    }
  }

  let query = supabase
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

  // Race-safe: only set verified when status still allows it.
  if (verified) {
    query = query.in('status', [...JOB_MONEY_VERIFY_STATUSES])
  }

  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (verified && !data) {
    throw new Error(JOB_MONEY_VERIFY_STATUS_HINT)
  }
}

export type SeriesMoneyVerification = {
  money_verified_at: string | null
  money_verified_by: string | null
  project_lead_user_id: string | null
  accounting_mode: 'per_job' | 'combined'
  /** Child job statuses used for the combined verify gate. */
  child_statuses: Array<string>
}

export function seriesMoneyVerificationQuery(recurringJobId: string) {
  return queryOptions<SeriesMoneyVerification>({
    queryKey: ['recurring-jobs', recurringJobId, 'money-verification'],
    queryFn: async (): Promise<SeriesMoneyVerification> => {
      const { data, error } = await supabase
        .from('recurring_jobs')
        .select(
          'money_verified_at, money_verified_by, project_lead_user_id, accounting_mode',
        )
        .eq('id', recurringJobId)
        .single()
      if (error) throw error

      const { data: children, error: childrenError } = await supabase
        .from('jobs')
        .select('status')
        .eq('recurring_job_id', recurringJobId)
        .eq('archived', false)
      if (childrenError) throw childrenError

      return {
        money_verified_at: data.money_verified_at ?? null,
        money_verified_by: data.money_verified_by ?? null,
        project_lead_user_id: data.project_lead_user_id ?? null,
        accounting_mode:
          (data.accounting_mode as 'per_job' | 'combined' | null) ?? 'per_job',
        child_statuses: (children ?? []).map((c) => c.status),
      }
    },
  })
}

export async function setSeriesMoneyVerified({
  recurringJobId,
  verified,
  userId,
}: {
  recurringJobId: string
  verified: boolean
  userId: string
}): Promise<void> {
  if (verified) {
    const { data: children, error: childrenError } = await supabase
      .from('jobs')
      .select('status')
      .eq('recurring_job_id', recurringJobId)
      .eq('archived', false)
    if (childrenError) throw childrenError
    const statuses = (children ?? []).map((c) => c.status)
    if (!isSeriesEligibleForMoneyVerify(statuses)) {
      throw new Error(SERIES_MONEY_VERIFY_STATUS_HINT)
    }
  }

  const { error } = await supabase
    .from('recurring_jobs')
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
    .eq('id', recurringJobId)

  if (error) throw error
}
