import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { rankRecentCustomerCrew } from '../utils/rankRecentCustomerCrew'
import type {
  RecentCustomerCrewBooking,
  RecentCustomerCrewPerson,
} from '../utils/rankRecentCustomerCrew'

const RECENT_CUSTOMER_JOB_LIMIT = 40

function unwrapProfile(user: unknown): {
  user_id: string
  display_name: string | null
  email: string
} | null {
  if (user == null) return null
  const row = Array.isArray(user) ? user[0] : user
  if (!row || typeof row !== 'object') return null
  const profile = row as {
    user_id?: unknown
    display_name?: unknown
    email?: unknown
  }
  if (typeof profile.user_id !== 'string' || !profile.user_id) return null
  return {
    user_id: profile.user_id,
    display_name:
      typeof profile.display_name === 'string' ? profile.display_name : null,
    email: typeof profile.email === 'string' ? profile.email : '',
  }
}

export function recentCustomerCrewQuery({
  companyId,
  customerId,
}: {
  companyId: string
  customerId: string
}) {
  return queryOptions<Array<RecentCustomerCrewPerson>>({
    queryKey: ['jobs', 'recent-customer-crew', companyId, customerId],
    queryFn: async () => {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('start_at', { ascending: false, nullsFirst: false })
        .limit(RECENT_CUSTOMER_JOB_LIMIT)

      if (jobsError) throw jobsError
      const jobIds = (jobs ?? []).map((job) => job.id)
      if (jobIds.length === 0) return []

      const { data: periods, error: periodsError } = await supabase
        .from('time_periods')
        .select('id, start_at')
        .in('job_id', jobIds)
        .eq('category', 'crew')
        .eq('deleted', false)

      if (periodsError) throw periodsError
      const periodList = periods ?? []
      if (periodList.length === 0) return []

      const startAtByPeriodId = new Map<string, string | null>()
      for (const period of periodList) {
        startAtByPeriodId.set(period.id, period.start_at)
      }

      const { data: crew, error: crewError } = await supabase
        .from('reserved_crew')
        .select(
          `
          user_id, status, time_period_id,
          user:user_id ( user_id, display_name, email )
        `,
        )
        .in(
          'time_period_id',
          periodList.map((period) => period.id),
        )
        .not('user_id', 'is', null)
        .in('status', ['confirmed', 'planned'])

      if (crewError) throw crewError

      const bookings: Array<RecentCustomerCrewBooking> = []
      for (const row of crew ?? []) {
        if (!row.user_id) continue
        const profile = unwrapProfile((row as { user?: unknown }).user)
        bookings.push({
          user_id: row.user_id,
          display_name: profile?.display_name ?? null,
          email: profile?.email ?? '',
          status: row.status,
          start_at: startAtByPeriodId.get(row.time_period_id) ?? null,
        })
      }

      return rankRecentCustomerCrew(bookings)
    },
    staleTime: 30_000,
  })
}
