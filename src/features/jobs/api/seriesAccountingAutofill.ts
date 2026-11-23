import { supabase } from '@shared/api/supabase'
import {
  
  deleteJobMoneyItem,
  insertJobMoneyItem
} from './moneyQueries'
import type {JobMoneyItemInsert} from './moneyQueries';
import type {
  AutofillCrewBooking,
  AutofillExistingMoneyItem,
} from '../utils/seriesAccountingAutofill'
import type { CompanyGeneralRates } from '../utils/moneySuggestions'

export async function fetchCompanyGeneralRates(
  companyId: string,
): Promise<CompanyGeneralRates | null> {
  const { data, error } = await supabase
    .from('companies')
    .select(
      'employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate',
    )
    .eq('id', companyId)
    .single()
  if (error) throw error
  return data
}

export async function fetchExistingMoneyItemsForJobs(
  jobIds: ReadonlyArray<string>,
): Promise<Array<AutofillExistingMoneyItem>> {
  if (jobIds.length === 0) return []
  const { data, error } = await supabase
    .from('job_money_items')
    .select('id, job_id, source_id')
    .in('job_id', [...jobIds])
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    job_id: row.job_id,
    source_id: row.source_id ?? null,
  }))
}

/**
 * Load reserved crew bookings for many jobs (same shape MoneyTab uses per job).
 */
export async function fetchCrewBookingsForJobs({
  companyId,
  jobIds,
}: {
  companyId: string
  jobIds: ReadonlyArray<string>
}): Promise<Array<AutofillCrewBooking>> {
  if (jobIds.length === 0) return []

  const { data: timePeriods, error: tpError } = await supabase
    .from('time_periods')
    .select('id, job_id, start_at, end_at')
    .in('job_id', [...jobIds])
    .eq('category', 'crew')

  if (tpError) throw tpError
  if (!timePeriods?.length) return []

  const timePeriodIds = timePeriods.map((tp) => tp.id)
  const { data: reservedCrew, error: crewError } = await supabase
    .from('reserved_crew')
    .select(
      `
      id,
      user_id,
      placeholder_name,
      time_period_id,
      user:user_id (
        user_id,
        display_name,
        email
      )
    `,
    )
    .in('time_period_id', timePeriodIds)

  if (crewError) throw crewError
  if (!reservedCrew?.length) return []

  const userIds = reservedCrew
    .map((rc) => rc.user_id)
    .filter((id): id is string => !!id)

  let companyUsers: Array<{
    user_id: string
    role: string | null
    rate_type: string | null
    rate: number | null
    vat_number: string | null
  }> = []

  if (userIds.length > 0) {
    const { data, error: cuError } = await supabase
      .from('company_user_profiles')
      .select('user_id, role, rate_type, rate, vat_number')
      .eq('company_id', companyId)
      .in('user_id', userIds)
    if (cuError) throw cuError
    companyUsers = (data ?? []).flatMap((cu) => {
      if (!cu.user_id) return []
      return [
        {
          user_id: cu.user_id,
          role: cu.role ?? null,
          rate_type: cu.rate_type ?? null,
          rate: cu.rate != null ? Number(cu.rate) : null,
          vat_number: cu.vat_number ?? null,
        },
      ]
    })
  }

  const userRatesMap = new Map(companyUsers.map((cu) => [cu.user_id, cu]))
  const tpById = new Map(timePeriods.map((tp) => [tp.id, tp]))

  return reservedCrew.flatMap((rc) => {
    const timePeriod = tpById.get(rc.time_period_id)
    if (!timePeriod?.job_id) return []
    const userRaw = rc.user
    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw
    const companyUser = rc.user_id ? userRatesMap.get(rc.user_id) : undefined
    return [
      {
        id: rc.id,
        job_id: timePeriod.job_id,
        user_name:
          user?.display_name || user?.email || rc.placeholder_name || 'Unknown',
        role: companyUser?.role ?? null,
        rate: companyUser?.rate ?? null,
        rate_type: companyUser?.rate_type ?? null,
        vat_number: companyUser?.vat_number ?? null,
        start_at: timePeriod.start_at,
        end_at: timePeriod.end_at,
      },
    ]
  })
}

export async function applySeriesAccountingAutofill({
  deletes,
  inserts,
}: {
  deletes: ReadonlyArray<string>
  inserts: ReadonlyArray<JobMoneyItemInsert>
}): Promise<{ deleted: number; inserted: number }> {
  for (const id of deletes) {
    await deleteJobMoneyItem(id)
  }
  for (const payload of inserts) {
    await insertJobMoneyItem(payload)
  }
  return { deleted: deletes.length, inserted: inserts.length }
}
