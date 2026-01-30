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
  Tabs,
  Text,
  TextArea,
} from '@radix-ui/themes'
import {
  ArrowRight,
  Check,
  Download,
  Edit,
  Send,
  Trash,
  Xmark,
} from 'iconoir-react'
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
  markMatterAsViewed,
  matterDetailQuery,
  matterFilesQuery,
  matterMessagesQuery,
  matterRecipientsQuery,
  matterResponsesQuery,
  respondToMatter,
  sendMessage,
} from '../api/queries'

export default function MatterDetail({
  matterId,
  onDeleted,
}: {
  matterId: string
  onDeleted?: () => void
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const { user } = useAuth()
  const { companyId } = useCompany()
  const { companyRole } = useAuthz()
  const navigate = useNavigate()
  const [newMessage, setNewMessage] = React.useState('')
  const [isEditingResponse, setIsEditingResponse] = React.useState(false)

  const { data: matter } = useQuery({
    ...matterDetailQuery(matterId),
  })

  const { data: recipients = [] } = useQuery({
    ...matterRecipientsQuery(matterId),
  })

  const { data: responses = [] } = useQuery({
    ...matterResponsesQuery(matterId),
  })

  const { data: messages = [] } = useQuery({
    ...matterMessagesQuery(matterId),
  })

  const { data: files } = useQuery({
    ...matterFilesQuery(matterId),
  })
  const matterFiles = files || []

  // Get invitation message (first message from creator) for crew_invite
  const invitationMessage = React.useMemo(() => {
    if (
      !matter ||
      matter.matter_type !== 'crew_invite' ||
      !matter.created_by_user_id
    ) {
      return null
    }
    // Find the first message from the creator
    const creatorMessage = messages.find(
      (msg) => msg.user_id === matter.created_by_user_id,
    )
    return creatorMessage ? creatorMessage.content : null
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
    onSuccess: async () => {
      // Invalidate all matters queries to ensure the table refreshes
      await qc.invalidateQueries({ queryKey: ['matters'] })
      // Specifically invalidate the index query if we have companyId
      if (companyId) {
        await qc.invalidateQueries({
          queryKey: ['matters', 'index', companyId],
        })
      }
      success('Matter deleted', 'The matter has been deleted.')
      setDeleteOpen(false)
      onDeleted?.()
    },
    onError: (e: any) => {
      toastError('Failed to delete matter', e?.message || 'Please try again.')
    },
  })

  // Calculate recipient summary (must be at component level, not in JSX)
  const recipientSummary = React.useMemo(() => {
    const totalRecipients = recipients.length
    const respondedCount = recipients.filter((r) => !!r.response).length
    const viewedCount = recipients.filter((r) => r.viewed_at).length
    const pendingCount = totalRecipients - respondedCount
    const allResponded =
      respondedCount === totalRecipients && totalRecipients > 0

    return {
      totalRecipients,
      respondedCount,
      viewedCount,
      pendingCount,
      allResponded,
    }
  }, [recipients])

  // Track if we've already marked this matter as viewed to prevent duplicate calls
  const hasMarkedAsViewedRef = React.useRef<string | null>(null)

  // Mark as viewed when component mounts (only once per matterId)
  React.useEffect(() => {
    // Skip if we've already marked this matter as viewed
    if (hasMarkedAsViewedRef.current === matterId) return

    // Skip if matter is not loaded yet
    if (!matter) return

    // Skip if user is the creator AND it was not created as company.
    // Company-created matters can be delivered to the creator's inbox and should be markable as read.
    if (user?.id === matter.created_by_user_id && !matter.created_as_company) {
      hasMarkedAsViewedRef.current = matterId
      return
    }

    // Mark that we're processing this matter
    hasMarkedAsViewedRef.current = matterId

    // Mark as viewed and then invalidate queries
    markMatterAsViewed(matterId)
      .then(async () => {
        // Invalidate and refetch queries to ensure UI updates immediately
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['matters'] }),
        ])
        // Force refetch to ensure fresh data
        await Promise.all([
          qc.refetchQueries({ queryKey: ['matters'] }),
        ])
      })
      .catch((error) => {
        // If marking as viewed fails, reset the ref so we can try again
        console.error('Failed to mark matter as viewed:', error)
        hasMarkedAsViewedRef.current = null
      })

    // Reset ref when matterId changes
    return () => {
      if (hasMarkedAsViewedRef.current === matterId) {
        hasMarkedAsViewedRef.current = null
      }
    }
  }, [matterId, matter, user?.id, qc])

  const respond = useMutation({
    mutationFn: async (response: string) => {
      await respondToMatter(matterId, response)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matters', 'detail', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'responses', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'recipients', matterId] })
      // If this is a crew_invite, also invalidate crew queries
      if (matter?.matter_type === 'crew_invite' && matter.job_id) {
        qc.invalidateQueries({ queryKey: ['jobs.crew', matter.job_id] })
        qc.invalidateQueries({
          queryKey: ['jobs', matter.job_id, 'time_periods'],
        })
      }
      success('Success', 'Response recorded')
      setIsEditingResponse(false)
    },
    onError: (e: any) => {
      toastError('Failed', e?.message || 'Could not record response')
    },
  })

  const send = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim()) {
        throw new Error('Message cannot be empty')
      }
      await sendMessage(matterId, newMessage)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matters', 'messages', matterId] })
      setNewMessage('')
    },
    onError: (e: any) => {
      toastError('Failed', e?.message || 'Could not send message')
    },
  })

  // Build address string for map query (must be before early return to follow Rules of Hooks)
  const mapQuery = React.useMemo(() => {
    if (!crewInviteDetails) return null
    const job = crewInviteDetails.job
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

  // Using shared getInitials from generalFunctions

  const leadName = projectLead?.display_name || projectLead?.email || null
  const leadInitials = leadName ? getInitials(leadName) : ''

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
      crew_invite: { color: 'blue', label: 'Crew Invitation' },
      vote: { color: 'purple', label: 'Vote' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat' },
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
            {matter.job?.id && (
              <Button
                size="2"
                variant="soft"
                onClick={() =>
                  navigate({
                    to: '/jobs',
                    search: { jobId: matter.job?.id, tab: undefined },
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
            {matter.created_as_company && matter.company ? (
              <Text size="2" color="gray">
                Created by {matter.company.name} on{' '}
                {formatDate(matter.created_at)}
              </Text>
            ) : (
              matter.created_by && (
                <Text size="2" color="gray">
                  Created by{' '}
                  {matter.created_by.display_name || matter.created_by.email} on{' '}
                  {formatDate(matter.created_at)}
                </Text>
              )
            )}
          </Box>
          {projectLead && (
            <Flex align="center" gap="2">
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
              companyRole !== 'freelancer' && (
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
                {matter.my_response.response.toLowerCase() === 'approved' && (
                  <Badge radius="full" color="green">
                    <Check width={12} height={12} /> Accepted
                  </Badge>
                )}
                {matter.my_response.response.toLowerCase() === 'rejected' && (
                  <Badge radius="full" color="red">
                    <Xmark width={12} height={12} /> Declined
                  </Badge>
                )}
              </Flex>
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

      {/* Content - only show for non-crew_invite matters (crew_invite shows formatted job info above) */}
      {matter.content && matter.matter_type !== 'crew_invite' && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Text style={{ whiteSpace: 'pre-line' }}>{matter.content}</Text>
        </Box>
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

      {/* Tabs - hide for crew_invite */}
      {matter.matter_type !== 'crew_invite' && (
        <Tabs.Root
          defaultValue={
            matter.matter_type === 'vote'
              ? 'responses'
              : matter.matter_type === 'announcement'
                ? user?.id === matter.created_by_user_id
                  ? 'recipients'
                  : undefined
                : 'chat'
          }
        >
          <Tabs.List>
            {matter.matter_type === 'vote' && (
              <Tabs.Trigger value="responses">
                Responses ({responses.length})
              </Tabs.Trigger>
            )}
            {matter.matter_type !== 'announcement' &&
              !(matter.matter_type === 'vote' && matter.is_anonymous) && (
                <Tabs.Trigger value="chat">
                  Chat ({messages.length})
                </Tabs.Trigger>
              )}
            {(matter.matter_type !== 'announcement' ||
              user?.id === matter.created_by_user_id) && (
              <Tabs.Trigger value="recipients">Recipients</Tabs.Trigger>
            )}
          </Tabs.List>

          <Box mt="3">
            {(matter.matter_type !== 'announcement' ||
              user?.id === matter.created_by_user_id) && (
              <Tabs.Content value="recipients">
                {/* For anonymous votes, only show summary count, not individual recipients */}
                {matter.matter_type === 'vote' && matter.is_anonymous ? (
                  <Box
                    mb="4"
                    p="3"
                    style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
                  >
                    <Flex direction="column" gap="1">
                      <Text size="3" weight="medium">
                        {recipientSummary.respondedCount} of{' '}
                        {recipientSummary.totalRecipients} recipient
                        {recipientSummary.totalRecipients !== 1 ? 's' : ''} have
                        responded
                      </Text>
                      <Text size="2" color="gray" mt="2">
                        This is an anonymous vote. Individual responses and
                        viewing status are hidden.
                      </Text>
                    </Flex>
                  </Box>
                ) : (
                  <>
                    {/* Summary message */}
                    <Box
                      mb="4"
                      p="3"
                      style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
                    >
                      {recipientSummary.allResponded ? (
                        <Text size="3" weight="medium" color="green">
                          ✓ All recipients have responded
                        </Text>
                      ) : (
                        <Flex direction="column" gap="1">
                          <Text size="3" weight="medium">
                            {recipientSummary.pendingCount} of{' '}
                            {recipientSummary.totalRecipients} recipient
                            {recipientSummary.pendingCount !== 1
                              ? 's'
                              : ''}{' '}
                            {recipientSummary.pendingCount === 1
                              ? 'has'
                              : 'have'}{' '}
                            not responded
                          </Text>
                          <Text size="2" color="gray">
                            {recipientSummary.viewedCount} of{' '}
                            {recipientSummary.totalRecipients} viewed
                          </Text>
                        </Flex>
                      )}
                    </Box>

                    <Table.Root variant="surface">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Viewed
                          </Table.ColumnHeaderCell>
                          {matter.matter_type === 'vote' && (
                            <Table.ColumnHeaderCell>
                              Responded
                            </Table.ColumnHeaderCell>
                          )}
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {recipients.map((r) => {
                          const isViewed = !!r.viewed_at

                          // Determine viewed badge color
                          const viewedColor = isViewed ? 'green' : 'orange'

                          return (
                            <Table.Row key={r.id}>
                              <Table.Cell>
                                {r.user?.display_name ||
                                  r.user?.email ||
                                  'Unknown'}
                              </Table.Cell>
                              <Table.Cell>
                                {isViewed ? (
                                  <Badge
                                    radius="full"
                                    size="1"
                                    color={viewedColor}
                                  >
                                    Viewed
                                  </Badge>
                                ) : (
                                  <Badge radius="full" size="1" color="orange">
                                    Pending
                                  </Badge>
                                )}
                              </Table.Cell>
                              {matter.matter_type === 'vote' && (
                                <Table.Cell>
                                  {r.response ? (
                                    <Badge
                                      radius="full"
                                      size="1"
                                      color={
                                        r.response.response.toLowerCase() ===
                                        'approved'
                                          ? 'green'
                                          : r.response.response.toLowerCase() ===
                                              'rejected'
                                            ? 'red'
                                            : 'blue'
                                      }
                                    >
                                      {r.response.response.toLowerCase() ===
                                      'approved'
                                        ? 'Approved'
                                        : r.response.response.toLowerCase() ===
                                            'rejected'
                                          ? 'Rejected'
                                          : r.response.response}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      radius="full"
                                      size="1"
                                      color="orange"
                                    >
                                      Pending
                                    </Badge>
                                  )}
                                </Table.Cell>
                              )}
                            </Table.Row>
                          )
                        })}
                      </Table.Body>
                    </Table.Root>
                  </>
                )}
              </Tabs.Content>
            )}

            {matter.matter_type === 'vote' && (
              <Tabs.Content value="responses">
                {/* Vote summary counters */}
                {responses.length > 0 && (
                  <Box
                    mb="4"
                    p="3"
                    style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
                  >
                    <Flex align="center" gap="4">
                      <Flex align="center" gap="2">
                        <Badge radius="full" color="green">
                          <Check width={14} height={14} />
                        </Badge>
                        <Text weight="medium">
                          {
                            responses.filter(
                              (r) => r.response.toLowerCase() === 'approved',
                            ).length
                          }{' '}
                          For
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Badge radius="full" color="red">
                          <Xmark width={14} height={14} />
                        </Badge>
                        <Text weight="medium">
                          {
                            responses.filter(
                              (r) => r.response.toLowerCase() === 'rejected',
                            ).length
                          }{' '}
                          Against
                        </Text>
                      </Flex>
                    </Flex>
                    {matter.is_anonymous && (
                      <Text size="2" color="gray" mt="2">
                        {responses.length} of {recipientSummary.totalRecipients}{' '}
                        recipient
                        {recipientSummary.totalRecipients !== 1 ? 's' : ''} have
                        responded. Individual responses are hidden for
                        anonymity.
                      </Text>
                    )}
                  </Box>
                )}

                <Box mb="4">
                  <Flex justify="between" align="center" mb="3">
                    <Heading size="4">Your Response</Heading>
                    {matter.my_response && !isEditingResponse && (
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
                        {matter.my_response.response.toLowerCase() ===
                          'approved' && (
                          <Badge radius="full" color="green">
                            <Check width={12} height={12} /> Approved
                          </Badge>
                        )}
                        {matter.my_response.response.toLowerCase() ===
                          'rejected' && (
                          <Badge radius="full" color="red">
                            <Xmark width={12} height={12} /> Rejected
                          </Badge>
                        )}
                      </Flex>
                      <Text
                        size="1"
                        color="gray"
                        style={{ display: 'block', marginTop: 8 }}
                      >
                        Last updated:{' '}
                        {formatDate(matter.my_response.updated_at)}{' '}
                        {formatTime(matter.my_response.updated_at)}
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
                          <Check /> Approve
                        </Button>
                        <Button
                          variant="soft"
                          color="red"
                          onClick={() => respond.mutate('rejected')}
                          disabled={respond.isPending}
                        >
                          <Xmark /> Reject
                        </Button>
                      </Flex>
                    </Box>
                  )}
                </Box>

                {/* For anonymous votes, hide individual responses list */}
                {!matter.is_anonymous && (
                  <>
                    <Separator size="4" mb="3" />

                    <Heading size="4" mb="3">
                      All Responses ({responses.length})
                    </Heading>
                    {responses.length === 0 ? (
                      <Text color="gray">No responses yet</Text>
                    ) : (
                      <Box
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {responses.map((r) => {
                          const isApproved =
                            r.response.toLowerCase() === 'approved'
                          const isRejected =
                            r.response.toLowerCase() === 'rejected'
                          const showName =
                            !matter.is_anonymous ||
                            r.user_id === matter.created_by_user_id

                          return (
                            <Box
                              key={r.id}
                              p="3"
                              style={{
                                border: '1px solid var(--gray-a6)',
                                borderRadius: 8,
                                background: 'var(--gray-a2)',
                              }}
                            >
                              <Flex align="center" gap="2" mb="2">
                                {isApproved && (
                                  <Badge radius="full" color="green">
                                    <Check width={12} height={12} /> Approved
                                  </Badge>
                                )}
                                {isRejected && (
                                  <Badge radius="full" color="red">
                                    <Xmark width={12} height={12} /> Rejected
                                  </Badge>
                                )}
                                <Text weight="medium">
                                  {showName
                                    ? r.user?.display_name ||
                                      r.user?.email ||
                                      'Unknown'
                                    : 'Anonymous'}
                                </Text>
                                <Text size="1" color="gray">
                                  {formatDate(r.created_at)}{' '}
                                  {formatTime(r.created_at)}
                                </Text>
                              </Flex>
                              {!isApproved && !isRejected && (
                                <Text>{r.response}</Text>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    )}
                  </>
                )}
              </Tabs.Content>
            )}

            {!(matter.matter_type === 'vote' && matter.is_anonymous) && (
              <Tabs.Content value="chat">
                <Box
                  mb="4"
                  style={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: 12,
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 8,
                    background: 'var(--gray-a1)',
                  }}
                >
                  {messages.length === 0 ? (
                    <Text color="gray" style={{ textAlign: 'center' }}>
                      No messages yet. Start the conversation!
                    </Text>
                  ) : (
                    messages.map((msg) => {
                      const isMyMessage = msg.user_id === user?.id
                      return (
                        <Box
                          key={msg.id}
                          style={{
                            display: 'flex',
                            justifyContent: isMyMessage
                              ? 'flex-end'
                              : 'flex-start',
                            width: '100%',
                          }}
                        >
                          <Box
                            p="2"
                            style={{
                              background: isMyMessage
                                ? 'var(--blue-a3)'
                                : 'var(--gray-a2)',
                              borderRadius: 6,
                              maxWidth: '80%',
                            }}
                          >
                            {!isMyMessage && (
                              <Text
                                size="1"
                                weight="medium"
                                color="gray"
                                style={{ display: 'block', marginBottom: 4 }}
                              >
                                {msg.user?.display_name ||
                                  msg.user?.email ||
                                  'Unknown'}
                              </Text>
                            )}
                            <Text>{msg.content}</Text>
                            <Text
                              size="1"
                              color="gray"
                              style={{ display: 'block', marginTop: 4 }}
                            >
                              {(() => {
                                const d = new Date(msg.created_at)
                                const hours = String(d.getHours()).padStart(
                                  2,
                                  '0',
                                )
                                const minutes = String(d.getMinutes()).padStart(
                                  2,
                                  '0',
                                )
                                return `${hours}:${minutes}`
                              })()}
                            </Text>
                          </Box>
                        </Box>
                      )
                    })
                  )}
                </Box>

                <Flex gap="2">
                  <TextArea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        send.mutate()
                      }
                    }}
                    rows={2}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={() => send.mutate()}
                    disabled={!newMessage.trim() || send.isPending}
                  >
                    <Send width={16} height={16} /> Send
                  </Button>
                </Flex>
              </Tabs.Content>
            )}
          </Box>
        </Tabs.Root>
      )}
    </Box>
  )
}
