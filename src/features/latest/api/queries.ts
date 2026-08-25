// src/features/latest/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type {
  ActivityCommentWithAuthor,
  ActivityFeedItem,
  ActivityType,
  GroupedInventoryActivity,
  LatestInspectorData,
} from '../types'

export function latestFeedQuery({
  companyId,
  activityTypes,
  limit = 50,
  offset = 0,
}: {
  companyId: string
  activityTypes?: Array<ActivityType>
  limit?: number
  offset?: number
}) {
  return queryOptions<{ items: Array<ActivityFeedItem>; total: number }>({
    queryKey: [
      'company',
      companyId,
      'latest-feed',
      activityTypes,
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

      // Filter by activity types if provided
      if (activityTypes && activityTypes.length > 0) {
        query = query.in('activity_type', activityTypes)
      }

      const { data, error, count } = await query

      if (error) throw error

      if (!data || data.length === 0) {
        return { items: [], total: count ?? 0 }
      }

      // Get current user ID for checking likes
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const currentUserId = user?.id

      // Fetch like counts and user likes in batch
      const activityIds = data.map((a) => a.id)

      const { data: likesData, error: likesError } = await supabase
        .from('activity_likes')
        .select('activity_id, user_id')
        .in('activity_id', activityIds)

      if (likesError) throw likesError

      // Count likes per activity
      const likeCounts = new Map<string, number>()
      const userLikedMap = new Map<string, boolean>()

      likesData?.forEach((like) => {
        const likeCount = likeCounts.get(like.activity_id) || 0
        likeCounts.set(like.activity_id, likeCount + 1)
        if (like.user_id === currentUserId) {
          userLikedMap.set(like.activity_id, true)
        }
      })

      // Fetch comment counts
      const { data: commentsData, error: commentsError } = await supabase
        .from('activity_comments')
        .select('activity_id')
        .in('activity_id', activityIds)
        .eq('deleted', false)

      if (commentsError) throw commentsError

      const commentCounts = new Map<string, number>()
      commentsData?.forEach((comment) => {
        const commentCount = commentCounts.get(comment.activity_id) || 0
        commentCounts.set(comment.activity_id, commentCount + 1)
      })

      // Combine data
      const items: Array<ActivityFeedItem> = data.map((activity) => ({
        ...activity,
        metadata:
          (activity.metadata as Record<string, any>) ||
          ({} as Record<string, any>),
        created_by: Array.isArray(activity.created_by)
          ? activity.created_by[0]
          : activity.created_by,
        like_count: likeCounts.get(activity.id) || 0,
        comment_count: commentCounts.get(activity.id) || 0,
        user_liked: userLikedMap.get(activity.id) || false,
      }))

      return { items, total: count ?? 0 }
    },
    staleTime: 10_000,
  })
}

