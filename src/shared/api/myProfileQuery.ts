import { supabase } from '@shared/api/supabase'

/**
 * Shared cache key for the signed-in user's profile row.
 *
 * Do not reuse this key with a narrower `select` — another observer (What's New)
 * depends on `last_seen_release_version` staying on the cached object.
 */
export function myProfileQueryKey(userId: string) {
  return ['my-profile', userId] as const
}

export const MY_PROFILE_SELECT =
  'user_id, email, display_name, first_name, last_name, avatar_url, last_seen_release_version'

export type MyProfile = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  last_seen_release_version: string | null
}

export function myProfileQuery(userId: string) {
  return {
    queryKey: myProfileQueryKey(userId),
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(MY_PROFILE_SELECT)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}
