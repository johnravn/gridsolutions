import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  Heading,
  Separator,
  Tabs,
  Text,
} from '@radix-ui/themes'
import { Archive, Edit, MoreHoriz, Trash } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { resolveAvatarUrl } from '@shared/lib/avatarUrl'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  useTabKeyboardScopeProps,
  useTabKeyboardShortcuts,
} from '@shared/lib/keyboardShortcuts'
import {
  archiveRecurringJob,
  deleteRecurringJob,
  recurringJobDetailQuery,
} from '../api/recurringJobQueries'
import { InspectorMobileTabSelect } from './InspectorMobileTabSelect'
import RecurringJobDialog from './dialogs/RecurringJobDialog'
import RecurringOverviewTab from './tabs/recurring/RecurringOverviewTab'
import RecurringJobsTab from './tabs/recurring/RecurringJobsTab'
import RecurringInvoicesTab from './tabs/recurring/RecurringInvoicesTab'
import RecurringAccountingTab from './tabs/recurring/RecurringAccountingTab'
import RecurringCrewTab from './tabs/recurring/RecurringCrewTab'
import RecurringBookingsTab from './tabs/recurring/RecurringBookingsTab'
import type { DeleteRecurringJobMode } from '../api/recurringJobQueries'

const RECURRING_JOB_TABS = [
  'overview',
  'jobs',
  'money',
  'invoice',
  'crew',
  'bookings',
] as const

const RECURRING_JOB_TABS_FREELANCER = [
  'overview',
  'jobs',
  'crew',
  'bookings',
] as const

const RECURRING_TAB_SET = new Set<string>(RECURRING_JOB_TABS)

function normalizeRecurringTab(
  tab: string | undefined,
  isFreelancer: boolean,
): string {
  const resolved =
    tab && RECURRING_TAB_SET.has(tab)
      ? tab
      : tab === 'accounting'
        ? 'money'
        : 'overview'
  if (isFreelancer && (resolved === 'invoice' || resolved === 'money')) {
    return 'overview'
  }
  return resolved
}