export function latestInspectorQuery({
  companyId,
  activityId,
}: {
  companyId: string
  activityId: string
}) {
  return queryOptions<
    LatestInspectorData | { groupedActivity: GroupedInventoryActivity } | null
  >({
    queryKey: ['company', companyId, 'latest-inspector', activityId] as const,
    queryFn: async () => {
      // Check if this is a grouped activity ID
      if (activityId.startsWith('grouped_')) {
        // Extract individual activity IDs from the grouped ID
        const individualIds = activityId.replace('grouped_', '').split('_')

        // Fetch all activities in the group
        const { data: activities, error: activitiesError } = await supabase
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
          )
          .in('id', individualIds)
          .eq('company_id', companyId)
          .eq('deleted', false)
          .order('created_at', { ascending: true })

        if (activitiesError) throw activitiesError
        if (!activities || activities.length === 0) return null

        // Get current user ID for checking likes
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const currentUserId = user?.id

        // Fetch likes for all activities in the group
        const { data: likesData, error: likesError } = await supabase
          .from('activity_likes')
          .select('activity_id, user_id')
          .in('activity_id', individualIds)

        if (likesError) throw likesError

        // Count likes per activity and check user liked
        const likeCounts = new Map<string, number>()
        const userLikedMap = new Map<string, boolean>()

        likesData?.forEach((like) => {
          const count = likeCounts.get(like.activity_id) || 0
          likeCounts.set(like.activity_id, count + 1)
          if (like.user_id === currentUserId) {
            userLikedMap.set(like.activity_id, true)
          }
        })

        // Fetch comment counts for all activities
        const { data: commentsData, error: commentsError } = await supabase
          .from('activity_comments')
          .select('activity_id')
          .in('activity_id', individualIds)
          .eq('deleted', false)

        if (commentsError) throw commentsError

        const commentCounts = new Map<string, number>()
        commentsData?.forEach((comment) => {
          const count = commentCounts.get(comment.activity_id) || 0
          commentCounts.set(comment.activity_id, count + 1)
        })

        // Build ActivityFeedItem array from activities
        const items: Array<ActivityFeedItem> = activities.map((activity) => {
          const createdBy = Array.isArray(activity.created_by)
            ? activity.created_by[0]
            : activity.created_by
          return {
            ...activity,
            metadata:
              (activity.metadata as Record<string, any>) ||
              ({} as Record<string, any>),
            created_by: createdBy,
            like_count: likeCounts.get(activity.id) || 0,
            comment_count: commentCounts.get(activity.id) || 0,
            user_liked: userLikedMap.get(activity.id) || false,
          } as ActivityFeedItem
        })

        // Build grouped activity
        const items_only = items.filter(
          (a) => a.activity_type === 'inventory_item_created',
        )
        const groups_only = items.filter(
          (a) => a.activity_type === 'inventory_group_created',
        )

        let groupedType: GroupedInventoryActivity['activity_type']
        if (items_only.length > 0 && groups_only.length > 0) {
          groupedType = 'inventory_mixed_grouped'
        } else if (items_only.length > 0) {
          groupedType = 'inventory_items_grouped'
        } else {
          groupedType = 'inventory_groups_grouped'
        }

        const totalLikes = items.reduce((sum, a) => sum + a.like_count, 0)
        const totalComments = items.reduce((sum, a) => sum + a.comment_count, 0)
        const userLiked = items.some((a) => a.user_liked)

        const groupedActivity: GroupedInventoryActivity = {
          id: activityId,
          isGrouped: true,
          activity_type: groupedType,
          created_by_user_id: items[0].created_by_user_id,
          created_at: items[0].created_at, // Earliest timestamp
          created_by: items[0].created_by,
          items: items.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          ),
          item_count: items_only.length,
          group_count: groups_only.length,
          like_count: totalLikes,
          comment_count: totalComments,
          user_liked: userLiked,
        }

        return { groupedActivity }
      }

      // Regular single activity query
      // Fetch activity with author
      const { data: activity, error: activityError } = await supabase
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
        )
        .eq('id', activityId)
        .eq('company_id', companyId)
        .eq('deleted', false)
        .maybeSingle()

      if (activityError) throw activityError
      if (!activity) return null

      // Get current user ID for checking likes
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const currentUserId = user?.id

      // Fetch like count and user like status
      const { data: likesData, error: likesError } = await supabase
        .from('activity_likes')
        .select('user_id')
        .eq('activity_id', activityId)

      if (likesError) throw likesError

      const likeCount = likesData?.length || 0
      const userLiked =
        currentUserId && likesData?.some((l) => l.user_id === currentUserId)

      // Fetch comments with authors
      const { data: comments, error: commentsError } = await supabase
        .from('activity_comments')
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
        )
        .eq('activity_id', activityId)
        .eq('deleted', false)
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      const commentsWithAuthors: Array<ActivityCommentWithAuthor> =
        comments?.map((comment) => ({
          ...comment,
          created_by: Array.isArray(comment.created_by)
            ? comment.created_by[0]
            : comment.created_by,
        })) || []

      return {
        activity: {
          ...activity,
          metadata: (activity.metadata as Record<string, any>) || {},
          created_by: Array.isArray(activity.created_by)
            ? activity.created_by[0]
            : activity.created_by,
          like_count: likeCount,
          comment_count: commentsWithAuthors.length,
          user_liked: userLiked || false,
        } as ActivityFeedItem,
        comments: commentsWithAuthors,
      }
    },
    staleTime: 10_000,
  })
}

export async function toggleActivityLike({
  companyId: _companyId,
  activityId,
}: {
  companyId: string
  activityId: string
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user already liked
  const { data: existingLike, error: checkError } = await supabase
    .from('activity_likes')
    .select('id')
    .eq('activity_id', activityId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (checkError) throw checkError

  if (existingLike) {
    // Unlike: delete the like
    const { error } = await supabase
      .from('activity_likes')
      .delete()
      .eq('id', existingLike.id)
    if (error) throw error
    return { liked: false }
  } else {
    // Like: insert a new like
    const { error } = await supabase.from('activity_likes').insert({
      activity_id: activityId,
      user_id: user.id,
    })
    if (error) throw error
    return { liked: true }
  }
}

export async function createActivityComment({
  companyId: _companyId,
  activityId,
  content,
}: {
  companyId: string
  activityId: string
  content: string
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id: activityId,
      created_by_user_id: user.id,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteActivityComment({
  commentId,
}: {
  commentId: string
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Soft delete: update deleted flag
  const { error } = await supabase
    .from('activity_comments')
    .update({ deleted: true })
    .eq('id', commentId)
    .eq('created_by_user_id', user.id)

  if (error) throw error
}

export async function createAnnouncement({
  companyId,
  title,
  message,
}: {
  companyId: string
  title: string
  message: string
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      company_id: companyId,
      activity_type: 'announcement',
      created_by_user_id: user.id,
      title: title.trim(),
      description: message.trim(),
      metadata: {
        is_pinned: false,
      },
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Helper function to create activity log entries
export async function logActivity({
  companyId,
  activityType,
  metadata,
  title,
  description,
}: {
  companyId: string
  activityType: ActivityType
  metadata: Record<string, any>
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
    metadata,
    title: title || null,
    description: description || null,
  })

  if (error) throw error
}
