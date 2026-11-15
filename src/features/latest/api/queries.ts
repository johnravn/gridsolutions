import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { fetchActivityEngagement } from './activityEngagement'
import type { ActivityFeedItem, ActivityType } from '../types'
import type { Json } from '@shared/types/database.types'

export function latestFeedQuery({
  companyId,
  userId,
  activityTypes,
  actorUserId,
  from,
  to,
  search,
  limit = 50,
  offset = 0,
}: {
  companyId: string
  userId?: string | null
  activityTypes?: Array<ActivityType>
  /** Filter to a single actor (created_by_user_id). */
  actorUserId?: string | null
  /** Inclusive lower bound (ISO). */
  from?: string | null
  /** Inclusive upper bound (ISO). */
  to?: string | null
  /** Case-insensitive match on title or description. */
  search?: string | null
  limit?: number
  offset?: number
}) {
  const normalizedSearch = search?.trim() ? search.trim() : null
  return queryOptions<{ items: Array<ActivityFeedItem>; total: number }>({
    queryKey: [
      'company',
      companyId,
      'latest-feed',
      userId ?? 'anon',
      activityTypes,
      actorUserId ?? null,
      from ?? null,
      to ?? null,
      normalizedSearch,
      limit,
      offset,
    ] as const,
    queryFn: async () => {
      let query = supabase
        .from('activity_log')
        .select(
          `
          *,
          created_by:created_by_user_id (
            user_id,
            display_name,
            avatar_url,
            email
          )
        `,
          { count: 'exact' },
        )
        .eq('company_id', companyId)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (activityTypes && activityTypes.length > 0) {
        query = query.in('activity_type', activityTypes)
      }

      if (actorUserId) {
        query = query.eq('created_by_user_id', actorUserId)
      }

      if (from) {
        query = query.gte('created_at', from)
      }

      if (to) {
        query = query.lte('created_at', to)
      }

      if (normalizedSearch) {
        const escaped = normalizedSearch
          .replaceAll('%', '\\%')
          .replaceAll('_', '\\_')
          .replaceAll(',', ' ')
        const pattern = `%${escaped}%`
        query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`)
      }

      const { data, error, count } = await query

      if (error) throw error

      if (!data || data.length === 0) {
        return { items: [], total: count ?? 0 }
      }

      const currentUserId = userId ?? undefined
      const activityIds = data.map((a) => a.id)
      const { likeCounts, commentCounts, userLiked } =
        await fetchActivityEngagement(activityIds, currentUserId)

      const items: Array<ActivityFeedItem> = data.map((activity) => ({
        ...activity,
        metadata:
          (activity.metadata as Record<string, unknown>) ||
          ({} as Record<string, unknown>),
        created_by: Array.isArray(activity.created_by)
          ? activity.created_by[0]
          : activity.created_by,
        like_count: likeCounts.get(activity.id) || 0,
        comment_count: commentCounts.get(activity.id) || 0,
        user_liked: userLiked.get(activity.id) || false,
      }))

      return { items, total: count ?? 0 }
    },
    staleTime: 10_000,
  })
}

/** Write an activity_log row (jobs / vehicles / inventory / customers). */
export async function logActivity({
  companyId,
  activityType,
  metadata,
  title,
  description,
}: {
  companyId: string
  activityType: ActivityType
  metadata: Record<string, unknown>
  title?: string
  description?: string
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('activity_log').insert({
    company_id: companyId,
    activity_type: activityType,
    created_by_user_id: user.id,
    metadata: metadata as Json,
    title: title || null,
    description: description || null,
  })

  if (error) throw error
}
