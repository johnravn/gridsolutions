import { supabase } from '@shared/api/supabase'
import type { HomeJobReadyToInvoice } from '../types'

/**
 * Paid/invoiced jobs for the current project lead that still need Accounting
 * verification — mirror of ready-to-invoice for clearing the verify queue.
 */
export function jobsAccountingUnverifiedQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return {
    queryKey: [
      'home',
      companyId,
      'jobs-accounting-unverified',
      userId,
    ] as const,
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
        .in('status', ['invoiced', 'paid'])
        .is('money_verified_at', null)
        .eq('archived', false)
        .order('start_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Array<HomeJobReadyToInvoice>
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  }
}
