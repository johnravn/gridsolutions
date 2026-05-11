// src/shared/companies/CompanyProvider.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyAppRealtimeSync } from '@shared/realtime/useCompanyAppRealtimeSync'
import { supabase } from '@shared/api/supabase'

type Company = { id: string; name: string }
type Ctx = {
  companies: Array<Company>
  companyId: string | null
  company: Company | null
  setCompanyId: (id: string) => void
  loading: boolean
}

const CompanyCtx = React.createContext<Ctx | null>(null)

/** Stable fallback so `companiesQ.data ?? X` does not allocate a new `[]` every render while loading. */
const EMPTY_COMPANIES: Array<Company> = []

function safeGetLS(key: string) {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSetLS(key: string, value: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {}
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  // 1) Who am I?
  const userQ = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
    staleTime: 60_000,
  })
  const userId = userQ.data?.id ?? null

  // Track previous userId to detect user changes
  const previousUserIdRef = React.useRef<string | null>(null)

  // Namespaced LS key per user to avoid cross-user leakage
  const lsKey = userId ? `selected-company-id:${userId}` : null

  // Local selected company id (fast path)
  const [companyId, setCompanyIdState] = React.useState<string | null>(null)

  // Initialize from localStorage when user becomes known, reset on user change
  React.useEffect(() => {
    const previousUserId = previousUserIdRef.current

    // If user changed to a different user (not just null), clear company state
    if (previousUserId && previousUserId !== userId && userId !== null) {
      // Invalidate all company-related queries for the old user
      qc.invalidateQueries({ queryKey: ['my-companies'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      setCompanyIdState(null)
    }

    if (!userId) {
      setCompanyIdState(null)
      previousUserIdRef.current = null
      return
    }

    // Only load from localStorage if this is the first time for this user
    // or if user changed (userId !== previousUserId)
    if (userId !== previousUserId) {
      const fromLS = lsKey ? safeGetLS(lsKey) : null
      setCompanyIdState(fromLS)
      previousUserIdRef.current = userId
    }
  }, [userId, lsKey, qc])

  // Cross-tab sync
  React.useEffect(() => {
    if (!lsKey) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== lsKey) return
      setCompanyIdState(e.newValue ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [lsKey])

  // 2) Company memberships (or all companies for superusers)
  const companiesQ = useQuery({
    queryKey: ['my-companies', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Array<Company>> => {
      // Check if user is a superuser
      const { data: profile } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', userId!)
        .maybeSingle()

      const isSuperuser = profile?.superuser ?? false

      if (isSuperuser) {
        // Superusers can access all companies
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name', { ascending: true })
        if (error) throw error
        return data as Array<Company>
      } else {
        // Regular users only see companies they're members of
        const { data, error } = await supabase
          .from('company_users')
          .select('companies ( id, name )')
          .eq('user_id', userId!)
        if (error) throw error
        return (data as Array<any>).map((r) => r.companies).filter(Boolean)
      }
    },
    staleTime: 60_000,
  })

  // 3) Server preference (column first; fallback to legacy preferences JSON)
  const serverPrefQ = useQuery({
    queryKey: ['profile', userId, 'selected-company-id'],
    enabled: !!userId && !!companiesQ.data?.length,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('selected_company_id, preferences')
        .eq('user_id', userId!)
        .maybeSingle<{
          selected_company_id: string | null
          preferences: Record<string, any> | null
        }>()
      if (error) throw error
      // Prefer the dedicated column; fall back to legacy JSON key if present.
      return (
        data?.selected_company_id ??
        data?.preferences?.selected_company_id ??
        null
      )
    },
    staleTime: 300_000,
  })

  // 4) Resolve an effective company id (priority: LS > server > first)
  const companies = companiesQ.data ?? EMPTY_COMPANIES
  const resolvedCompanyId = React.useMemo(() => {
    if (!companies.length) return null

    const server =
      serverPrefQ.data && companies.some((c) => c.id === serverPrefQ.data)
        ? serverPrefQ.data
        : null
    if (server) return server

    const ls =
      companyId && companies.some((c) => c.id === companyId) ? companyId : null
    if (ls) return ls

    return companies[0]?.id ?? null
  }, [companies, companyId, serverPrefQ.data])

  // Keep localStorage in sync with the resolved id
  React.useEffect(() => {
    if (!lsKey) return
    if (resolvedCompanyId !== companyId) {
      setCompanyIdState(resolvedCompanyId)
      safeSetLS(lsKey, resolvedCompanyId)
    }
  }, [lsKey, resolvedCompanyId, companyId])

  // 5) Persist to server whenever the selection changes
  const savePref = useMutation({
    mutationFn: async (id: string) => {
      // Write to the dedicated column.
      const { error } = await supabase
        .from('profiles')
        .update({ selected_company_id: id })
        .eq('user_id', userId!)
      if (error) throw error

      // (Optional) Clean up legacy preferences key if you want:
      // await supabase.rpc('remove_legacy_selected_company_from_preferences')
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['profile', userId, 'selected-company-id'],
      })
    },
  })

  const setCompanyId = (id: string) => {
    if (!companies.some((c) => c.id === id)) return // ignore invalid
    // update local fast path
    setCompanyIdState(id)
    if (lsKey) safeSetLS(lsKey, id)
    // persist to server
    if (userId) savePref.mutate(id)
  }

  const company = companies.find((c) => c.id === resolvedCompanyId) ?? null
  const loading =
    userQ.isLoading || companiesQ.isLoading || serverPrefQ.isLoading

  useCompanyAppRealtimeSync(userId, resolvedCompanyId, qc)

  const value = React.useMemo<Ctx>(
    () => ({
      companies,
      companyId: resolvedCompanyId,
      company,
      setCompanyId,
      loading,
    }),
    [companies, resolvedCompanyId, company, loading],
  )

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>
}

export function useCompany() {
  const ctx = React.useContext(CompanyCtx)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}
