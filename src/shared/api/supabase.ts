import { createClient } from '@supabase/supabase-js'
import { wrapSupabaseClientForDemo } from '@shared/demo/demoModeState'
import { requireSupabaseClientEnv } from '@shared/lib/env'
import type { Database } from '@shared/types/database.types'

const { url: supabaseUrl, anonKey: supabaseAnonKey } =
  requireSupabaseClientEnv()

const baseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle OAuth/callback manually
    flowType: 'pkce',
  },
})

export const supabase = wrapSupabaseClientForDemo(baseClient)
