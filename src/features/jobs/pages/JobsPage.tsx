import * as React from 'react'
import { Box, Flex, IconButton, Text, Tooltip } from '@radix-ui/themes'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { LotOfCash, Sparks } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { companyExpansionQuery } from '@features/company/api/queries'
import { jobsReadyToInvoiceQuery } from '@features/home/api/jobsReadyToInvoiceQuery'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  useRegisterShortcutAction,
  useResolvedShortcuts,
} from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { getTabNavShortcutLabels } from '@shared/lib/keyboardShortcuts'
import {
  MobileSplitSkeleton,
  MobileSplitView,
  useMobileInspectorDrawer,
} from '@app/layout/mobile'
import {
  SPLIT_LEFT_WIDTH,
  SplitPage,
  SplitPageSkeleton,
  useSplitLayout,
} from '@app/layout/split'
import JobsList from '../components/JobsList'
import JobsFilter, { DEFAULT_STATUS_FILTER } from '../components/JobsFilter'
import JobInspector from '../components/JobInspector'
import RecurringJobInspector from '../components/RecurringJobInspector'
import { jobsIndexInfiniteQuery } from '../api/queries'
import { myJobIdsQuery } from '../api/myJobIdsQuery'
import type { JobStatus, JobsListScope, JobsPageSelection } from '../types'

function JobInspectorTabShortcutTip() {
  const resolved = useResolvedShortcuts()
  const tabNavShortcutLabels = getTabNavShortcutLabels({
    prev: resolved['nav.tabPrev'],
    next: resolved['nav.tabNext'],
  })

  return (
    <Tooltip
      content={`Switch tabs: ${tabNavShortcutLabels.prev} and ${tabNavShortcutLabels.next}`}
    >
      <Flex align="center" gap="1" style={{ flexShrink: 0, cursor: 'default' }}>
        <Sparks width={14} height={14} />
        <Text size="1" color="gray">
          Pro tip
        </Text>
      </Flex>
    </Tooltip>
  )
}