export default function RecurringJobInspector({
  id,
  onSelectJob,
  onArchived,
  onDeleted,
  initialTab,
  onTabChange,
}: {
  id: string | null
  onSelectJob: (jobId: string, tab?: string) => void
  onArchived?: () => void
  onDeleted?: () => void
  initialTab?: string
  onTabChange?: (tab: string) => void
}) {
  const { companyRole } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const isFreelancer = companyRole === 'freelancer'
  const isMobile = useMediaQuery('(max-width: 768px)')
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [editOpen, setEditOpen] = React.useState(false)
  const [archiveOpen, setArchiveOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(() =>
    normalizeRecurringTab(initialTab, isFreelancer),
  )

  const setTab = React.useCallback(
    (tab: string) => {
      const resolved = normalizeRecurringTab(tab, isFreelancer)
      setActiveTab(resolved)
      onTabChange?.(resolved)
    },
    [isFreelancer, onTabChange],
  )

  const tabOptions = React.useMemo(() => {
    const list = [
      { value: 'overview', label: 'Overview' },
      { value: 'jobs', label: 'Jobs' },
      { value: 'money', label: 'Accounting' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'crew', label: 'Crew' },
      { value: 'bookings', label: 'Bookings' },
    ]
    return isFreelancer
      ? list.filter((t) => t.value !== 'invoice' && t.value !== 'money')
      : list
  }, [isFreelancer])

  const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
  useTabKeyboardShortcuts({
    scopeRef,
    tabs: isFreelancer ? RECURRING_JOB_TABS_FREELANCER : RECURRING_JOB_TABS,
    activeTab,
    onTabChange: setTab,
    enabled: !!id,
  })

  React.useEffect(() => {
    if (initialTab == null) return
    const resolved = normalizeRecurringTab(initialTab, isFreelancer)
    setActiveTab((prev) => (prev === resolved ? prev : resolved))
  }, [initialTab, isFreelancer])

  React.useEffect(() => {
    if (isFreelancer && (activeTab === 'invoice' || activeTab === 'money')) {
      setTab('overview')
    }
  }, [isFreelancer, activeTab, setTab])

  const { data, isLoading, isError, isFetched } = useQuery({
    ...recurringJobDetailQuery({ recurringJobId: id ?? '__none__' }),
    enabled: !!id,
  })

  const archive = useMutation({
    mutationFn: () => archiveRecurringJob(id!),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['company', data?.company_id, 'recurring-jobs-index'],
      })
      setArchiveOpen(false)
      success('Recurring job archived')
      onArchived?.()
    },
    onError: (err: Error) => showError('Failed to archive', err.message),
  })

  const remove = useMutation({
    mutationFn: (mode: DeleteRecurringJobMode) =>
      deleteRecurringJob({ id: id!, mode }),
    onSuccess: (_data, mode) => {
      qc.invalidateQueries({ queryKey: ['company'] })
      setDeleteOpen(false)
      success(
        mode === 'delete_all_jobs'
          ? 'Recurring job and member jobs deleted'
          : 'Recurring job deleted — member jobs kept',
      )
      onDeleted?.()
    },
    onError: (err: Error) => showError('Failed to delete', err.message),
  })

  if (!id) {
    return <Text color="gray">Select a recurring job to see details.</Text>
  }
  if (isLoading) return <InspectorSkeleton />
  if (isError || (isFetched && !data)) {
    return (
      <Flex direction="column" gap="2" p="3">
        <Text color="gray">Recurring job not found.</Text>
        {onDeleted ? (
          <Button variant="soft" onClick={() => onDeleted()}>
            Clear selection
          </Button>
        ) : null}
      </Flex>
    )
  }
  if (!data) return <InspectorSkeleton />

  const customerName =
    data.customer?.name ??
    data.customer_user?.display_name ??
    data.customer_user?.email ??
    null
  const contactName = data.customer_contact?.name ?? null
  const leadName =
    data.project_lead?.display_name || data.project_lead?.email || null
  const avatarUrl = resolveAvatarUrl(data.project_lead?.avatar_url)
  const initials = getInitials(
    data.project_lead?.display_name ?? data.project_lead?.email ?? '',
  )

  return (
    <Box
      {...scopeProps}
      style={{ maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}
    >
      <Box
        mb="3"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Flex
          direction="column"
          gap="2"
          style={{ minWidth: 0, flex: '1 1 auto' }}
        >
          <Text size="1" color="gray" weight="medium">
            Series
          </Text>
          <Heading
            size="4"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {data.title}
          </Heading>
          <Flex gap="2" align="center" wrap="wrap">
            <Badge variant="soft" size="2" color="violet">
              Recurring job
            </Badge>
            <Badge variant="outline" size="2">
              {data.job_count} job{data.job_count !== 1 ? 's' : ''}
            </Badge>
          </Flex>
        </Flex>
        {canWrite &&
          (isMobile ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button
                  size="2"
                  variant="soft"
                  aria-label="Recurring job actions"
                  style={{ minHeight: 36, minWidth: 36 }}
                >
                  <MoreHoriz width={18} height={18} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onSelect={() => setEditOpen(true)}>
                  <Edit width={16} height={16} />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setArchiveOpen(true)}>
                  <Archive width={16} height={16} />
                  Archive
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  color="red"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash width={16} height={16} />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          ) : (
            <Flex gap="2">
              <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
                <Edit width={16} height={16} />
              </Button>
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive width={16} height={16} />
              </Button>
              <Button
                size="2"
                variant="soft"
                color="red"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash width={16} height={16} />
              </Button>
            </Flex>
          ))}
      </Box>

      {(customerName || contactName || leadName) && (
        <Flex gap="4" wrap="wrap" mb="3">
          {customerName && (
            <Text size="2" color="gray">
              Customer: {customerName}
            </Text>
          )}
          {contactName && (
            <Text size="2" color="gray">
              Contact: {contactName}
            </Text>
          )}
          {leadName && (
            <Flex gap="2" align="center">
              <Text size="2" color="gray">
                Lead:
              </Text>
              <Avatar
                size="1"
                src={avatarUrl ?? undefined}
                fallback={initials}
                radius="full"
              />
              <Text size="2">{leadName}</Text>
            </Flex>
          )}
        </Flex>
      )}

      <Separator size="4" mb="3" />

      <Tabs.Root value={activeTab} onValueChange={setTab}>
        {isMobile ? (
          <Box className="job-inspector-sticky-chrome" mb="3">
            <InspectorMobileTabSelect
              value={activeTab}
              options={tabOptions}
              onChange={setTab}
            />
          </Box>
        ) : (
          <AnimatedTabsList mb="3" wrap="wrap">
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="jobs">Jobs</Tabs.Trigger>
            {!isFreelancer && (
              <Tabs.Trigger value="money">Accounting</Tabs.Trigger>
            )}
            {!isFreelancer && (
              <Tabs.Trigger value="invoice">Invoice</Tabs.Trigger>
            )}
            <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
            <Tabs.Trigger value="bookings">Bookings</Tabs.Trigger>
          </AnimatedTabsList>
        )}

        <Tabs.Content value="overview">
          <RecurringOverviewTab detail={data} onSelectJob={onSelectJob} />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          {!isFreelancer ? (
            <RecurringJobsTab detail={data} onSelectJob={onSelectJob} />
          ) : (
            <RecurringOverviewTab detail={data} onSelectJob={onSelectJob} />
          )}
        </Tabs.Content>
        {!isFreelancer && (
          <Tabs.Content value="money">
            <RecurringAccountingTab
              detail={data}
              onSelectJob={onSelectJob}
              onOpenSeriesInvoice={() => setTab('invoice')}
            />
          </Tabs.Content>
        )}
        {!isFreelancer && (
          <Tabs.Content value="invoice">
            <RecurringInvoicesTab detail={data} onSelectJob={onSelectJob} />
          </Tabs.Content>
        )}
        <Tabs.Content value="crew">
          <RecurringCrewTab
            recurringJobId={data.id}
            onSelectJob={onSelectJob}
          />
        </Tabs.Content>
        <Tabs.Content value="bookings">
          <RecurringBookingsTab
            recurringJobId={data.id}
            onSelectJob={onSelectJob}
          />
        </Tabs.Content>
      </Tabs.Root>

      <RecurringJobDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        companyId={data.company_id}
        mode="edit"
        initialData={data}
      />

      <Dialog.Root open={archiveOpen} onOpenChange={setArchiveOpen}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Archive recurring job?</Dialog.Title>
          <Text size="2" color="gray" mb="3">
            This hides the recurring job from the pinned list. Member jobs are
            not archived and stay in the jobs list.
          </Text>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              color="gray"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              Archive
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Delete recurring job?</Dialog.Title>
          <Text size="2" color="gray" mb="3">
            {data.job_count > 0
              ? `This recurring job has ${data.job_count} member job${data.job_count !== 1 ? 's' : ''}. You can detach them (they stay as normal jobs) or delete everything.`
              : 'This will permanently delete the recurring job.'}
          </Text>
          {data.job_count > 0 && (
            <Box
              p="3"
              mb="3"
              style={{
                background: 'var(--red-a2)',
                border: '1px solid var(--red-a5)',
                borderRadius: 'var(--radius-2)',
              }}
            >
              <Text size="2" weight="medium" mb="1">
                Delete all member jobs
              </Text>
              <Text size="2" color="gray">
                Permanently removes every job in this recurring job, including
                bookings, crew, and related data. This cannot be undone.
              </Text>
            </Box>
          )}
          <Flex gap="3" justify="end" wrap="wrap">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            {data.job_count > 0 ? (
              <>
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => remove.mutate('detach')}
                  disabled={remove.isPending}
                >
                  Detach jobs
                </Button>
                <Button
                  color="red"
                  onClick={() => remove.mutate('delete_all_jobs')}
                  disabled={remove.isPending}
                >
                  Delete all
                </Button>
              </>
            ) : (
              <Button
                color="red"
                onClick={() => remove.mutate('detach')}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
