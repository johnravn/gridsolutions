// src/features/jobs/api/moneyQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type JobMoneyItemSource = 'offer' | 'crew' | 'conta' | 'manual'
export type JobMoneyItemType = 'income' | 'expense'

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
}

export type JobMoneyItemUpdate = {
  description?: string
  amount?: number
  date?: string | null
  reference?: string | null
}

export function jobMoneyItemsQuery(jobId: string) {
  return queryOptions<JobMoneyItem[]>({
    queryKey: ['jobs', jobId, 'money-items'],
    queryFn: async (): Promise<JobMoneyItem[]> => {
      const { data, error } = await supabase
        .from('job_money_items')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as JobMoneyItem[]
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
