import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  SegmentedControl,
  Separator,
  Tabs,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { Archive, Edit, Trash } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthz } from '@shared/auth/useAuthz'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { jobDetailQuery } from '../api/queries'
import { useAutoUpdateJobStatus } from '../hooks/useAutoUpdateJobStatus'
import { getJobStatusColor } from '../utils/statusColors'
import OverviewTab from './tabs/OverviewTab'
import BookingsTab from './tabs/BookingsTab'
import TimelineTab from './tabs/TimelineTab'
import ContactsTab from './tabs/ContactsTab'
import CalendarTab from './tabs/CalendarTab'
import ProgramTab from './tabs/ProgramTab'
import FilesTab from './tabs/FilesTab'
import OffersTab from './tabs/OffersTab'
import InvoiceTab from './tabs/InvoiceTab'
import MoneyTab from './tabs/MoneyTab'
import ToDoTab from './tabs/ToDoTab'
import JobDialog from './dialogs/JobDialog'
import type { JobDetail, JobStatus } from '../types'
import type { FilesTabHandle } from './tabs/FilesTab'

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

const ORDER: Array<JobDetail['status']> = [
  'draft',
  'planned',
  'requested',
  'canceled',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
]

export default function JobInspector({
  id,
  onDeleted,
  initialTab,
}: {
  id: string | null
  onDeleted?: () => void
  initialTab?: string
}) {
  // ✅ hooks first
  const { userId, companyRole } = useAuthz()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [archiveOpen, setArchiveOpen] = React.useState(false)
  const [statusTimelineOpen, setStatusTimelineOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<string>(
    initialTab || 'overview',
  )
  const filesTabRef = React.useRef<FilesTabHandle>(null)

  // Update activeTab when initialTab changes
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  const qc = useQueryClient()
  const { success, error } = useToast()

  const { data, isLoading } = useQuery({
    ...jobDetailQuery({ jobId: id ?? '__none__' }),
    enabled: !!id, // won't run until we have an id, but the hook is still called every render
  })

  // Auto-update job status based on timeframes
  useAutoUpdateJobStatus(data)

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      // Delete related data first (cascade should handle most, but being explicit)
      // Delete invite matters referencing this job
      const { error: mattersErr } = await supabase
        .from('matters')
        .delete()
        .eq('job_id', jobId)
        .eq('matter_type', 'crew_invite')
      if (mattersErr) throw mattersErr

      // Delete time_periods (which will cascade to reserved_items, reserved_crew, reserved_vehicles)
      const { error: periodsErr } = await supabase
        .from('time_periods')
        .delete()
        .eq('job_id', jobId)
      if (periodsErr) throw periodsErr

      // Delete the job
      const { error: jobErr } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
      if (jobErr) throw jobErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail'] })
      setDeleteOpen(false)
      success('Job deleted', 'The job and all related data have been deleted.')
      onDeleted?.()
    },
    onError: (err: any) => {
      error('Failed to delete job', err?.message || 'Please try again.')
    },
  })

  // Archive/unarchive mutation
  const archiveJob = useMutation({
    mutationFn: async ({
      jobId,
      archived,
    }: {
      jobId: string
      archived: boolean
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ archived })
        .eq('id', jobId)
      if (error) throw error
      return archived
    },
    onSuccess: async (archived) => {
      await qc.invalidateQueries({ queryKey: ['company'] })
      await qc.invalidateQueries({ queryKey: ['jobs-index'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail'] })
      setArchiveOpen(false)
      success(
        'Job updated',
        archived ? 'Job has been archived.' : 'Job has been unarchived.',
      )
    },
    onError: (err: any) => {
      error('Failed to update job', err?.message || 'Please try again.')
    },
  })

  // now you can early return safely since hooks above already ran
  if (!id) return <Text color="gray">Select a job to see details.</Text>
  if (isLoading || !data) return <Text>Loading…</Text>

  const job = data

  return (
    <Box>
      <Box
        mb="3"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Flex align="center" gap="3">
          <Heading size="4">{job.title}</Heading>
          {job.jobnr && (
            <Text size="3" color="gray" weight="medium">
              #{String(job.jobnr).padStart(6, '0')}
            </Text>
          )}
        </Flex>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(() => {
            const displayStatus = getDisplayStatus(job.status, companyRole)
            return (
              <Badge
                color={getJobStatusColor(displayStatus)}
                radius="full"
                highContrast
              >
                {makeWordPresentable(displayStatus)}
              </Badge>
            )
          })()}
          {companyRole !== 'freelancer' && (
            <>
              <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
                <Edit width={16} height={16} />
              </Button>
              <Button
                size="2"
                variant="soft"
                color="red"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash width={16} height={16} />
              </Button>
              <Tooltip content={job.archived ? 'Unarchive job' : 'Archive job'}>
                <Button
                  size="2"
                  variant="soft"
                  color={job.archived ? 'blue' : 'gray'}
                  onClick={() => setArchiveOpen(true)}
                  disabled={archiveJob.isPending}
                >
                  <Archive width={16} height={16} />
                </Button>
              </Tooltip>
              <JobDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                companyId={job.company_id}
                mode="edit"
                initialData={job}
              />
              <DeleteJobDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                job={job}
                onConfirm={() => deleteJob.mutate(job.id)}
                isDeleting={deleteJob.isPending}
              />
              <ArchiveJobDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                job={job}
                onConfirm={() =>
                  archiveJob.mutate({ jobId: job.id, archived: !job.archived })
                }
                isArchiving={archiveJob.isPending}
              />
            </>
          )}
        </div>
      </Box>

      <Tabs.Root
        defaultValue="overview"
        value={activeTab}
        onValueChange={(newTab) => {
          // If switching away from files tab, check for unsaved changes
          if (
            activeTab === 'files' &&
            newTab !== 'files' &&
            filesTabRef.current
          ) {
            filesTabRef.current.checkUnsavedChanges(() => {
              setActiveTab(newTab)
            })
          } else {
            setActiveTab(newTab)
          }
        }}
      >
        <Tabs.List wrap="wrap" mb="2">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Time Periods</Tabs.Trigger>
          <Tabs.Trigger value="program">Program</Tabs.Trigger>
          <Tabs.Trigger value="calendar">Calendar</Tabs.Trigger>
          <Tabs.Trigger value="bookings">Bookings</Tabs.Trigger>
          <Tabs.Trigger value="offers">Offers</Tabs.Trigger>
          <Tabs.Trigger value="invoice">Invoice</Tabs.Trigger>
          <Tabs.Trigger value="money">Money</Tabs.Trigger>
          <Tabs.Trigger value="todo">To Do</Tabs.Trigger>
          <Tabs.Trigger value="contacts">Contacts</Tabs.Trigger>
          <Tabs.Trigger value="files">Files</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" mt={'10px'}>
          <OverviewTab job={job} />
        </Tabs.Content>
        <Tabs.Content value="timeline" mt={'10px'}>
          <TimelineTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="program" mt={'10px'}>
          <ProgramTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="calendar" mt={'10px'}>
          <CalendarTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="bookings" mt={'10px'}>
          <BookingsTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="offers" mt={'10px'}>
          <OffersTab jobId={job.id} companyId={job.company_id} />
        </Tabs.Content>
        <Tabs.Content value="invoice" mt={'10px'}>
          <InvoiceTab jobId={job.id} job={job} />
        </Tabs.Content>
        <Tabs.Content value="money" mt={'10px'}>
          <MoneyTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="todo" mt={'10px'}>
          <ToDoTab jobId={job.id} job={job} />
        </Tabs.Content>
        <Tabs.Content value="contacts" mt={'10px'}>
          <ContactsTab jobId={job.id} companyId={job.company_id} />
        </Tabs.Content>
        <Tabs.Content value="files" mt={'10px'}>
          <FilesTab ref={filesTabRef} job={job} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

function DeleteJobDialog({
  open,
  onOpenChange,
  job,
  onConfirm,
  isDeleting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobDetail
  onConfirm: () => void
  isDeleting: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Delete Job: {job.title}?</Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <Text size="2" color="red" weight="bold">
            ⚠️ This action cannot be undone!
          </Text>

          <Text size="2">Deleting this job will permanently remove:</Text>

          <Box
            p="3"
            style={{
              background: 'var(--red-a2)',
              border: '1px solid var(--red-a5)',
              borderRadius: '8px',
            }}
          >
            <Flex direction="column" gap="2">
              <Text size="2">• All time periods</Text>
              <Text size="2">• All booked equipment (internal & external)</Text>
              <Text size="2">• All crew assignments</Text>
              <Text size="2">• All vehicle bookings</Text>
              <Text size="2">• All job contacts and related data</Text>
            </Flex>
          </Box>

          <Text size="2" color="gray">
            Job details:
          </Text>
          <Box
            p="2"
            style={{
              background: 'var(--gray-a2)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <Flex direction="column" gap="1">
              <Text size="1">
                <strong>Title:</strong> {job.title}
              </Text>
              <Text size="1">
                <strong>Status:</strong> {makeWordPresentable(job.status)}
              </Text>
              {job.customer && (
                <Text size="1">
                  <strong>Customer:</strong> {job.customer.name}
                </Text>
              )}
            </Flex>
          </Box>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button
            variant="soft"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Job'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function ArchiveJobDialog({
  open,
  onOpenChange,
  job,
  onConfirm,
  isArchiving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobDetail
  onConfirm: () => void
  isArchiving: boolean
}) {
  const actionText = job.archived ? 'unarchive' : 'archive'
  const actionTitle = job.archived
    ? `Unarchive Job: ${job.title}?`
    : `Archive Job: ${job.title}?`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>{actionTitle}</Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <Text size="2">Are you sure you want to {actionText} this job?</Text>

          <Text size="2" color="gray">
            {job.archived
              ? 'Unarchiving will make this job visible in the jobs list again.'
              : 'Archiving will hide this job from the default jobs list, but it can be viewed by enabling "Show archived" in the filter.'}
          </Text>

          <Text size="2" color="gray">
            Job details:
          </Text>
          <Box
            p="2"
            style={{
              background: 'var(--gray-a2)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <Flex direction="column" gap="1">
              <Text size="1">
                <strong>Title:</strong> {job.title}
              </Text>
              <Text size="1">
                <strong>Status:</strong> {makeWordPresentable(job.status)}
              </Text>
              {job.customer && (
                <Text size="1">
                  <strong>Customer:</strong> {job.customer.name}
                </Text>
              )}
            </Flex>
          </Box>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button
            variant="soft"
            onClick={() => onOpenChange(false)}
            disabled={isArchiving}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isArchiving}>
            {isArchiving
              ? `${actionText.charAt(0).toUpperCase() + actionText.slice(1)}ing...`
              : `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Job`}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function StatusTimeline(job: JobDetail) {
  return (
    <Box mt="4">
      <Heading size="3" mb="2">
        Status timeline
      </Heading>
      <Flex gap="2" wrap="wrap" align="center">
        {ORDER.map((s, i) => {
          const active = s === job.status
          const past = ORDER.indexOf(s) <= ORDER.indexOf(job.status)
          return (
            <Flex key={s} align="center" gap="2">
              <Badge
                color={active || past ? getJobStatusColor(s) : 'gray'}
                variant={active ? 'solid' : 'soft'}
                highContrast
              >
                {makeWordPresentable(s)}
              </Badge>
              {i < ORDER.length - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 1,
                    background: 'var(--gray-6)',
                  }}
                />
              )}
            </Flex>
          )
        })}
      </Flex>
    </Box>
  )
}