export default function JobsPage() {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const createJobShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.job',
    () => createJobShortcutRef.current?.(),
    canWrite,
  )
  const location = useLocation()
  const search = location.search as Record<string, unknown>
  const jobId = (search.jobId as string | undefined) || undefined
  const recurringJobId =
    (search.recurringJobId as string | undefined) || undefined
  const tab = (search.tab as string | undefined) || undefined

  useQuery({
    ...(companyId
      ? companyExpansionQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'expansion'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  const [selection, setSelection] = React.useState<JobsPageSelection>(() => {
    if (recurringJobId) return { kind: 'recurring_job', id: recurringJobId }
    if (jobId) return { kind: 'job', id: jobId }
    return null
  })
  const [listScope, setListScope] = React.useState<JobsListScope>(() =>
    recurringJobId
      ? { kind: 'recurring', id: recurringJobId, title: 'Recurring job' }
      : null,
  )
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [statusFilter, setStatusFilter] = React.useState([
    ...DEFAULT_STATUS_FILTER,
  ])
  const [showOnlyArchived, setShowOnlyArchived] = React.useState(false)
  const [showJobsInRecurringSeries, setShowJobsInRecurringSeries] =
    React.useState(false)
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [readyToInvoiceFilter, setReadyToInvoiceFilter] = React.useState(false)
  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(false)
  const isFreelancer = companyRole === 'freelancer'
  const canFilterMyJobs = !isFreelancer
  const myJobsFilterActive = showMyJobsOnly && canFilterMyJobs

  const { data: jobsReadyToInvoice = [] } = useQuery({
    ...jobsReadyToInvoiceQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })
  const readyToInvoiceCount = jobsReadyToInvoice.length
  const showReadyToInvoiceButton =
    readyToInvoiceCount > 0 || readyToInvoiceFilter

  const applyReadyToInvoiceFilter = React.useCallback(() => {
    setReadyToInvoiceFilter(true)
    setStatusFilter(['completed'] as Array<JobStatus>)
    setShowOnlyArchived(false)
    setDateFrom('')
    setDateTo('')
  }, [])

  const clearReadyToInvoiceFilter = React.useCallback(() => {
    setReadyToInvoiceFilter(false)
    setStatusFilter([...DEFAULT_STATUS_FILTER])
  }, [])

  const toggleReadyToInvoiceFilter = React.useCallback(() => {
    if (readyToInvoiceFilter) {
      clearReadyToInvoiceFilter()
    } else {
      applyReadyToInvoiceFilter()
    }
  }, [
    readyToInvoiceFilter,
    clearReadyToInvoiceFilter,
    applyReadyToInvoiceFilter,
  ])

  const handleStatusFilterChange = React.useCallback(
    (next: Array<JobStatus>) => {
      setReadyToInvoiceFilter(false)
      setStatusFilter(next)
    },
    [],
  )

  const handleShowOnlyArchivedChange = React.useCallback((next: boolean) => {
    setReadyToInvoiceFilter(false)
    setShowOnlyArchived(next)
  }, [])

  const handleShowJobsInRecurringSeriesChange = React.useCallback(
    (next: boolean) => {
      setReadyToInvoiceFilter(false)
      setShowJobsInRecurringSeries(next)
    },
    [],
  )

  const handleShowMyJobsOnlyChange = React.useCallback((next: boolean) => {
    setShowMyJobsOnly(next)
  }, [])

  const handlePeriodChange = React.useCallback(
    (range: { startDate: string; endDate: string }) => {
      if (range.startDate || range.endDate) setReadyToInvoiceFilter(false)
      setDateFrom(range.startDate)
      setDateTo(range.endDate)
    },
    [],
  )

  React.useEffect(() => {
    if (recurringJobId) {
      setSelection({ kind: 'recurring_job', id: recurringJobId })
      setListScope((prev) =>
        prev?.id === recurringJobId
          ? prev
          : { kind: 'recurring', id: recurringJobId, title: 'Recurring job' },
      )
    } else if (jobId) {
      setSelection({ kind: 'job', id: jobId })
    }
  }, [jobId, recurringJobId])

  const openedFromUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const urlId = recurringJobId ?? jobId
    if (!urlId || isLarge) return
    if (openedFromUrlRef.current === urlId) return
    openedFromUrlRef.current = urlId
    openDrawer()
  }, [jobId, recurringJobId, isLarge, openDrawer])

  const handleSelectJob = React.useCallback(
    (id: string | null) => {
      setSelection(id ? { kind: 'job', id } : null)
      if (id && !isLarge) openDrawer()
    },
    [isLarge, openDrawer],
  )

  const handleSelectRecurringJob = React.useCallback(
    (id: string | null, title?: string) => {
      setSelection(id ? { kind: 'recurring_job', id } : null)
      if (id) {
        setListScope((prev) => ({
          kind: 'recurring',
          id,
          title:
            title ??
            (prev?.id === id ? prev.title : undefined) ??
            'Recurring job',
        }))
      } else {
        setListScope(null)
      }
      if (id && !isLarge) openDrawer()
    },
    [isLarge, openDrawer],
  )

  const handleSelectJobFromRecurring = React.useCallback(
    (id: string) => {
      setSelection({ kind: 'job', id })
      if (!isLarge) openDrawer()
    },
    [isLarge, openDrawer],
  )

  const handleExitListScope = React.useCallback(() => {
    if (listScope) {
      setSelection({ kind: 'recurring_job', id: listScope.id })
    }
    setListScope(null)
  }, [listScope])

  const handleOpenRecurringSeries = React.useCallback(
    (recurringId: string, title: string) => {
      setListScope({ kind: 'recurring', id: recurringId, title })
      setSelection({ kind: 'recurring_job', id: recurringId })
    },
    [],
  )

  const { data: myJobIds, isLoading: myJobIdsLoading } = useQuery({
    ...myJobIdsQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId && myJobsFilterActive,
  })
  const waitingForMyJobIds = myJobsFilterActive && myJobIdsLoading
  const onlyJobIds = myJobsFilterActive ? (myJobIds ?? []) : null

  const includeRecurringMembers =
    companyRole === 'freelancer' ||
    showJobsInRecurringSeries ||
    readyToInvoiceFilter ||
    myJobsFilterActive

  const { isLoading: jobsIndexLoading } = useInfiniteQuery({
    ...jobsIndexInfiniteQuery({
      companyId: companyId ?? '__none__',
      search: '',
      sortBy: 'start_at',
      sortDir: 'asc',
      userId,
      companyRole,
      showOnlyArchived,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      projectLeadUserId: readyToInvoiceFilter ? userId : null,
      statuses: readyToInvoiceFilter
        ? ['completed']
        : statusFilter.length > 0
          ? statusFilter
          : null,
      includeRecurringMembers,
      onlyJobIds,
    }),
    enabled: !!companyId && !waitingForMyJobIds,
  })
  const showInitialSkeleton = useInitialPageLoad(jobsIndexLoading)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.jobs}
        minWidthPercent={15}
        title="Jobs"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.jobs}
        minWidthPercent={15}
        title="Jobs"
      />
    )
  }

  const leftToolbar = (
    <Flex align="center" gap="0" wrap="wrap">
      {showReadyToInvoiceButton && (
        <Box className="split-header-icon-wrap">
          <IconButton
            className="split-header-icon-button"
            size="3"
            variant={readyToInvoiceFilter ? 'solid' : 'ghost'}
            color="orange"
            onClick={toggleReadyToInvoiceFilter}
            title="Ready to invoice"
            aria-label={`${readyToInvoiceCount} ready to invoice`}
          >
            <LotOfCash width={22} height={22} />
          </IconButton>
          <Box
            aria-hidden
            className={
              readyToInvoiceFilter
                ? 'split-header-icon-badge split-header-icon-badge--orange split-header-icon-badge--on-solid'
                : 'split-header-icon-badge split-header-icon-badge--orange'
            }
          >
            {readyToInvoiceCount}
          </Box>
        </Box>
      )}
      <JobsFilter
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        showOnlyArchived={showOnlyArchived}
        onShowOnlyArchivedChange={handleShowOnlyArchivedChange}
        showJobsInRecurringSeries={showJobsInRecurringSeries}
        onShowJobsInRecurringSeriesChange={
          handleShowJobsInRecurringSeriesChange
        }
        showMyJobsOnly={showMyJobsOnly}
        onShowMyJobsOnlyChange={handleShowMyJobsOnlyChange}
        canFilterMyJobs={canFilterMyJobs}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={handlePeriodChange}
        compact={!isLarge}
      />
    </Flex>
  )

  const inspector =
    selection?.kind === 'recurring_job' ? (
      <RecurringJobInspector
        id={selection.id}
        onSelectJob={handleSelectJobFromRecurring}
        onArchived={() => setSelection(null)}
        onDeleted={() => setSelection(null)}
      />
    ) : (
      <JobInspector
        id={selection?.kind === 'job' ? selection.id : null}
        onDeleted={() => setSelection(null)}
        initialTab={tab}
        onOpenRecurringSeries={handleOpenRecurringSeries}
      />
    )

  const list = (
    <JobsList
      createShortcutRef={createJobShortcutRef}
      selection={selection}
      onSelectJob={handleSelectJob}
      onSelectRecurringJob={handleSelectRecurringJob}
      listScope={listScope}
      onExitListScope={handleExitListScope}
      statusFilter={statusFilter}
      showOnlyArchived={showOnlyArchived}
      showJobsInRecurringSeries={showJobsInRecurringSeries}
      dateFrom={dateFrom}
      dateTo={dateTo}
      readyToInvoiceFilter={readyToInvoiceFilter}
      showMyJobsOnly={myJobsFilterActive}
      onlyJobIds={onlyJobIds}
      waitingForMyJobIds={waitingForMyJobIds}
      compact={!isLarge}
      toolbarExtra={isLarge ? undefined : leftToolbar}
    />
  )

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        inspector={inspector}
      >
        {list}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.jobs}
      minWidthPercent={15}
      title="Jobs"
      leftToolbar={leftToolbar}
      left={list}
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      rightToolbar={selection ? <JobInspectorTabShortcutTip /> : null}
      right={inspector}
    />
  )
}
