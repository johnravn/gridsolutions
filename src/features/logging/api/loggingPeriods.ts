import { supabase } from '@shared/api/supabase'

export type LoggingPeriod = {
  id: string
  company_id: string
  period_start: string
  is_locked: boolean
  locked_at: string | null
  locked_by_user_id: string | null
  created_at: string
  updated_at: string | null
}

export function loggingPeriodsQuery({
  companyId,
  year,
}: {
  companyId: string
  year: number
}) {
  const from = `${year}-01-01`
  const to = `${year + 1}-01-01`

  return {
    queryKey: ['logging_periods', companyId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logging_periods')
        .select('*')
        .eq('company_id', companyId)
        .gte('period_start', from)
        .lt('period_start', to)
        .order('period_start', { ascending: true })

      if (error) throw error
      return (data ?? []) as Array<LoggingPeriod>
    },
  }
}

export async function setLoggingPeriodLock({
  companyId,
  periodStart,
  isLocked,
  lockedByUserId,
}: {
  companyId: string
  periodStart: string
  isLocked: boolean
  lockedByUserId: string | null
}) {
  const payload = {
    company_id: companyId,
    period_start: periodStart,
    is_locked: isLocked,
    locked_at: isLocked ? new Date().toISOString() : null,
    locked_by_user_id: isLocked ? lockedByUserId : null,
  }

  const { error } = await supabase
    .from('logging_periods')
    .upsert(payload, { onConflict: 'company_id,period_start' })

  if (error) throw error
}
