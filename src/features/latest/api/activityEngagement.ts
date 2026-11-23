// src/features/latest/api/activityEngagement.ts
import { supabase } from '@shared/api/supabase'

export async function fetchActivityEngagement(
  activityIds: Array<string>,
  currentUserId?: string,
): Promise<{
  likeCounts: Map<string, number>
  commentCounts: Map<string, number>
  userLiked: Map<string, boolean>
}> {
  const likeCounts = new Map<string, number>()
  const commentCounts = new Map<string, number>()
  const userLiked = new Map<string, boolean>()

  if (activityIds.length === 0) {
    return { likeCounts, commentCounts, userLiked }
  }

  const { data: likesData, error: likesError } = await supabase
    .from('activity_likes')
    .select('activity_id, user_id')
    .in('activity_id', activityIds)

  if (likesError) throw likesError

  likesData?.forEach((like) => {
    likeCounts.set(
      like.activity_id,
      (likeCounts.get(like.activity_id) || 0) + 1,
    )
    if (currentUserId && like.user_id === currentUserId) {
      userLiked.set(like.activity_id, true)
    }
  })

  const { data: commentsData, error: commentsError } = await supabase
    .from('activity_comments')
    .select('activity_id')
    .in('activity_id', activityIds)
    .eq('deleted', false)

  if (commentsError) throw commentsError

  commentsData?.forEach((comment) => {
    commentCounts.set(
      comment.activity_id,
      (commentCounts.get(comment.activity_id) || 0) + 1,
    )
  })

  return { likeCounts, commentCounts, userLiked }
}
