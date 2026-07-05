// src/shared/auth/useAuthz.ts
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { capabilitiesFor } from './permissions'
import type { Capability, CapabilitySet, CompanyRole } from './permissions'

type AuthzData = {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null
  caps: CapabilitySet
  userId: string | null
}

export function useAuthz() {
  const { companyId } = useCompany()

  // Get user from shared query cache
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user ?? null
    },
  })
  const userId = user?.id ?? null

  // Fetch authorization data
  const { data, isLoading } = useQuery<AuthzData>({
    queryKey: ['authz', userId, companyId],
    enabled: !!userId,
    queryFn: async () => {
      let isGlobalSuperuser = false
      let companyRole: CompanyRole | null = null

      // profiles.superuser
      const { data: prof, error: perr } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', userId!)
        .maybeSingle()

      if (!perr && prof) isGlobalSuperuser = !!prof.superuser

      // company role for current company
      if (companyId) {
        const { data: cu, error: cerr } = await supabase
          .from('company_users')
          .select('role')
          .eq('user_id', userId!)
          .eq('company_id', companyId)
          .maybeSingle()

        if (!cerr && cu?.role) companyRole = cu.role as CompanyRole
      }

      const caps = capabilitiesFor({ isGlobalSuperuser, companyRole })

      // Special case: Grant 'visit:latest' to freelancers when toggle is enabled
      if (
        companyId &&
        companyRole === 'freelancer' &&
        !caps.has('visit:latest')
      ) {
        const { data: expansions, error: expErr } = await supabase
          .from('company_expansions')
          .select('latest_feed_open_to_freelancers')
          .eq('company_id', companyId)
          .maybeSingle()

        if (!expErr && expansions?.latest_feed_open_to_freelancers === true) {
          caps.add('visit:latest')
        }
      }

      return {
        isGlobalSuperuser,
        companyRole,
        caps,
        userId,
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  // While authz is loading, `data` stays undefined — avoid returning a fresh `new Set()` every
  // render (unstable reference → needless child rerenders / effect churn, e.g. RequireCap deps).
  const caps = React.useMemo((): CapabilitySet => {
    if (data?.caps) return data.caps
    return new Set<Capability>()
  }, [data])

  return {
    loading: isLoading,
    isGlobalSuperuser: data?.isGlobalSuperuser ?? false,
    companyRole: data?.companyRole ?? null,
    caps,
    userId: data?.userId ?? null,
  }
}
