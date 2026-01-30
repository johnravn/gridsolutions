// src/features/latest/components/LatestInspector.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Flex,
  Heading,
  Separator,
  Tabs,
  Text,
  TextArea,
} from '@radix-ui/themes'
import { Heart, HeartSolid } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { formatDistanceToNow } from 'date-fns'
import {
  getInitialsFromNameOrEmail,
  makeWordPresentable,
} from '@shared/lib/generalFunctions'
import {
  createActivityComment,
  deleteActivityComment,
  latestInspectorQuery,
  toggleActivityLike,
} from '../api/queries'
import {
  getActivityButtonInfo,
  getActivityGenericMessage,
  getActivityNavigation,
} from '../utils/activityNavigation'
import type { ActivityFeedItem, LatestInspectorData } from '../types'

// Using shared getInitialsFromNameOrEmail from generalFunctions
const getInitials = getInitialsFromNameOrEmail

function getActivityGenericDescription(
  activity: ActivityFeedItem,
  authorDisplayName: string,
): string {
  const metadata = activity.metadata

  switch (activity.activity_type) {
    case 'inventory_item_created':
      return `${authorDisplayName} has added a new item to the company inventory. This item is now available for booking and use across all job sites. You can view its details and manage its availability through the inventory management system.`
    case 'inventory_item_deleted':
      return `${authorDisplayName} has removed an item from the company inventory. This item will no longer be available for booking on future jobs. Any existing bookings may need to be reviewed or updated accordingly.`
    case 'inventory_group_created':
      return `${authorDisplayName} has created a new inventory group to better organize and manage related items. Groups help streamline the inventory management process by allowing you to categorize items for easier access and tracking.`
    case 'inventory_group_deleted':
      return `${authorDisplayName} has removed an inventory group from the system. Items that were previously grouped may need to be reorganized. Please check if any items require reassignment to other groups.`
    case 'vehicle_added':
      return `${authorDisplayName} has added a new vehicle to the company fleet. This vehicle is now available for assignment to jobs and can be tracked through the vehicle management system. Make sure all relevant information is up to date.`
    case 'vehicle_removed':
      return `${authorDisplayName} has removed a vehicle from the company fleet. This vehicle will no longer be available for assignment to future jobs. Any ongoing or scheduled assignments should be reviewed and updated as needed.`
    case 'customer_added':
      return `${authorDisplayName} has added a new customer to the company's customer database. This customer can now be assigned to jobs and projects. Their contact information and preferences are stored in the system for future reference.`
    case 'customer_removed':
      return `${authorDisplayName} has removed a customer from the company's customer database. This customer's information is no longer active in the system. Historical job data and records related to this customer will be retained for reference.`
    case 'crew_added':
      return `${authorDisplayName} has added a new crew member to the team. This crew member can now be assigned to jobs and will have access to the system based on their role and permissions. Welcome them to the team!`
    case 'crew_removed':
      return `${authorDisplayName} has removed a crew member from the team. This person will no longer have access to the system and cannot be assigned to new jobs. Any existing assignments should be reviewed and reassigned if necessary.`
    case 'job_created': {
      const jobTitle = metadata.job_title || activity.title || 'a new job'
      const jobInfo = metadata.job_id
        ? ` This job has been added to the system and can be accessed through the jobs section. All team members with appropriate permissions can view and work on this job.`
        : ''
      return `${authorDisplayName} has created ${jobTitle}.${jobInfo} Make sure to assign a project lead and add any necessary details to get started.`
    }
    case 'job_status_changed': {
      const jobTitle = metadata.job_title || activity.title || 'a job'
      const previousStatus = metadata.previous_status
        ? makeWordPresentable(metadata.previous_status)
        : 'the previous status'
      const newStatus = metadata.new_status
        ? makeWordPresentable(metadata.new_status)
        : 'a new status'
      return `${authorDisplayName} has updated the status of "${jobTitle}" from ${previousStatus} to ${newStatus}. This change reflects the current progress of the job and helps keep the team informed about its status in the workflow.`
    }
    case 'job_deleted': {
      const jobTitle = metadata.job_title || activity.title || 'a job'
      return `${authorDisplayName} has deleted "${jobTitle}" from the system. This job will no longer appear in active job listings, but historical records and data will be retained for reference and reporting purposes.`
    }
    case 'announcement':
      // For announcements, return a generic message - the actual description is displayed separately below
      return `${authorDisplayName} has posted an announcement to keep the team informed. Make sure to read it carefully as it may contain important updates, policy changes, or other information relevant to the company.`
    default:
      return `${authorDisplayName} has performed an activity update in the system. This change may affect various aspects of the company operations, so please review the details if you need more information.`
  }
}

