import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Separator,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import {
  Copy,
  Edit,
  LinkSlash,
  MoreVert,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Search,
  Trash,
} from 'iconoir-react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { motionOffsetRevealX, motionRevealTransition } from '@shared/lib/motion'
import JobDialog from '../../dialogs/JobDialog'
import CopyJobDialog from '../../dialogs/CopyJobDialog'
import RecurringJobTemplateDialog from '../../dialogs/RecurringJobTemplateDialog'
import {
  assignJobToRecurringJob,
  copyJobIntoRecurringJob,
  deleteRecurringJobTemplate,
  deleteRecurringMemberJob,
  recurringJobInvoiceSummaryQuery,
  recurringJobTemplatesQuery,
  removeJobFromRecurringJob,
  unassignedJobsQuery,
} from '../../../api/recurringJobQueries'
import {
  buildJobDefaultsFromRecurringJob,
  buildJobDefaultsFromTemplate,
  formatTemplateStartTimeLabel,
} from '../../../utils/recurringJobCreateDefaults'
import { ALL_STATUSES, DEFAULT_STATUS_FILTER } from '../../JobsFilter'
import { getJobStatusColor } from '../../../utils/statusColors'
import type { RecurringJobCreateDefaults } from '../../../utils/recurringJobCreateDefaults'
import type {
  JobListRow,
  JobStatus,
  RecurringJobDetail,
  RecurringJobTemplate,
  UUID,
} from '../../../types'

function jobCustomerName(job: JobListRow): string {
  return (
    job.customer?.name ??
    job.customer_user?.display_name ??
    job.customer_user?.email ??
    '—'
  )
}

function jobLeadName(job: JobListRow): string {
  return job.project_lead?.display_name || job.project_lead?.email || '—'
}

function getAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
  return data.publicUrl
}

type Props = {
  detail: RecurringJobDetail
  onSelectJob: (jobId: string) => void
}

