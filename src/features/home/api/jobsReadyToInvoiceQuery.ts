import { supabase } from '@shared/api/supabase'
import type { HomeJobReadyToInvoice } from '../types'

export function jobsReadyToInvoiceQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return {
    queryKey: ['home', companyId, 'jobs-ready-to-invoice', userId] as const,
    queryFn: async (): Promise<Array<HomeJobReadyToInvoice>> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          jobnr,
          start_at,
          end_at,
          customer:customer_id ( id, name )
        `,
        )
        .eq('company_id', companyId)
        .eq('project_lead_user_id', userId)
        .eq('status', 'completed')
        .eq('archived', false)
        .order('start_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Array<HomeJobReadyToInvoice>
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  }
}
