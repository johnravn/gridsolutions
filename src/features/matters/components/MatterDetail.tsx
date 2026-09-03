import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { ArrowRight, Check, Download, Edit, Trash, Xmark } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useAuth } from '@app/providers/AuthProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import MapEmbed from '@shared/maps/MapEmbed'
import {
  deleteMatter,
  markMatterAsUnread,
  markMatterAsViewed,
  matterDetailQuery,
  matterFilesQuery,
  matterMessagesQuery,
  matterRecipientsQuery,
  respondToMatter,
} from '../api/queries'
import { useMatterReadMutations } from '../hooks/useMatterReadMutations'
import { resolveMatterCardAuthor } from '../utils/matterAuthor'
import {
  applyOptimisticMatterReadState,
  invalidateMattersInBackground,
} from '../utils/optimisticMatterRead'
import {
  ROLE_FILLED_DETAIL,
  ROLE_FILLED_MESSAGE,
  crewInviteResponseKind,
} from '../utils/crewInviteResponse'
import { parseMatterOutcome } from '../utils/crewInviteAnswer'
import { MatterReadIconButton } from './MatterReadIconButton'
import { MatterOutcomeBanner } from './CrewInviteAnswerStatus'

export default function MatterDetail({
  matterId,
  onDeleted,
}: {
  matterId: string
  onDeleted?: () => void
}) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const { user } = useAuth()
  const { companyId } = useCompany()
  const { companyRole } = useAuthz()
  const navigate = useNavigate()
  const [isEditingResponse, setIsEditingResponse] = React.useState(false)
  const { markRead, markUnread } = useMatterReadMutations()

  const { data: matter } = useQuery({
    ...matterDetailQuery(matterId, user?.id),
    enabled: !!matterId,
  })

  const canSeeAnnouncementRecipients = React.useMemo(() => {
    if (
      !matter ||
      matter.id !== matterId ||
      matter.matter_type !== 'announcement' ||
      !user?.id
    ) {
      return false
    }
    if (user.id === matter.created_by_user_id) return true
    if (companyRole === 'owner') return true
    return false
  }, [matter, matterId, user?.id, companyRole])

  const { data: recipients = [] } = useQuery({
    ...matterRecipientsQuery(matterId),
    enabled: canSeeAnnouncementRecipients,
  })

  const hasInvitationMeta = !!(matter?.metadata as any)?.invitation_message

  const { data: messages = [] } = useQuery({
    ...matterMessagesQuery(matterId),
    enabled:
      !!matter && matter.matter_type === 'crew_invite' && !hasInvitationMeta,
  })

  const { data: files } = useQuery({
    ...matterFilesQuery(matterId),
  })
  const matterFiles = files || []

  const invitationMessage = React.useMemo(() => {
    const meta = (matter?.metadata as { invitation_message?: string } | null)
      ?.invitation_message
    if (meta?.trim()) return meta.trim()
    if (
      !matter ||
      matter.matter_type !== 'crew_invite' ||
      !matter.created_by_user_id
    ) {
      return null
    }
    const creatorMessage = messages.find(
      (msg) => msg.user_id === matter.created_by_user_id,
    )
    return creatorMessage?.content ?? null
  }, [messages, matter])

  // Fetch additional job and time period details for crew_invite matters
  const { data: crewInviteDetails } = useQuery({
    queryKey: ['matters', 'crew-invite-details', matterId],
    queryFn: async () => {
      if (!matter || matter.matter_type !== 'crew_invite') return null
      if (!matter.job_id || !matter.time_period_id) return null

      // Fetch job details with address
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(
          'id, title, job_address_id, address:job_address_id ( id, name, address_line, zip_code, city, country )',
        )
        .eq('id', matter.job_id)
        .single()

      if (jobError) throw jobError

      // Fetch time period details with category
      const { data: timePeriod, error: tpError } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, role_category')
        .eq('id', matter.time_period_id)
        .single()

      if (tpError) throw tpError

      // Fetch reserved_crew notes for this user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      let notes: string | null = null
      if (authUser) {
        const { data: crewRow } = await supabase
          .from('reserved_crew')
          .select('notes')
          .eq('time_period_id', matter.time_period_id)
          .eq('user_id', authUser.id)
          .maybeSingle()
        notes = crewRow?.notes || null
      }

      return { job, timePeriod, notes }
    },
    enabled: !!matter && matter.matter_type === 'crew_invite',
  })

  // Helper function to format date as "3. december 2025"
  const formatDate = (dateString: string): string => {
    const d = new Date(dateString)
    const day = d.getDate()
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ]
    const month = monthNames[d.getMonth()]
    const year = d.getFullYear()
    return `${day}. ${month} ${year}`
  }

  // Helper function to format time as "14:50"
  const formatTime = (dateString: string): string => {
    const d = new Date(dateString)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Helper function to format duration as "8hrs 25m"
  const formatDuration = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffMs = end.getTime() - start.getTime()
    const totalMinutes = Math.round(diffMs / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours > 0 && minutes > 0) {
      return `${hours}hrs ${minutes}m`
    } else if (hours > 0) {
      return `${hours}hrs`
    } else {
      return `${minutes}m`
    }
  }

  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const deleteMut = useMutation({
    mutationFn: async () => {
      await deleteMatter(matterId)
    },
    onSuccess: () => {
      success('Matter deleted', 'The matter has been deleted.')
      setDeleteOpen(false)
      onDeleted?.()
      void qc.invalidateQueries({ queryKey: ['matters'] })
      if (companyId) {
        void qc.invalidateQueries({
          queryKey: ['matters', 'index', companyId],
        })
      }
    },
    onError: (e: any) => {
      toastError('Failed to delete matter', e?.message || 'Please try again.')
    },
  })

  const recipientSummary = React.useMemo(() => {
    const totalRecipients = recipients.length
    const viewedCount = recipients.filter((r) => r.viewed_at).length
    const pendingCount = totalRecipients - viewedCount
    const allViewed = viewedCount === totalRecipients && totalRecipients > 0
    return {
      totalRecipients,
      viewedCount,
      pendingCount,
      allViewed,
    }
  }, [recipients])

  // Track if we've already marked this matter as viewed to prevent duplicate calls
  const hasMarkedAsViewedRef = React.useRef<string | null>(null)
  const skipAutoViewRef = React.useRef<string | null>(null)
  const matterLoaded = !!matter

  // Mark as viewed when the matter is first opened (once per matterId).
  React.useEffect(() => {
    skipAutoViewRef.current = null
    hasMarkedAsViewedRef.current = null
  }, [matterId])

  React.useEffect(() => {
    if (!matterLoaded) return
    if (skipAutoViewRef.current === matterId) return
    if (hasMarkedAsViewedRef.current === matterId) return

    hasMarkedAsViewedRef.current = matterId

    // Clear unread UI immediately; persist in the background.
    applyOptimisticMatterReadState(qc, {
      matterIds: [matterId],
      isUnread: false,
    })

    // Always mark as viewed when opening: updates matter_recipients (if row exists) and
    // marks any notification for this matter as read so the bell and matters list stay in sync.
    markMatterAsViewed(matterId)
      .then(async () => {
        if (skipAutoViewRef.current === matterId) {
          await markMatterAsUnread(matterId)
          applyOptimisticMatterReadState(qc, {
            matterIds: [matterId],
            isUnread: true,
          })
        }
        invalidateMattersInBackground(qc)
      })
      .catch((error) => {
        console.error('Failed to mark matter as viewed:', error)
        hasMarkedAsViewedRef.current = null
        applyOptimisticMatterReadState(qc, {
          matterIds: [matterId],
          isUnread: true,
        })
        invalidateMattersInBackground(qc)
      })
  }, [matterId, matterLoaded, qc])

  const respond = useMutation({
    mutationFn: async (response: string) => {
      return await respondToMatter(matterId, response)
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['matters', 'detail', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'responses', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'recipients', matterId] })
      qc.invalidateQueries({ queryKey: ['matters'] })
      // If this is a crew_invite, also invalidate crew queries
      if (matter?.matter_type === 'crew_invite' && matter.job_id) {
        qc.invalidateQueries({ queryKey: ['jobs.crew', matter.job_id] })
        qc.invalidateQueries({
          queryKey: ['jobs', matter.job_id, 'time_periods'],
        })
      }
      if (result.status === 'role_filled') {
        info(ROLE_FILLED_MESSAGE, ROLE_FILLED_DETAIL)
      } else {
        success('Success', 'Response recorded')
      }
      setIsEditingResponse(false)
    },
    onError: (e: any) => {
      toastError('Failed', e?.message || 'Could not record response')
    },
  })

  // Build address string for map query (must be before early return to follow Rules of Hooks)
  const mapQuery = React.useMemo(() => {
    if (!crewInviteDetails) return null
    const job = crewInviteDetails.job
    if (!job?.address) return null
    const addr = job.address as any
    const parts = [
      addr.address_line,
      addr.zip_code,
      addr.city,
      addr.country,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }, [crewInviteDetails])

  // Get project lead info if available (must be before early return to follow Rules of Hooks)
  const projectLead = matter?.job?.project_lead
  const avatarUrl = React.useMemo(() => {
    if (!projectLead?.avatar_url) return null
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(projectLead.avatar_url)
    return data.publicUrl
  }, [projectLead?.avatar_url])

  const author = matter ? resolveMatterCardAuthor(matter) : null
  const outcome = matter ? parseMatterOutcome(matter.metadata) : null
  const showProjectLead =
    !!projectLead && projectLead.user_id !== author?.userId

  const leadName = projectLead?.display_name || projectLead?.email || null
  const leadInitials = leadName ? getInitials(leadName) : ''
  const authorAvatarUrl = React.useMemo(() => {
    if (!author?.avatarPath) return null
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(author.avatarPath)
    return data.publicUrl
  }, [author?.avatarPath])

  if (!matter) {
    return (
      <Box p="4">
        <Text color="gray">Loading matter...</Text>
      </Box>
    )
  }

  const activityId = (matter.metadata as any)?.activity_id as string | undefined

  const getTypeBadge = () => {
    const variants: Record<string, { color: string; label: string }> = {
      crew_invite: { color: 'blue', label: 'Invite' },
      vote: { color: 'purple', label: 'Vote (legacy)' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat (legacy)' },
      update: { color: 'amber', label: 'Update' },
    }
    const v = variants[matter.matter_type] ?? variants.announcement
    return (
      <Badge radius="full" color={v.color as any} size="2">
        {v.label}
      </Badge>
    )
  }

  const isCreator = user?.id === matter.created_by_user_id

  return (
    <Box>
      <Box mb="4">
        <Flex align="center" gap="2" mb="2" justify="between">
          <Flex align="center" gap="2">
            {getTypeBadge()}
            <Heading size="5">{matter.title}</Heading>
          </Flex>
          <Flex align="center" gap="2">
            {matter.is_recipient && (
              <MatterReadIconButton
                size="2"
                isUnread={!!matter.is_unread}
                disabled={markRead.isPending || markUnread.isPending}
                onMarkRead={() => {
                  skipAutoViewRef.current = null
                  markRead.mutate(matterId)
                }}
                onMarkUnread={() => {
                  skipAutoViewRef.current = matterId
                  markUnread.mutate(matterId)
                }}
              />
            )}
            {matter.job?.id && (
              <Button
                size="2"
                variant="soft"
                onClick={() =>
                  navigate({
                    to: '/jobs',
                    search: {
                      jobId: matter.job?.id,
                      recurringJobId: undefined,
                      tab: undefined,
                    },
                  })
                }
              >
                <ArrowRight width={16} height={16} />
                Go to job
              </Button>
            )}
            {isCreator && (
              <Button
                size="2"
                variant="soft"
                color="red"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash width={16} height={16} /> Delete
              </Button>
            )}
          </Flex>
        </Flex>
        <Flex align="center" justify="between" gap="4">
          <Box>
            {author && (
              <Flex align="center" gap="2">
                {outcome && (
                  <Avatar
                    size="3"
                    radius="full"
                    fallback={getInitials(author.name)}
                    src={authorAvatarUrl || undefined}
                    style={{ border: '1px solid var(--gray-5)' }}
                  />
                )}
                <Text size="2" color="gray">
                  {outcome
                    ? `${author.name} · ${formatDate(matter.created_at)}`
                    : `Created by ${author.name} on ${formatDate(
                        matter.created_at,
                      )}`}
                </Text>
              </Flex>
            )}
          </Box>
          {showProjectLead && (
            <Flex align="center" gap="2">
              <Text size="1" color="gray">
                Project lead
              </Text>
              <Text size="2" weight="medium">
                {leadName}
              </Text>
              <Avatar
                size="3"
                radius="full"
                fallback={leadInitials}
                src={avatarUrl || undefined}
                style={{ border: '1px solid var(--gray-5)' }}
              />
            </Flex>
          )}
        </Flex>
      </Box>

      {/* Invitation message for crew_invite - above response */}
      {matter.matter_type === 'crew_invite' && invitationMessage && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Heading size="4" mb="2">
            Message
          </Heading>
          <Box
            p="3"
            style={{
              background: 'var(--gray-a2)',
              borderRadius: 8,
            }}
          >
            <Text style={{ whiteSpace: 'pre-line' }}>{invitationMessage}</Text>
          </Box>
        </Box>
      )}

      {/* Response prompt for crew_invite - right after title */}
      {matter.matter_type === 'crew_invite' && (
        <Box mb="4" p="4">
          <Flex justify="between" align="center" mb="3">
            <Heading size="4">Your Response</Heading>
            {matter.my_response &&
              !isEditingResponse &&
              companyRole !== 'freelancer' &&
              crewInviteResponseKind(matter.my_response.response) !==
                'filled' && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    setIsEditingResponse(true)
                  }}
                >
                  <Edit width={14} height={14} /> Edit
                </Button>
              )}
          </Flex>
          {matter.my_response && !isEditingResponse ? (
            <Box
              p="3"
              style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
            >
              <Flex align="center" gap="2" mb="2">
                {crewInviteResponseKind(matter.my_response.response) ===
                  'accepted' && (
                  <Badge radius="full" color="green">
                    <Check width={12} height={12} /> Accepted
                  </Badge>
                )}
                {crewInviteResponseKind(matter.my_response.response) ===
                  'declined' && (
                  <Badge radius="full" color="red">
                    <Xmark width={12} height={12} /> Declined
                  </Badge>
                )}
                {crewInviteResponseKind(matter.my_response.response) ===
                  'filled' && (
                  <Badge radius="full" color="amber">
                    <Xmark width={12} height={12} /> Role filled
                  </Badge>
                )}
              </Flex>
              {crewInviteResponseKind(matter.my_response.response) ===
                'filled' && (
                <Text size="2" style={{ display: 'block', marginBottom: 8 }}>
                  {ROLE_FILLED_MESSAGE}. {ROLE_FILLED_DETAIL}
                </Text>
              )}
              <Text
                size="1"
                color="gray"
                style={{ display: 'block', marginTop: 8 }}
              >
                Last updated:{' '}
                {(() => {
                  const d = new Date(matter.my_response.updated_at)
                  const day = String(d.getDate()).padStart(2, '0')
                  const month = String(d.getMonth() + 1).padStart(2, '0')
                  const year = d.getFullYear()
                  const hours = String(d.getHours()).padStart(2, '0')
                  const minutes = String(d.getMinutes()).padStart(2, '0')
                  return `${year}-${month}-${day} ${hours}:${minutes}`
                })()}
              </Text>
            </Box>
          ) : (
            <Box>
              <Flex gap="2">
                <Button
                  variant="soft"
                  color="green"
                  onClick={() => respond.mutate('approved')}
                  disabled={respond.isPending}
                >
                  <Check /> Accept
                </Button>
                <Button
                  variant="soft"
                  color="red"
                  onClick={() => respond.mutate('rejected')}
                  disabled={respond.isPending}
                >
                  <Xmark /> Decline
                </Button>
              </Flex>
            </Box>
          )}
        </Box>
      )}

      {/* Job and time period details for crew_invite - show instead of content */}
      {matter.matter_type === 'crew_invite' && crewInviteDetails && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Heading size="4" mb="3">
            Job Information
          </Heading>
          <Box
            p="3"
            style={{
              background: 'var(--gray-a2)',
              borderRadius: 8,
            }}
          >
            {/* Two column layout */}
            <Flex gap="4" wrap="wrap">
              {/* Left column */}
              <Box style={{ flex: 1, minWidth: 200 }}>
                <Flex direction="column" gap="3">
                  <Flex direction="column" gap="1">
                    <Text weight="medium">Job:</Text>
                    <Text>{crewInviteDetails.job.title}</Text>
                  </Flex>
                  <Flex direction="column" gap="1">
                    <Text weight="medium">Role:</Text>
                    <Text>
                      {crewInviteDetails.timePeriod.title || 'Untitled Role'}
                    </Text>
                  </Flex>
                  {crewInviteDetails.timePeriod.role_category && (
                    <Flex direction="column" gap="1">
                      <Text weight="medium">Category:</Text>
                      <Text style={{ textTransform: 'capitalize' }}>
                        {crewInviteDetails.timePeriod.role_category}
                      </Text>
                    </Flex>
                  )}
                </Flex>
              </Box>

              {/* Right column */}
              {crewInviteDetails.timePeriod.start_at &&
                crewInviteDetails.timePeriod.end_at && (
                  <Box style={{ flex: 1, minWidth: 200 }}>
                    <Flex direction="column" gap="3">
                      <Flex direction="column" gap="1">
                        <Text weight="medium">Start:</Text>
                        <Text>
                          {formatTime(crewInviteDetails.timePeriod.start_at)}{' '}
                          {formatDate(crewInviteDetails.timePeriod.start_at)}
                        </Text>
                      </Flex>
                      <Flex direction="column" gap="1">
                        <Text weight="medium">Stop:</Text>
                        <Text>
                          {formatTime(crewInviteDetails.timePeriod.end_at)}{' '}
                          {formatDate(crewInviteDetails.timePeriod.end_at)}
                        </Text>
                      </Flex>
                      <Flex direction="column" gap="1">
                        <Text weight="medium">Duration:</Text>
                        <Text>
                          {formatDuration(
                            crewInviteDetails.timePeriod.start_at,
                            crewInviteDetails.timePeriod.end_at,
                          )}
                        </Text>
                      </Flex>
                    </Flex>
                  </Box>
                )}
            </Flex>

            {/* Address section with two columns */}
            {crewInviteDetails.job.address && (
              <Box
                mt="4"
                pt="4"
                style={{ borderTop: '1px solid var(--gray-a6)' }}
              >
                <Heading size="3" mb="3">
                  Address
                </Heading>
                <Flex gap="4" wrap="wrap">
                  {/* Left: Address text (separated) */}
                  <Box style={{ flex: 1, minWidth: 200 }}>
                    {(() => {
                      const addr = crewInviteDetails.job.address as any
                      return (
                        <Flex direction="column" gap="2">
                          {addr.address_line && (
                            <Flex direction="column" gap="1">
                              <Text weight="medium">Street:</Text>
                              <Text>{addr.address_line}</Text>
                            </Flex>
                          )}
                          {(addr.zip_code || addr.city) && (
                            <Flex direction="column" gap="1">
                              <Text weight="medium">City:</Text>
                              <Text>
                                {[addr.zip_code, addr.city]
                                  .filter(Boolean)
                                  .join(' ')}
                              </Text>
                            </Flex>
                          )}
                          {addr.country && (
                            <Flex direction="column" gap="1">
                              <Text weight="medium">Country:</Text>
                              <Text>{addr.country}</Text>
                            </Flex>
                          )}
                        </Flex>
                      )
                    })()}
                  </Box>

                  {/* Right: Map */}
                  {mapQuery && (
                    <Box style={{ flex: 1, minWidth: 200 }}>
                      <Box
                        style={{
                          width: '100%',
                          height: '200px',
                          overflow: 'hidden',
                          borderRadius: 8,
                        }}
                      >
                        <MapEmbed query={mapQuery} zoom={14} />
                      </Box>
                    </Box>
                  )}
                </Flex>
              </Box>
            )}

            {crewInviteDetails.notes && (
              <Box
                mt="4"
                pt="4"
                style={{ borderTop: '1px solid var(--gray-a6)' }}
              >
                <Flex direction="column" gap="1">
                  <Text weight="medium">Notes:</Text>
                  <Text>{crewInviteDetails.notes}</Text>
                </Flex>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Content - crew-response updates get a status banner instead of plain text */}
      {outcome ? (
        <MatterOutcomeBanner
          outcome={outcome}
          jobTitle={matter.job?.title}
          roleTitle={matter.time_period?.title}
        />
      ) : (
        matter.content &&
        matter.matter_type !== 'crew_invite' && (
          <Box mb="4">
            <Separator size="4" mb="3" />
            <Text style={{ whiteSpace: 'pre-line' }}>{matter.content}</Text>
          </Box>
        )
      )}

      {/* Link to latest update if this is a notification about an activity */}
      {activityId && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Button
            variant="soft"
            onClick={() => {
              navigate({
                to: '/latest',
                search: { activityId },
              })
            }}
          >
            View Update <ArrowRight width={16} height={16} />
          </Button>
        </Box>
      )}

      {matterFiles.length > 0 && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Heading size="4" mb="2">
            Attachments
          </Heading>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matterFiles.map((file) => (
              <Flex
                key={file.id}
                align="center"
                justify="between"
                p="2"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 6,
                  background: 'var(--gray-a2)',
                }}
              >
                <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
                  <Text size="2" truncate>
                    {file.filename}
                  </Text>
                  {file.size_bytes && (
                    <Text size="1" color="gray">
                      ({(file.size_bytes / 1024).toFixed(1)} KB)
                    </Text>
                  )}
                </Flex>
                <Button
                  size="1"
                  variant="soft"
                  onClick={async () => {
                    const { data } = await supabase.storage
                      .from('matter_files')
                      .download(file.path)

                    if (data && file.filename) {
                      const url = window.URL.createObjectURL(data)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = file.filename
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    }
                  }}
                >
                  <Download width={14} height={14} /> Download
                </Button>
              </Flex>
            ))}
          </Box>
        </Box>
      )}

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>Delete Matter</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete this matter? This action cannot be
            undone.
          </Dialog.Description>
          <Flex mt="4" gap="2" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {canSeeAnnouncementRecipients && recipients.length > 0 && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Heading size="4" mb="2">
            Recipients ({recipients.length})
          </Heading>
          <Box
            mb="3"
            p="3"
            style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
          >
            {recipientSummary.allViewed ? (
              <Text size="3" weight="medium" color="green">
                All recipients have opened this matter
              </Text>
            ) : (
              <Flex direction="column" gap="1">
                <Text size="3" weight="medium">
                  {recipientSummary.pendingCount} of{' '}
                  {recipientSummary.totalRecipients} not yet opened
                </Text>
                <Text size="2" color="gray">
                  {recipientSummary.viewedCount} of{' '}
                  {recipientSummary.totalRecipients} opened
                </Text>
              </Flex>
            )}
          </Box>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Opened</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recipients.map((r) => {
                const isViewed = !!r.viewed_at
                return (
                  <Table.Row key={r.id}>
                    <Table.Cell>
                      {r.user?.display_name || r.user?.email || 'Unknown'}
                    </Table.Cell>
                    <Table.Cell>
                      {isViewed ? (
                        <Badge radius="full" size="1" color="green">
                          Yes
                        </Badge>
                      ) : (
                        <Badge radius="full" size="1" color="orange">
                          No
                        </Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  )
}
