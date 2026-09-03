import { supabase } from '@shared/api/supabase'
import type { User } from '@supabase/supabase-js'

/** Local session identity — avoids Auth HTTP on every React Query fetch. */
export const authUserQueryOptions = {
  queryKey: ['auth', 'user'] as const,
  queryFn: async (): Promise<User | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ?? null
  },
  staleTime: 60_000,
}
