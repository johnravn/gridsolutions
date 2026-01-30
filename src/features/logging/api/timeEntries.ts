import { supabase } from '@shared/api/supabase'
import type { Database } from '@shared/types/database.types'

export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type TimeEntryProfile = {
  user_id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  email: string
  avatar_url: string | null
}
export type TimeEntryWithProfile = TimeEntry & {
  profile: TimeEntryProfile | null
}

export type TimeEntryInsert =
  Database['public']['Tables']['time_entries']['Insert']
export type TimeEntryUpdate =
  Database['public']['Tables']['time_entries']['Update']

export function timeEntriesQuery({
  companyId,
  userId,
  from,
  to,
}: {
  companyId: string
  userId?: string | null
  from: string
  to: string
}) {
  return {
    queryKey: ['time_entries', companyId, userId ?? 'all', from, to],
    queryFn: async () => {
      let q = supabase
        .from('time_entries')
        .select(
          `
          *,
          profile:profiles!time_entries_user_id_fkey (
            user_id,
            display_name,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `,
        )
        .eq('company_id', companyId)
        .gte('start_at', from)
        .lt('start_at', to)

      if (userId) {
        q = q.eq('user_id', userId)
      }

      const { data, error } = await q.order('start_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Array<TimeEntryWithProfile>
    },
  }
}

export async function createTimeEntry(input: TimeEntryInsert) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert(input)
    .select('id')
    .single()

  if (error) throw error
  return data?.id
}

export async function updateTimeEntry({
  id,
  changes,
}: {
  id: string
  changes: TimeEntryUpdate
}) {
  const { data, error } = await supabase
    .from('time_entries')
    .update(changes)
    .eq('id', id)
    .select('id')
    .single()

  if (error) throw error
  return data?.id
}

export async function deleteTimeEntry({ id }: { id: string }) {
  const { error } = await supabase.from('time_entries').delete().eq('id', id)
  if (error) throw error
}