export default function RecurringJobsTab({ detail, onSelectJob }: Props) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createDefaults, setCreateDefaults] = React.useState<
    RecurringJobCreateDefaults | undefined
  >(undefined)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignSearch, setAssignSearch] = React.useState('')
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] =
    React.useState<RecurringJobTemplate | null>(null)
  const [detachJob, setDetachJob] = React.useState<JobListRow | null>(null)
  const [deleteJob, setDeleteJob] = React.useState<JobListRow | null>(null)
  const [copyJob, setCopyJob] = React.useState<JobListRow | null>(null)
  const [templatesOpen, setTemplatesOpen] = React.useState(true)
  const [hoveredTemplateId, setHoveredTemplateId] = React.useState<UUID | null>(
    null,
  )
  const isSmallScreen = useMediaQuery('(max-width: 768px)')
  const [debouncedAssignSearch] = useDebouncedValue(assignSearch, {
    wait: 300,
  })

  const { data: templates = [] } = useQuery({
    ...recurringJobTemplatesQuery({ recurringJobId: detail.id }),
  })

  const { data: invoiceSummary = [] } = useQuery({
    ...recurringJobInvoiceSummaryQuery({ recurringJobId: detail.id }),
  })

  const invoiceMap = new Map(invoiceSummary.map((i) => [i.job_id, i]))

  const baseDefaults = React.useMemo(
    () => buildJobDefaultsFromRecurringJob(detail),
    [detail],
  )

  const invalidateJobs = () => {
    qc.invalidateQueries({
      queryKey: ['recurring-jobs-detail', detail.id],
    })
    qc.invalidateQueries({
      queryKey: ['company', companyId, 'jobs-index'],
    })
  }

  const openBlankCreate = () => {
    setCreateDefaults(baseDefaults)
    setCreateOpen(true)
  }

  const openTemplateCreate = (template: RecurringJobTemplate) => {
    setCreateDefaults(buildJobDefaultsFromTemplate(detail, template))
    setCreateOpen(true)
  }

  const deleteTemplate = useMutation({
    mutationFn: (id: UUID) => deleteRecurringJobTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['recurring-jobs-templates', detail.id],
      })
      success('Template deleted')
    },
    onError: (err: Error) =>
      showError('Failed to delete template', err.message),
  })

  const detach = useMutation({
    mutationFn: (jobId: UUID) => removeJobFromRecurringJob(jobId),
    onSuccess: () => {
      setDetachJob(null)
      invalidateJobs()
      success('Job detached — it remains in the jobs list')
    },
    onError: (err: Error) => showError('Failed to detach', err.message),
  })

  const deleteMember = useMutation({
    mutationFn: (jobId: UUID) => deleteRecurringMemberJob(jobId),
    onSuccess: () => {
      setDeleteJob(null)
      invalidateJobs()
      success('Job permanently deleted')
    },
    onError: (err: Error) => showError('Failed to delete job', err.message),
  })

  const copyMember = useMutation({
    mutationFn: (payload: { jobId: UUID; startAt: string; endAt: string }) =>
      copyJobIntoRecurringJob({
        ...payload,
        recurringJobId: detail.id,
      }),
    onSuccess: (newJobId) => {
      setCopyJob(null)
      invalidateJobs()
      success('Job copied into this recurring job')
      onSelectJob(newJobId)
    },
    onError: (err: Error) => showError('Failed to copy job', err.message),
  })

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Flex
          justify="between"
          align="center"
          gap="2"
          mb={templatesOpen ? '2' : '0'}
          wrap="wrap"
        >
          <Flex
            align="center"
            gap="1"
            style={{ cursor: 'pointer', minWidth: 0, flex: '1 1 auto' }}
            onClick={() => setTemplatesOpen((open) => !open)}
          >
            {templatesOpen ? (
              <NavArrowDown width={16} height={16} />
            ) : (
              <NavArrowRight width={16} height={16} />
            )}
            <Text size="2" weight="medium">
              Job templates
            </Text>
            {templates.length > 0 && (
              <Badge variant="soft" color="gray" size="1">
                {templates.length}
              </Badge>
            )}
          </Flex>
          <Button
            size="1"
            variant="soft"
            onClick={() => {
              setEditingTemplate(null)
              setTemplateDialogOpen(true)
            }}
          >
            <Plus width={14} height={14} />
            New template
          </Button>
        </Flex>
        {templatesOpen &&
          (templates.length === 0 ? (
            <Text size="2" color="gray">
              No templates yet. Create one to speed up adding similar jobs.
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {templates.map((template) => {
                const showTemplateActions =
                  isSmallScreen || hoveredTemplateId === template.id

                return (
                  <Flex
                    key={template.id}
                    align="center"
                    justify="between"
                    gap="3"
                    p="2"
                    wrap="wrap"
                    onMouseEnter={() => setHoveredTemplateId(template.id)}
                    onMouseLeave={() => setHoveredTemplateId(null)}
                    style={{
                      borderRadius: 'var(--radius-2)',
                      background: 'var(--gray-a2)',
                    }}
                  >
                    <Flex
                      direction="column"
                      gap="1"
                      style={{ minWidth: 0, flex: 1 }}
                    >
                      <Text size="2" weight="medium">
                        {template.name}
                      </Text>
                      <Text size="1" color="gray">
                        Job title: {template.title}
                      </Text>
                      <Flex gap="2" wrap="wrap">
                        <Text size="1" color="gray">
                          {makeWordPresentable(template.status)}
                        </Text>
                        {formatTemplateStartTimeLabel(template.start_time) && (
                          <Text size="1" color="gray">
                            Starts{' '}
                            {formatTemplateStartTimeLabel(template.start_time)}
                          </Text>
                        )}
                        <Text size="1" color="gray">
                          {template.duration_hours}h
                        </Text>
                        {template.crew_roles.length > 0 && (
                          <Text size="1" color="gray">
                            {template.crew_roles.length} crew role
                            {template.crew_roles.length !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </Flex>
                    </Flex>
                    <Flex gap="1" align="center" wrap="wrap">
                      <Flex
                        gap="1"
                        align="center"
                        style={{
                          maxWidth: showTemplateActions ? 80 : 0,
                          overflow: 'hidden',
                          opacity: showTemplateActions ? 1 : 0,
                          transform: showTemplateActions
                            ? 'translateX(0)'
                            : `translateX(${motionOffsetRevealX})`,
                          pointerEvents: showTemplateActions ? 'auto' : 'none',
                          transition: motionRevealTransition([
                            'opacity',
                            'transform',
                            'max-width',
                          ]),
                        }}
                      >
                        <IconButton
                          size="2"
                          variant="ghost"
                          color="gray"
                          aria-label="Edit template"
                          onClick={() => {
                            setEditingTemplate(template)
                            setTemplateDialogOpen(true)
                          }}
                        >
                          <Edit width={18} height={18} />
                        </IconButton>
                        <IconButton
                          size="2"
                          variant="ghost"
                          color="red"
                          aria-label="Delete template"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash width={18} height={18} />
                        </IconButton>
                      </Flex>
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => openTemplateCreate(template)}
                      >
                        Use template
                      </Button>
                    </Flex>
                  </Flex>
                )
              })}
            </Flex>
          ))}
      </Box>

      <Separator size="4" />

      <Flex gap="2" wrap="wrap" align="center">
        <Button size="2" onClick={openBlankCreate}>
          <Plus width={16} height={16} />
          Add job
        </Button>
        <Button size="2" variant="soft" onClick={() => setAssignOpen(true)}>
          Assign existing job
        </Button>
      </Flex>

      {detail.jobs.length === 0 ? (
        <Text size="2" color="gray">
          No jobs in this recurring job yet.
        </Text>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table.Root size="2" variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Invoices</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {detail.jobs.map((job) => {
                const inv = invoiceMap.get(job.id)
                return (
                  <Table.Row
                    key={job.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectJob(job.id)}
                  >
                    <Table.Cell>
                      <Text weight="medium">{job.title}</Text>
                      {job.jobnr != null && (
                        <Text size="1" color="gray">
                          {' '}
                          #{job.jobnr}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {job.start_at
                        ? format(new Date(job.start_at), 'd. MMM yyyy', {
                            locale: nb,
                          })
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={getJobStatusColor(job.status)}
                        variant="soft"
                        size="1"
                      >
                        {makeWordPresentable(job.status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {inv && inv.invoice_count > 0
                        ? `${inv.invoice_count} invoice${inv.invoice_count !== 1 ? 's' : ''}`
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <Button
                            size="1"
                            variant="ghost"
                            color="gray"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVert width={16} height={16} />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu.Item onSelect={() => setDetachJob(job)}>
                            <Flex gap="2" align="center">
                              <LinkSlash width={14} height={14} />
                              Detach from recurring job
                            </Flex>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => setCopyJob(job)}>
                            <Flex gap="2" align="center">
                              <Copy width={14} height={14} />
                              Copy job
                            </Flex>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            color="red"
                            onSelect={() => setDeleteJob(job)}
                          >
                            <Flex gap="2" align="center">
                              <Trash width={14} height={14} />
                              Delete job permanently
                            </Flex>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      <JobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId!}
        mode="create"
        recurringJobId={detail.id}
        recurringJobDefaults={createDefaults ?? baseDefaults}
        onSaved={() => {
          invalidateJobs()
        }}
      />

      <RecurringJobTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        companyId={companyId!}
        recurringJobId={detail.id}
        mode={editingTemplate ? 'edit' : 'create'}
        initialData={editingTemplate ?? undefined}
      />

      <AssignJobDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        recurringJobId={detail.id}
        companyId={companyId!}
        search={debouncedAssignSearch}
        assignSearch={assignSearch}
        onAssignSearchChange={setAssignSearch}
      />

      <Dialog.Root
        open={!!detachJob}
        onOpenChange={(open) => !open && setDetachJob(null)}
      >
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Detach job from recurring job?</Dialog.Title>
          <Text size="2" color="gray" mb="3">
            <strong>{detachJob?.title}</strong> will be removed from this
            recurring job but stays as a normal job in your jobs list. Nothing
            is deleted.
          </Text>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={() => detachJob && detach.mutate(detachJob.id)}
              disabled={detach.isPending}
            >
              Detach job
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={!!deleteJob}
        onOpenChange={(open) => !open && setDeleteJob(null)}
      >
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Delete job permanently?</Dialog.Title>
          <Text size="2" color="red" weight="medium" mb="2">
            This cannot be undone.
          </Text>
          <Text size="2" color="gray" mb="3">
            <strong>{deleteJob?.title}</strong> and all its bookings, crew,
            equipment, and related data will be permanently removed. This is not
            the same as detaching — the job will be gone entirely.
          </Text>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={() => deleteJob && deleteMember.mutate(deleteJob.id)}
              disabled={deleteMember.isPending}
            >
              Delete job
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <CopyJobDialog
        open={!!copyJob}
        onOpenChange={(open) => !open && setCopyJob(null)}
        initialStartAt={copyJob?.start_at ?? null}
        initialEndAt={copyJob?.end_at ?? null}
        isCopying={copyMember.isPending}
        onConfirm={({ startAt, endAt }) => {
          if (!copyJob) return
          copyMember.mutate({
            jobId: copyJob.id,
            startAt,
            endAt,
          })
        }}
      />
    </Flex>
  )
}

function AssignJobDialog({
  open,
  onOpenChange,
  recurringJobId,
  companyId,
  search,
  assignSearch,
  onAssignSearchChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  recurringJobId: UUID
  companyId: UUID
  search: string
  assignSearch: string
  onAssignSearchChange: (v: string) => void
}) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [statusFilter, setStatusFilter] = React.useState<Array<JobStatus>>([
    ...DEFAULT_STATUS_FILTER,
  ])

  React.useEffect(() => {
    if (open) {
      setStatusFilter([...DEFAULT_STATUS_FILTER])
    }
  }, [open])

  const { data: jobs = [], isFetching } = useQuery({
    ...unassignedJobsQuery({ companyId, search }),
    enabled: open,
  })

  const filteredJobs = React.useMemo(
    () => jobs.filter((job) => statusFilter.includes(job.status)),
    [jobs, statusFilter],
  )

  const toggleStatus = (status: JobStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    )
  }

  const assign = useMutation({
    mutationFn: (jobId: UUID) =>
      assignJobToRecurringJob({ jobId, recurringJobId }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['recurring-jobs-detail', recurringJobId],
      })
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'jobs-index'],
      })
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'unassigned-jobs'],
      })
      success('Job assigned')
      onOpenChange(false)
    },
    onError: (err: Error) => showError('Failed to assign', err.message),
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="720px">
        <Dialog.Title>Assign existing job</Dialog.Title>
        <Text size="2" color="gray" mb="3">
          Search for jobs not already in a recurring job.
        </Text>
        <TextField.Root
          placeholder="Search jobs"
          value={assignSearch}
          onChange={(e) => onAssignSearchChange(e.target.value)}
          mb="3"
        >
          <TextField.Slot side="left">
            <Search width={16} height={16} />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="2" />}
          </TextField.Slot>
        </TextField.Root>
        <Box
          mb="3"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'repeat(3, minmax(0, 1fr))'
              : 'repeat(9, minmax(0, 1fr))',
            gap: 'var(--space-1)',
            width: '100%',
          }}
        >
          {ALL_STATUSES.map((status) => {
            const selected = statusFilter.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: selected ? 1 : 0.4,
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <Badge
                  color={getJobStatusColor(status)}
                  variant={selected ? 'soft' : 'outline'}
                  size="1"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    paddingInline: 'var(--space-1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {makeWordPresentable(status)}
                </Badge>
              </button>
            )
          })}
        </Box>
        <Flex
          direction="column"
          gap="2"
          style={{ maxHeight: 360, overflowY: 'auto' }}
        >
          {filteredJobs.length === 0 ? (
            <Text size="2" color="gray">
              {jobs.length === 0
                ? 'No unassigned jobs found'
                : 'No jobs match the selected statuses'}
            </Text>
          ) : (
            filteredJobs.map((job) => {
              const leadName = jobLeadName(job)
              const initials = getInitials(
                job.project_lead?.display_name ?? job.project_lead?.email ?? '',
              )
              const avatarUrl = getAvatarUrl(
                job.project_lead?.avatar_url ?? null,
              )
              return (
                <Flex
                  key={job.id}
                  justify="between"
                  align="center"
                  gap="3"
                  p="3"
                  wrap="wrap"
                  style={{
                    borderRadius: 'var(--radius-3)',
                    background: 'var(--gray-a2)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onClick={() => assign.mutate(job.id)}
                >
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Flex gap="2" align="center" wrap="wrap" mb="1">
                      <Text size="2" weight="medium">
                        {job.title}
                      </Text>
                      {job.jobnr != null && (
                        <Text size="1" color="gray">
                          #{job.jobnr}
                        </Text>
                      )}
                      <Badge
                        color={getJobStatusColor(job.status)}
                        variant="soft"
                        size="1"
                      >
                        {makeWordPresentable(job.status)}
                      </Badge>
                    </Flex>
                    <Flex gap="2" wrap="wrap" align="center">
                      <Text size="1" color="gray">
                        {jobCustomerName(job)}
                      </Text>
                      <Text size="1" color="gray">
                        ·
                      </Text>
                      <Text size="1" color="gray">
                        {job.start_at
                          ? format(new Date(job.start_at), 'd. MMM yyyy', {
                              locale: nb,
                            })
                          : 'No date'}
                      </Text>
                    </Flex>
                    <Flex gap="2" align="center" mt="1">
                      <Avatar
                        size="1"
                        src={avatarUrl ?? undefined}
                        fallback={initials}
                        radius="full"
                      />
                      <Text size="1" color="gray">
                        {leadName}
                      </Text>
                    </Flex>
                  </Box>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={(e) => {
                      e.stopPropagation()
                      assign.mutate(job.id)
                    }}
                  >
                    Assign
                  </Button>
                </Flex>
              )
            })
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
