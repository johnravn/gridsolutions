import { format } from 'date-fns'
import { supabase } from '@shared/api/supabase'

export type ActiveRecurringJob = {
  id: string
  title: string
  period_start: string
  period_end: string | null
  project_lead?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export function activeRecurringJobsQuery({ companyId }: { companyId: string }) {
  const today = format(new Date(), 'yyyy-MM-dd')

  return {
    queryKey: ['home', companyId, 'active-recurring-jobs', today] as const,
    queryFn: async (): Promise<Array<ActiveRecurringJob>> => {
      const { data, error } = await supabase
        .from('recurring_jobs')
        .select(
          `
          id, title, period_start, period_end,
          project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('company_id', companyId)
        .eq('archived', false)
        .not('period_start', 'is', null)
        .lte('period_start', today)
        .or(`period_end.is.null,period_end.gte.${today}`)
        .order('title', { ascending: true })

      if (error) throw error

      return data as unknown as Array<ActiveRecurringJob>
    },
    staleTime: 60_000,
  }
}
