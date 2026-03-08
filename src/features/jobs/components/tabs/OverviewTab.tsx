import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Dialog,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Skeleton,
  Text,
} from '@radix-ui/themes'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { prettyPhone } from '@shared/phone/phone'
import { useAuthz } from '@shared/auth/useAuthz'
import { Edit } from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { logActivity } from '@features/latest/api/queries'
import {
  getJobStatusColor,
  getStatusTimelineColors,
} from '@features/jobs/utils/statusColors'
import AddressDialog from '../dialogs/AddressDialog'
import ContactDialog from '../dialogs/ContactDialog'
import type { JobDetail, JobStatus } from '../../types'

// Main flow statuses (canceled is separate)
const JOB_STATUS_FLOW: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
]

// Get timeline colors using centralized status color system
const STATUS_COLORS: Record<
  JobStatus,
  { bg: string; border: string; text: string; dotBg: string }
> = {
  draft: getStatusTimelineColors('draft'),
  planned: getStatusTimelineColors('planned'),
  requested: getStatusTimelineColors('requested'),
  confirmed: getStatusTimelineColors('confirmed'),
  in_progress: getStatusTimelineColors('in_progress'),
  completed: getStatusTimelineColors('completed'),
  invoiced: getStatusTimelineColors('invoiced'),
  paid: getStatusTimelineColors('paid'),
  canceled: getStatusTimelineColors('canceled'),
}

// Helper function to mask status for freelancers
function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    // Freelancers should not see statuses beyond 'completed'
    if (status === 'invoiced' || status === 'paid') {
      return 'completed'
    }
  }
  return status
}

const OverviewTab = ({ job }: { job: JobDetail }) => {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const addr = job.address
    ? [
        job.address.address_line,
        job.address.zip_code,
        job.address.city,
        job.address.country,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  const [editOpen, setEditOpen] = React.useState(false)
  const [contactOpen, setContactOpen] = React.useState(false)

  return (
    <Box style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      {/* Job Status Timeline - Hidden for freelancers */}
      {!isReadOnly && (
        <Card mb="4" style={{ background: 'var(--gray-a2)' }}>
          <Heading size="3" mb="3">
            Job Status
          </Heading>
          <JobStatusTimeline
            jobId={job.id}
            currentStatus={job.status}
            jobTitle={job.title}
            companyId={job.company_id}
          />
        </Card>
      )}
      <Box>
        <Heading size="3">General</Heading>
        <Separator size="4" mb="3" />
        <KV label="Project lead">
          {job.project_lead?.display_name ?? '—'}
          <span style={{ color: 'var(--gray-11)' }}>
            {job.project_lead?.email ? ` (${job.project_lead.email})` : ''}
          </span>
        </KV>
        <KV label="Customer">
          {job.customer?.name ??
            job.customer_user?.display_name ??
            job.customer_user?.email ??
            '—'}
        </KV>
        <Box>
          <Flex align={'center'} gap={'2'} mb={'2'}>
            <Text size="2" color="gray" style={{ display: 'block' }}>
              Contact
            </Text>
            {!isReadOnly && job.customer && job.customer_contact && (
              <IconButton
                variant="ghost"
                size="1"
                onClick={() => setContactOpen(true)}
              >
                <Edit fontSize={'0.8rem'} />
              </IconButton>
            )}
          </Flex>
          {job.customer_contact ? (
            <Grid columns={{ initial: '1', sm: '3' }} gap="4">
              <KV label="Name">{job.customer_contact.name ?? '—'}</KV>
              <KV label="Email">
                {job.customer_contact.email ? (
                  <a
                    href={`mailto:${job.customer_contact.email}`}
                    style={{ color: 'inherit' }}
                  >
                    {job.customer_contact.email}
                  </a>
                ) : (
                  '—'
                )}
              </KV>
              <KV label="Phone">
                {job.customer_contact.phone ? (
                  <a
                    href={`tel:${job.customer_contact.phone}`}
                    style={{ color: 'inherit' }}
                  >
                    {prettyPhone(job.customer_contact.phone)}
                  </a>
                ) : (
                  '—'
                )}
              </KV>
            </Grid>
          ) : (
            !isReadOnly &&
            job.customer && (
              <Button
                size="3"
                variant="soft"
                onClick={() => setContactOpen(true)}
                style={{ marginBottom: '16px' }}
              >
                Add contact
              </Button>
            )
          )}
          <ContactDialog
            open={contactOpen}
            onOpenChange={setContactOpen}
            companyId={job.company_id}
            job={job}
          />
        </Box>
        <Separator size="4" mb="2" />
        <Grid columns={{ initial: '1', sm: '2' }} gap="4">
          <KV label="Start">
            <Code>{fmt(job.start_at)}</Code>
          </KV>
          <KV label="End">
            <Code>{fmt(job.end_at)}</Code>
          </KV>
        </Grid>
      </Box>
      <Box>
        <Flex align={'center'} gap={'2'} mt={'1'}>
          <Heading size="3">Location</Heading>
          {!isReadOnly && job.address && (
            <IconButton variant="ghost" onClick={() => setEditOpen(true)}>
              <Edit fontSize={'0.8rem'} />
            </IconButton>
          )}
          <AddressDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            companyId={job.company_id}
            mode="edit"
            initialData={job}
          />
        </Flex>
        <Separator size="4" mb="3" />
        {job.address ? (
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <Box>
              <KV label="Name">
                <Flex align={'center'} gap={'2'}>
                  {job.address.name || '—'}
                </Flex>
              </KV>
              <KV label="Address">{job.address.address_line || '—'}</KV>
              <Grid columns={'2'} gap={'4'}>
                <KV label="Zip code">{job.address.zip_code || '-'}</KV>
                <KV label="City">{job.address.city || '-'}</KV>
              </Grid>
              <KV label="Country">{job.address.country || '—'}</KV>
            </Box>
            {addr && (
              <Box
                mb="3"
                style={{
                  maxWidth: 'min(400px, 100%)',
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: 8,
                }}
              >
                <MapWithSkeleton query={addr} zoom={14} />
              </Box>
            )}
          </Grid>
        ) : (
          !isReadOnly && (
            <Button size="3" variant="soft" onClick={() => setEditOpen(true)}>
              Add location
            </Button>
          )
        )}
      </Box>
    </Box>
  )
}

export default OverviewTab

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Text style={{ display: 'block' }} size="2" color="gray">
        {label}
      </Text>
      <Text>{children}</Text>
    </div>
  )
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ` ${hours}:${minutes}`
  )
}