export default function LatestInspector({
  activityId,
}: {
  activityId: string | null
}) {
  const { companyId } = useCompany()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [commentText, setCommentText] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'details' | 'comments'>(
    'details',
  )

  // Get current user ID for comment deletion (always call this hook)
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })
  const currentUserId = authUser?.id

  const enabled = Boolean(companyId && activityId)

  const { data, isLoading, isError, error } = useQuery({
    ...latestInspectorQuery({
      companyId: companyId ?? '',
      activityId: activityId ?? '',
    }),
    enabled,
  })

  // Check if this is a grouped activity
  const isGrouped =
    activityId?.startsWith('grouped_') && data && 'groupedActivity' in data

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !activityId) throw new Error('Missing ids')
      // For grouped activities, like the first activity in the group
      if (activityId.startsWith('grouped_')) {
        const firstId = activityId.replace('grouped_', '').split('_')[0]
        return toggleActivityLike({ companyId, activityId: firstId })
      }
      return toggleActivityLike({ companyId, activityId })
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-inspector', activityId],
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
    },
  })

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!companyId || !activityId) throw new Error('Missing ids')
      // For grouped activities, comment on the first activity in the group
      const targetId = activityId.startsWith('grouped_')
        ? activityId.replace('grouped_', '').split('_')[0]
        : activityId
      return createActivityComment({ companyId, activityId: targetId, content })
    },
    onSuccess: async () => {
      setCommentText('')
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-inspector', activityId],
      })
      success('Comment added', 'Your comment was posted successfully.')
    },
    onError: (err: any) => {
      toastError('Failed to add comment', err.message)
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: deleteActivityComment,
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-inspector', activityId],
      })
      success('Comment deleted', 'The comment was removed successfully.')
    },
  })

  if (!activityId) {
    return (
      <Text color="gray" size="2">
        Select an activity to view details
      </Text>
    )
  }

  if (isLoading) {
    return <InspectorSkeleton />
  }

  if (isError) {
    return (
      <Text color="red" size="2">
        Failed to load activity.{' '}
        <Text as="span" style={{ fontFamily: 'monospace' }}>
          {(error as any)?.message || 'Unknown error'}
        </Text>
      </Text>
    )
  }

  if (!data) {
    return (
      <Text color="gray" size="2">
        Activity not found
      </Text>
    )
  }

  // Handle grouped activities
  if (isGrouped && 'groupedActivity' in data) {
    const groupedActivity = data.groupedActivity

    // Calculate avatar URL without using hooks
    const authorAvatarUrl = groupedActivity.created_by.avatar_url
      ? supabase.storage
          .from('avatars')
          .getPublicUrl(groupedActivity.created_by.avatar_url).data.publicUrl
      : null

    const authorDisplayName =
      groupedActivity.created_by.display_name ||
      groupedActivity.created_by.email
    const timeAgo = formatDistanceToNow(new Date(groupedActivity.created_at), {
      addSuffix: true,
    })

    // Format grouped description
    const parts: Array<string> = []
    if (groupedActivity.item_count > 0) {
      parts.push(
        `${groupedActivity.item_count} ${groupedActivity.item_count === 1 ? 'item' : 'items'}`,
      )
    }
    if (groupedActivity.group_count > 0) {
      parts.push(
        `${groupedActivity.group_count} ${groupedActivity.group_count === 1 ? 'group' : 'groups'}`,
      )
    }

    // Aggregate all comments from individual activities (simplified - just use first activity's comments for now)
    // In a real implementation, you might want to fetch comments from all activities
    const comments: Array<any> = []

    return (
      <Box>
        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
        >
          <Tabs.List>
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            <Tabs.Trigger value="comments">
              Comments ({comments.length})
            </Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="details">
              {/* Header with author info */}
              <Flex align="center" gap="3" mb="4">
                <Avatar
                  size="3"
                  radius="full"
                  src={authorAvatarUrl ?? undefined}
                  fallback={getInitials(
                    groupedActivity.created_by.display_name,
                    groupedActivity.created_by.email,
                  )}
                />
                <Flex direction="column">
                  <Text size="3" weight="medium">
                    {authorDisplayName}
                  </Text>
                  <Text size="1" color="gray">
                    {timeAgo}
                  </Text>
                </Flex>
              </Flex>

              <Separator size="4" mb="4" />

              {/* Grouped activity summary */}
              <Box mb="4">
                <Heading size="4" mb="3">
                  {getActivityGenericMessage('grouped_inventory')}
                </Heading>

                {/* Generic description */}
                <Text size="3" style={{ lineHeight: 1.7 }} mb="3">
                  {authorDisplayName} has added {parts.join(' and ')} to the
                  company inventory. These items are now available for booking
                  and use across all job sites. You can view their details and
                  manage their availability through the inventory management
                  system.
                </Text>

                {/* List of individual items and groups */}
                <Box
                  mt="4"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  {groupedActivity.items.map((item) => {
                    const itemTimeAgo = formatDistanceToNow(
                      new Date(item.created_at),
                      { addSuffix: true },
                    )
                    const metadata = item.metadata
                    const itemName =
                      item.activity_type === 'inventory_item_created'
                        ? metadata.item_name || 'Unknown item'
                        : metadata.group_name || 'Unknown group'
                    const itemType =
                      item.activity_type === 'inventory_item_created'
                        ? 'item'
                        : 'group'
                    // Get the item/group ID from metadata
                    const itemId =
                      item.activity_type === 'inventory_item_created'
                        ? metadata.item_id
                        : metadata.group_id

                    return (
                      <Flex
                        key={item.id}
                        align="center"
                        justify="between"
                        gap="3"
                        p="3"
                        style={{
                          backgroundColor: 'transparent',
                          borderRadius: 'var(--radius-3)',
                          cursor: itemId ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          border: '1px solid transparent',
                        }}
                        onClick={
                          itemId
                            ? () => {
                                navigate({
                                  to: '/inventory',
                                  search: { inventoryId: itemId },
                                })
                              }
                            : undefined
                        }
                        onMouseEnter={(e) => {
                          if (itemId) {
                            e.currentTarget.style.backgroundColor =
                              'var(--gray-2)'
                            e.currentTarget.style.borderColor = 'var(--gray-a6)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (itemId) {
                            e.currentTarget.style.backgroundColor =
                              'transparent'
                            e.currentTarget.style.borderColor = 'transparent'
                          }
                        }}
                      >
                        <Flex align="center" gap="3" style={{ flex: 1 }}>
                          <Flex
                            align="center"
                            justify="center"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-2)',
                              backgroundColor: 'var(--accent-3)',
                              flexShrink: 0,
                            }}
                          >
                            <Text size="4">
                              {itemType === 'item' ? '📦' : '📁'}
                            </Text>
                          </Flex>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              size="2"
                              weight="medium"
                              style={{
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              {itemName}
                            </Text>
                            <Text size="1" color="gray">
                              {itemType === 'item' ? 'Item' : 'Group'}
                            </Text>
                          </Box>
                        </Flex>
                        <Text size="1" color="gray" style={{ flexShrink: 0 }}>
                          {itemTimeAgo}
                        </Text>
                      </Flex>
                    )
                  })}
                </Box>
              </Box>

              <Separator size="4" mb="4" />

              {/* Like button */}
              <Flex align="center" justify="between">
                <Button
                  variant={groupedActivity.user_liked ? 'solid' : 'soft'}
                  color={groupedActivity.user_liked ? 'red' : 'gray'}
                  size="2"
                  onClick={() => likeMutation.mutate()}
                  disabled={likeMutation.isPending}
                >
                  {groupedActivity.user_liked ? (
                    <HeartSolid width={16} height={16} />
                  ) : (
                    <Heart width={16} height={16} />
                  )}
                  <Text ml="1">
                    {groupedActivity.like_count > 0
                      ? groupedActivity.like_count
                      : 'Like'}
                  </Text>
                </Button>
              </Flex>
            </Tabs.Content>

            <Tabs.Content value="comments">
              {/* Comment form */}
              <Box mb="4">
                <TextArea
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical' }}
                  mb="2"
                />
                <Flex justify="end">
                  <Button
                    size="2"
                    onClick={() => {
                      if (commentText.trim()) {
                        commentMutation.mutate(commentText.trim())
                      }
                    }}
                    disabled={!commentText.trim() || commentMutation.isPending}
                  >
                    Post
                  </Button>
                </Flex>
              </Box>

              <Separator size="4" mb="4" />

              {/* Comments list */}
              {comments.length === 0 ? (
                <Box py="6">
                  <Text color="gray" size="2" align="center">
                    No comments yet
                  </Text>
                </Box>
              ) : (
                <Box>
                  {comments.map((comment, idx) => (
                    <React.Fragment key={comment.id}>
                      {/* Comment rendering would go here */}
                      {idx < comments.length - 1 && <Separator my="2" />}
                    </React.Fragment>
                  ))}
                </Box>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
    )
  }

  // Regular single activity
  const { activity, comments } = data as LatestInspectorData

  // Calculate avatar URL without using hooks
  const authorAvatarUrl = activity.created_by.avatar_url
    ? supabase.storage
        .from('avatars')
        .getPublicUrl(activity.created_by.avatar_url).data.publicUrl
    : null

  const authorDisplayName =
    activity.created_by.display_name || activity.created_by.email
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
  })

  return (
    <Box>
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
      >
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="comments">
            Comments ({comments.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="details">
            {/* Header with author info */}
            <Flex align="center" gap="3" mb="4">
              <Avatar
                size="3"
                radius="full"
                src={authorAvatarUrl ?? undefined}
                fallback={getInitials(
                  activity.created_by.display_name,
                  activity.created_by.email,
                )}
              />
              <Flex direction="column">
                <Text size="3" weight="medium">
                  {authorDisplayName}
                </Text>
                <Text size="1" color="gray">
                  {timeAgo}
                </Text>
              </Flex>
            </Flex>

            <Separator size="4" mb="4" />

            {/* Activity content */}
            <Box mb="4">
              {/* Title */}
              <Heading size="4" mb="3">
                {getActivityGenericMessage(activity.activity_type)}
              </Heading>

              {/* Generic description - skip for announcements as they have their own message box */}
              {activity.activity_type !== 'announcement' && (
                <Text size="3" style={{ lineHeight: 1.7 }} mb="3">
                  {getActivityGenericDescription(activity, authorDisplayName)}
                </Text>
              )}

              {/* Clickable item button - styled like feed items */}
              {(() => {
                const nav = getActivityNavigation(activity)
                const buttonInfo = getActivityButtonInfo(activity.activity_type)
                const metadata = activity.metadata

                if (!nav?.id || !buttonInfo) return null

                // Get item name for the clickable element
                let itemName = ''
                switch (activity.activity_type) {
                  case 'inventory_item_created':
                    itemName = metadata.item_name || 'item'
                    break
                  case 'inventory_group_created':
                    itemName = metadata.group_name || 'group'
                    break
                  case 'vehicle_added':
                    itemName =
                      metadata.vehicle_name ||
                      metadata.license_plate ||
                      'vehicle'
                    break
                  case 'customer_added':
                    itemName = metadata.customer_name || 'customer'
                    break
                  case 'crew_added':
                    itemName =
                      metadata.user_name || metadata.email || 'crew member'
                    break
                  case 'job_created':
                  case 'job_status_changed':
                    itemName = metadata.job_title || activity.title || 'job'
                    break
                }

                // Get emoji based on activity type (matching HomePage.tsx)
                const getActivityEmoji = (activityType: string): string => {
                  switch (activityType) {
                    case 'inventory_item_created':
                      return '📦'
                    case 'inventory_group_created':
                      return '📁'
                    case 'vehicle_added':
                      return '🚗'
                    case 'customer_added':
                      return '👤'
                    case 'crew_added':
                      return '👷'
                    case 'job_created':
                    case 'job_status_changed':
                      return '📋'
                    default:
                      return '📌'
                  }
                }

                const activityEmoji = getActivityEmoji(activity.activity_type)

                if (!itemName) return null

                return (
                  <Box
                    mt="3"
                    onClick={() => {
                      navigate({
                        to: nav.route,
                        search: { [nav.searchParam]: nav.id },
                      })
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-3)',
                      backgroundColor: 'var(--gray-a2)',
                      border: '1px solid var(--gray-a5)',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--gray-3)'
                      e.currentTarget.style.borderColor = 'var(--gray-a7)'
                      e.currentTarget.style.boxShadow =
                        '0 2px 4px rgba(0, 0, 0, 0.1)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                      e.currentTarget.style.borderColor = 'var(--gray-a5)'
                      e.currentTarget.style.boxShadow =
                        '0 1px 2px rgba(0, 0, 0, 0.05)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <Flex align="center" gap="3">
                      <Flex
                        align="center"
                        justify="center"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-2)',
                          backgroundColor: 'var(--accent-3)',
                          flexShrink: 0,
                        }}
                      >
                        <Text size="4">{activityEmoji}</Text>
                      </Flex>
                      <Text size="2" weight="medium">
                        {itemName}
                      </Text>
                    </Flex>
                  </Box>
                )
              })()}

              {activity.description && (
                <Box mt="3">
                  <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                    {activity.description}
                  </Text>
                </Box>
              )}
            </Box>

            <Separator size="4" mb="4" />

            {/* Like button */}
            <Flex align="center" justify="between">
              <Button
                variant={activity.user_liked ? 'solid' : 'soft'}
                color={activity.user_liked ? 'red' : 'gray'}
                size="2"
                onClick={() => likeMutation.mutate()}
                disabled={likeMutation.isPending}
              >
                {activity.user_liked ? (
                  <HeartSolid width={16} height={16} />
                ) : (
                  <Heart width={16} height={16} />
                )}
                <Text ml="1">
                  {activity.like_count > 0 ? activity.like_count : 'Like'}
                </Text>
              </Button>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="comments">
            {/* Comment form */}
            <Box mb="4">
              <TextArea
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
                mb="2"
              />
              <Flex justify="end">
                <Button
                  size="2"
                  onClick={() => {
                    if (commentText.trim()) {
                      commentMutation.mutate(commentText.trim())
                    }
                  }}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  Post
                </Button>
              </Flex>
            </Box>

            <Separator size="4" mb="4" />

            {/* Comments list */}
            {comments.length === 0 ? (
              <Box py="6">
                <Text color="gray" size="2" align="center">
                  No comments yet
                </Text>
              </Box>
            ) : (
              <Box>
                {comments.map((comment, idx) => {
                  // Calculate avatar URL without using hooks
                  const commentAuthorAvatarUrl = comment.created_by.avatar_url
                    ? supabase.storage
                        .from('avatars')
                        .getPublicUrl(comment.created_by.avatar_url).data
                        .publicUrl
                    : null

                  const commentAuthorDisplayName =
                    comment.created_by.display_name || comment.created_by.email
                  const commentTimeAgo = formatDistanceToNow(
                    new Date(comment.created_at),
                    { addSuffix: true },
                  )

                  const isOwner = comment.created_by.user_id === currentUserId

                  return (
                    <React.Fragment key={comment.id}>
                      <Flex gap="3" align="start" mb="3">
                        <Avatar
                          size="2"
                          radius="full"
                          src={commentAuthorAvatarUrl ?? undefined}
                          fallback={getInitials(
                            comment.created_by.display_name,
                            comment.created_by.email,
                          )}
                        />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Flex align="center" gap="2" mb="1">
                            <Text size="2" weight="medium">
                              {commentAuthorDisplayName}
                            </Text>
                            <Text size="1" color="gray">
                              {commentTimeAgo}
                            </Text>
                            {isOwner && (
                              <Button
                                size="1"
                                variant="ghost"
                                color="red"
                                onClick={() => {
                                  deleteCommentMutation.mutate({
                                    commentId: comment.id,
                                  })
                                }}
                                disabled={deleteCommentMutation.isPending}
                              >
                                Delete
                              </Button>
                            )}
                          </Flex>
                          <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                            {comment.content}
                          </Text>
                        </Box>
                      </Flex>
                      {idx < comments.length - 1 && <Separator my="2" />}
                    </React.Fragment>
                  )
                })}
              </Box>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}
