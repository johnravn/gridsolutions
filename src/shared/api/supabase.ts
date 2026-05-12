import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

// These come from your Supabase project settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle OAuth/callback manually
    flowType: 'pkce',
  },
})