function MapWithSkeleton({ query, zoom }: { query: string; zoom?: number }) {
  const [isLoading, setIsLoading] = React.useState(true)

  return (
    <Box style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      {isLoading && (
        <Skeleton
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            width: '100%',
            height: '100%',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        <iframe
          title="Google Maps location"
          src={buildMapUrl(query, zoom)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          style={{
            border: 0,
            width: '100%',
            height: '100%',
            borderRadius: 8,
          }}
        />
      </div>
    </Box>
  )
}

function buildMapUrl(query: string, zoom?: number) {
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_API_KEY as
    | string
    | undefined
  if (!mapsKey) return ''

  const url = new URL('https://www.google.com/maps/embed/v1/place')
  url.searchParams.set('q', query)
  if (zoom != null) url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('key', mapsKey)
  return url.toString()
}

function JobStatusTimeline({
  jobId,
  currentStatus,
  jobTitle,
  companyId,
}: {
  jobId: string
  currentStatus: JobStatus
  jobTitle: string
  companyId: string
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { companyRole } = useAuthz()
  const displayStatus = getDisplayStatus(currentStatus, companyRole)
  const isCanceled = displayStatus === 'canceled'
  const [showArchivePrompt, setShowArchivePrompt] = React.useState(false)

  const updateStatus = useMutation({
    mutationFn: async (newStatus: JobStatus) => {
      const previousStatus = currentStatus
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
      if (updateError) throw updateError

      // Log activity if status changed to confirmed, canceled, or paid
      if (
        previousStatus !== newStatus &&
        (newStatus === 'confirmed' ||
          newStatus === 'canceled' ||
          newStatus === 'paid')
      ) {
        try {
          await logActivity({
            companyId,
            activityType: 'job_status_changed',
            metadata: {
              job_id: jobId,
              job_title: jobTitle,
              previous_status: previousStatus,
              new_status: newStatus,
            },
            title: jobTitle,
          })
        } catch (logErr) {
          console.error('Failed to log job status change activity:', logErr)
          // Don't fail the whole status update if logging fails
        }
      }

      return newStatus
    },
    onSuccess: async (newStatus) => {
      // Invalidate and refetch queries
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
        // Force refetch of latest feed to ensure new activity appears immediately
        qc.refetchQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      success(
        'Status updated',
        `Job status changed to ${makeWordPresentable(newStatus)}`,
      )
      if (newStatus === 'canceled') {
        setShowArchivePrompt(true)
      }
    },
    onError: (err: any) => {
      error('Failed to update status', err?.message || 'Please try again.')
    },
  })

  const archiveJob = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ archived: true })
        .eq('id', jobId)
      if (updateError) throw updateError
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({ queryKey: ['jobs-index'] }),
      ])
      setShowArchivePrompt(false)
      success('Job archived', 'The job has been archived.')
    },
    onError: (err: any) => {
      error('Failed to archive job', err?.message || 'Please try again.')
    },
  })

  const handleStatusClick = (status: JobStatus) => {
    if (companyRole === 'freelancer' || updateStatus.isPending || status === displayStatus) return
    updateStatus.mutate(status)
  }

  const handleCanceledClick = () => {
    if (companyRole === 'freelancer' || updateStatus.isPending || isCanceled) return
    updateStatus.mutate('canceled')
  }

  // Filter statuses for freelancers - only show up to 'completed'
  const flowStatuses = React.useMemo(() => {
    if (companyRole === 'freelancer') {
      return JOB_STATUS_FLOW.filter((s) => s !== 'invoiced' && s !== 'paid')
    }
    return JOB_STATUS_FLOW
  }, [companyRole])

  // Find current position in flow
  const currentFlowIndex = flowStatuses.indexOf(displayStatus)

  const isMobile = useMediaQuery('(max-width: 768px)')
  const mobileSplit = 4
  const row1Statuses = flowStatuses.slice(0, mobileSplit)
  const row2Statuses = flowStatuses.slice(mobileSplit)

  const renderStatusRow = (statusesInRow: Array<JobStatus>) =>
    statusesInRow.map((status, idx) => {
      const isActive = status === displayStatus && !isCanceled
      const statusIndex = flowStatuses.indexOf(status)
      const isPast = !isCanceled && statusIndex < currentFlowIndex && statusIndex >= 0
      const isFuture = statusIndex > currentFlowIndex
      const colors = STATUS_COLORS[status]
      const nextInRow = statusesInRow[idx + 1] as JobStatus | undefined
      const nextColors = nextInRow != null ? STATUS_COLORS[nextInRow] : null
      return (
        <React.Fragment key={status}>
          <Flex
            direction="column"
            align="center"
            style={{
              flex: 1,
              position: 'relative',
              cursor: companyRole === 'freelancer' ? 'default' : 'pointer',
              opacity: updateStatus.isPending ? 0.5 : 1,
              pointerEvents: companyRole === 'freelancer' ? 'none' : 'auto',
              minWidth: 0,
            }}
            onClick={() => handleStatusClick(status)}
          >
            {idx < statusesInRow.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: 'calc(50% + 14px)',
                  width: 'calc(100% - 28px)',
                  height: '2px',
                  background:
                    isPast || isActive
                      ? nextColors
                        ? `linear-gradient(to right, ${colors.dotBg}, ${nextColors.dotBg})`
                        : colors.dotBg
                      : 'var(--gray-a4)',
                  zIndex: 0,
                  borderRadius: '1px',
                  transition: 'background 0.4s ease',
                  opacity: isFuture ? 0.4 : 1,
                  transform: 'translateY(-1px)',
                }}
              />
            )}
            <Box
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isActive ? colors.dotBg : isPast ? colors.dotBg : 'var(--gray-a3)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="status-dot"
            >
              {(isPast || (isActive && status === 'paid')) && (
                <Text size="1" weight="bold" style={{ color: 'white', fontSize: '12px' }}>✓</Text>
              )}
              {isActive && status !== 'paid' && (
                <Box style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
              )}
            </Box>
            <Text
              size="1"
              mt="2"
              weight={isActive ? 'medium' : 'regular'}
              style={{
                color: isActive || isPast ? colors.text : 'var(--gray-a9)',
                textAlign: 'center',
                transition: 'color 0.3s ease',
                fontSize: '11px',
                opacity: isFuture ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {makeWordPresentable(status)}
            </Text>
          </Flex>
        </React.Fragment>
      )
    })

  return (
    <Box>
      {/* Main Flow Timeline */}
      <Flex direction="column" gap="3" mb="4">
        {isMobile ? (
          <>
            <Flex align="center" gap="1" style={{ position: 'relative' }}>
              <Flex align="center" style={{ flex: 1 }} gap="0">
                {renderStatusRow(row1Statuses)}
              </Flex>
            </Flex>
            <Flex align="center" gap="1" style={{ position: 'relative' }}>
              <Flex align="center" style={{ flex: 1 }} gap="0">
                {renderStatusRow(row2Statuses)}
              </Flex>
              {!isCanceled && (
                <Box
                  style={{
                    width: '1px',
                    height: '50px',
                    background: 'var(--gray-a4)',
                    margin: '0 5px',
                    opacity: 0.5,
                  }}
                />
              )}
              <Flex
                direction="column"
                align="center"
                style={{
                  cursor: companyRole === 'freelancer' ? 'default' : 'pointer',
                  opacity: updateStatus.isPending ? 0.5 : 1,
                  pointerEvents: companyRole === 'freelancer' ? 'none' : 'auto',
                  minWidth: '70px',
                }}
                onClick={handleCanceledClick}
              >
                <Box
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isCanceled ? STATUS_COLORS.canceled.dotBg : 'var(--gray-a3)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  className="status-dot"
                >
                  {isCanceled && (
                    <Text size="1" weight="bold" style={{ color: 'white', fontSize: '12px' }}>✕</Text>
                  )}
                </Box>
                <Text
                  size="1"
                  mt="2"
                  weight={isCanceled ? 'medium' : 'regular'}
                  style={{
                    color: isCanceled ? STATUS_COLORS.canceled.text : 'var(--gray-a9)',
                    textAlign: 'center',
                    transition: 'color 0.3s ease',
                    fontSize: '11px',
                    opacity: !isCanceled ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {makeWordPresentable('canceled')}
                </Text>
              </Flex>
            </Flex>
          </>
        ) : (
        <Flex align="center" gap="1" style={{ position: 'relative' }}>
          {/* Main Flow Statuses */}
          <Flex align="center" style={{ flex: 1 }} gap="0">
            {flowStatuses.map((status, idx) => {
              const isActive = status === displayStatus && !isCanceled
              const statusIndex = flowStatuses.indexOf(status)
              const isPast =
                !isCanceled &&
                statusIndex < currentFlowIndex &&
                statusIndex >= 0
              const isFuture = statusIndex > currentFlowIndex
              const colors = STATUS_COLORS[status]
              const nextColors =
                idx < flowStatuses.length - 1
                  ? STATUS_COLORS[flowStatuses[idx + 1]]
                  : null

              return (
                <React.Fragment key={status}>
                  <Flex
                    direction="column"
                    align="center"
                    style={{
                      flex: 1,
                      position: 'relative',
                      cursor:
                        companyRole === 'freelancer' ? 'default' : 'pointer',
                      opacity: updateStatus.isPending ? 0.5 : 1,
                      pointerEvents:
                        companyRole === 'freelancer' ? 'none' : 'auto',
                      minWidth: 0,
                    }}
                    onClick={() => handleStatusClick(status)}
                  >
                    {/* Connector line to next status */}
                    {idx < flowStatuses.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: 'calc(50% + 14px)', // Start from right edge of current dot (14px = half of 28px dot)
                          width: 'calc(100% - 28px)', // Span to left edge of next dot (full width minus dot diameter)
                          height: '2px',
                          background:
                            isPast || isActive
                              ? nextColors
                                ? `linear-gradient(to right, ${colors.dotBg}, ${nextColors.dotBg})`
                                : colors.dotBg
                              : 'var(--gray-a4)',
                          zIndex: 0,
                          borderRadius: '1px',
                          transition: 'background 0.4s ease',
                          opacity: isFuture ? 0.4 : 1,
                          transform: 'translateY(-1px)', // Center vertically on the dot center line
                        }}
                      />
                    )}

                    {/* Status dot */}
                    <Box
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isActive
                          ? colors.dotBg
                          : isPast
                            ? colors.dotBg
                            : 'var(--gray-a3)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                        position: 'relative',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      className="status-dot"
                    >
                      {(isPast || (isActive && status === 'paid')) && (
                        <Text
                          size="1"
                          weight="bold"
                          style={{ color: 'white', fontSize: '12px' }}
                        >
                          ✓
                        </Text>
                      )}
                      {isActive && status !== 'paid' && (
                        <Box
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'white',
                          }}
                        />
                      )}
                    </Box>

                    {/* Status label */}
                    <Text
                      size="1"
                      mt="2"
                      weight={isActive ? 'medium' : 'regular'}
                      style={{
                        color:
                          isActive || isPast ? colors.text : 'var(--gray-a9)',
                        textAlign: 'center',
                        transition: 'color 0.3s ease',
                        fontSize: '11px',
                        opacity: isFuture ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {makeWordPresentable(status)}
                    </Text>
                  </Flex>
                </React.Fragment>
              )
            })}
          </Flex>

          {/* Separator */}
          {!isCanceled && (
            <Box
              style={{
                width: '1px',
                height: '50px',
                background: 'var(--gray-a4)',
                margin: '0 5px',
                opacity: 0.5,
              }}
            />
          )}

          {/* Canceled Status (on the right) */}
          <Flex
            direction="column"
            align="center"
            style={{
              cursor: companyRole === 'freelancer' ? 'default' : 'pointer',
              opacity: updateStatus.isPending ? 0.5 : 1,
              pointerEvents: companyRole === 'freelancer' ? 'none' : 'auto',
              minWidth: '70px',
            }}
            onClick={handleCanceledClick}
          >
            <Box
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isCanceled
                  ? STATUS_COLORS.canceled.dotBg
                  : 'var(--gray-a3)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="status-dot"
            >
              {isCanceled && (
                <Text
                  size="1"
                  weight="bold"
                  style={{ color: 'white', fontSize: '12px' }}
                >
                  ✕
                </Text>
              )}
            </Box>
            <Text
              size="1"
              mt="2"
              weight={isCanceled ? 'medium' : 'regular'}
              style={{
                color: isCanceled
                  ? STATUS_COLORS.canceled.text
                  : 'var(--gray-a9)',
                textAlign: 'center',
                transition: 'color 0.3s ease',
                fontSize: '11px',
                opacity: !isCanceled ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {makeWordPresentable('canceled')}
            </Text>
          </Flex>
        </Flex>
        )}
      </Flex>

      {/* Current Status Badge */}
      <Flex
        align="center"
        gap="2"
        mt="4"
        pt="3"
        style={{ borderTop: '1px solid var(--gray-a4)' }}
      >
        <Text size="2" weight="regular" color="gray">
          Current status:
        </Text>
        <Badge
          size="2"
          variant="soft"
          color={getJobStatusColor(displayStatus)}
          highContrast
        >
          {makeWordPresentable(displayStatus)}
        </Badge>
      </Flex>

      {/* Subtle hover styles */}
      <style>{`
        .status-dot:hover {
          transform: scale(1.1);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .status-dot:active {
          transform: scale(1.0);
        }
      `}</style>

      {/* Archive prompt when job is canceled */}
      {showArchivePrompt && (
        <Dialog.Root
          open={showArchivePrompt}
          onOpenChange={(open) => {
            if (!open && !archiveJob.isPending) {
              setShowArchivePrompt(false)
            }
          }}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Archive job?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Do you want to archive this job? Archived jobs are hidden from the
              default jobs list but can be viewed by enabling &quot;Show
              archived&quot; in the filter.
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                onClick={() => setShowArchivePrompt(false)}
                disabled={archiveJob.isPending}
              >
                No
              </Button>
              <Button
                onClick={() => archiveJob.mutate()}
                disabled={archiveJob.isPending}
              >
                {archiveJob.isPending ? 'Archiving...' : 'Yes'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}
