import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type { Json } from '@shared/types/database.types'

export type ProfilePageRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  preferences: Json | null
  primary_address_id: string | null
  addresses?: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

export function profilePageQuery(userId: string) {
  return queryOptions<ProfilePageRow | null>({
    queryKey: ['profile', userId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          first_name,
          last_name,
          display_name,
          phone,
          avatar_url,
          bio,
          preferences,
          primary_address_id,
          addresses:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ProfilePageRow
    },
  })
}
