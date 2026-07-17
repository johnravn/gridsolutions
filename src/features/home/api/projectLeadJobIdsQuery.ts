import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export function projectLeadJobIdsQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return queryOptions<Array<string>>({
    queryKey: ['home', companyId, 'project-lead-job-ids', userId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)
        .eq('project_lead_user_id', userId)
        .eq('archived', false)

      if (error) throw error
      return (data ?? []).map((row) => row.id)
    },
    enabled: !!companyId && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
