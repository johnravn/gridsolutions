import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'

export function useDemoMode() {
  const { company } = useCompany()

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user ?? null
    },
  })

  const isAnonymous = authUser?.is_anonymous === true
  const isDemoCompany = company?.is_demo === true
  const isDemoMode = isAnonymous && isDemoCompany

  return {
    isDemoMode,
    isAnonymous,
    isDemoCompany,
  }
}
