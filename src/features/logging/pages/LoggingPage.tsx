import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Select,
  Separator,
  Text,
  TextArea,
} from '@radix-ui/themes'
import { Plus } from 'iconoir-react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { myProfileQuery } from '@shared/api/myProfileQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  MOBILE_LIST_BOTTOM_PAD,
  MobileBottomActionBar,
  MobilePageList,
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
import { jobsIndexQuery } from '@features/jobs/api/queries'
import { previouslyLoggedJobsQuery } from '../api/loggedJobs'
import { loggingPeriodsQuery } from '../api/loggingPeriods'
import {
  createTimeEntry,
  deleteTimeEntry,
  timeEntriesQuery,
} from '../api/timeEntries'
import EditTimeEntryDialog from '../components/EditTimeEntryDialog'
import LoggingJobPickerField from '../components/LoggingJobPickerField'
import LoggingMonthScroller from '../components/LoggingMonthScroller'
import TimeEntriesTable from '../components/TimeEntriesTable'
import TimeEntryWhenFields from '../components/TimeEntryWhenFields'
import {
  buildLoggingJobPickerSections,
  formatJobOption,
  loggingSearchTerm,
} from '../lib/jobPicker'
import {
  formatHoursBetween,
  formatHoursInput,
  hoursToRange,
  isValidLoggedHours,
  parseHoursInput,
} from '../lib/timeEntryHours'
import {
  buildLockedMonthSet,
  formatLoggingDate,
  formatMonthInput,
  getDefaultTimes,
  getMonthOptions,
  getRange,
  getYearFromIso,
  isRangeOverlappingLockedPeriod,
  shiftRangeToMonth,
} from '../lib/timeEntryRange'
import type { TimeInputMode } from '../lib/timeEntryHours'
import type { TimeEntryInsert, TimeEntryWithProfile } from '../api/timeEntries'

export default function LoggingPage() {
  const { companyId } = useCompany()
  const { userId, isGlobalSuperuser, companyRole } = useAuthz()
  const { isLarge } = useSplitLayout()
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    formatMonthInput(new Date()),
  )
  const selectedYear =
    Number(selectedMonth.split('-')[0]) || new Date().getFullYear()
  const monthOptions = React.useMemo(
    () => getMonthOptions(selectedYear),
    [selectedYear],
  )
  const yearOptions = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  }, [])

  const { from, to, label } = React.useMemo(
    () => getRange('month', selectedMonth),
    [selectedMonth],
  )

  const { startAt: defaultStartAt, endAt: defaultEndAt } = React.useMemo(
    () => getDefaultTimes(),
    [],
  )
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null)
  const [showAllJobs, setShowAllJobs] = React.useState(false)
  const [jobSearch, setJobSearch] = React.useState('')
  const [debouncedJobSearch] = useDebouncedValue(jobSearch, { wait: 300 })
  const jobSearchPending = jobSearch !== debouncedJobSearch
  const [jobSearchOpen, setJobSearchOpen] = React.useState(false)
  const jobSearchInputRef = React.useRef<HTMLDivElement>(null)
  const [title, setTitle] = React.useState('')
  const [jobNumber, setJobNumber] = React.useState('')
  const [note, setNote] = React.useState('')
  const [startAt, setStartAt] = React.useState(defaultStartAt)
  const [endAt, setEndAt] = React.useState(defaultEndAt)
  const [timeMode, setTimeMode] = React.useState<TimeInputMode>('range')
  const [hoursInput, setHoursInput] = React.useState('1')
  const hasInvalidTimeRange = React.useMemo(() => {
    if (timeMode === 'hours') return false
    if (!startAt || !endAt) return false
    return new Date(endAt).getTime() <= new Date(startAt).getTime()
  }, [endAt, startAt, timeMode])
  const parsedHours = React.useMemo(
    () => parseHoursInput(hoursInput),
    [hoursInput],
  )
  const hasInvalidHours =
    timeMode === 'hours' && !isValidLoggedHours(parsedHours)
  const pickedHours = React.useMemo(() => {
    if (hasInvalidHours) return '--'
    return formatHoursBetween(startAt, endAt)
  }, [hasInvalidHours, startAt, endAt])
  const resolvedTitle = (selectedJobId ? title : jobSearch).trim()

  const enabled = Boolean(companyId && userId)

  React.useEffect(() => {
    if (selectedJobId) return
    const input = jobSearchInputRef.current?.querySelector('input')
    if (input instanceof HTMLInputElement) {
      input.focus()
    }
  }, [selectedJobId])

  const { data: myProfile } = useQuery({
    ...myProfileQuery(userId ?? '__none__'),
    enabled: !!userId,
  })
  const userDisplayName = React.useMemo(() => {
    if (!myProfile) return null
    return (
      myProfile.display_name ||
      [myProfile.first_name, myProfile.last_name].filter(Boolean).join(' ') ||
      myProfile.email
    )
  }, [myProfile])

  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
      from,
      to,
    }),
    enabled,
  })

  const LOGGING_JOBS_MAX_ROWS = 150
  const activeJobSearch = loggingSearchTerm(debouncedJobSearch)
  // Typing a search always scans all company jobs — the My/All toggle only
  // scopes the browse list, which is what made attach-to-job hard to find.
  const searchAllJobs = showAllJobs || Boolean(activeJobSearch)
  const { data: jobsData = [], isLoading: jobsLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: activeJobSearch,
      sortBy: 'start_at',
      sortDir: 'desc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
      includeArchived: false,
      onlyCrewForUserId: searchAllJobs ? null : (userId ?? null),
      maxRows: LOGGING_JOBS_MAX_ROWS,
    }),
    enabled,
    placeholderData: keepPreviousData,
  })
  const jobsSearchLoading = jobsLoading || jobSearchPending
  const jobsTruncated = jobsData.length >= LOGGING_JOBS_MAX_ROWS

  const { data: previouslyLoggedJobs = [] } = useQuery({
    ...previouslyLoggedJobsQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled,
  })

  const previouslyLoggedJobIds = React.useMemo(
    () => new Set(previouslyLoggedJobs.map((job) => job.id)),
    [previouslyLoggedJobs],
  )

  const jobPickerSections = React.useMemo(
    () =>
      buildLoggingJobPickerSections({
        jobs: jobsData,
        previouslyLoggedJobs,
        search: jobSearch,
        now: new Date(),
      }),
    [jobSearch, jobsData, previouslyLoggedJobs],
  )

  const selectedJobLabel = React.useMemo(() => {
    if (!selectedJobId) return ''
    const job =
      jobsData.find((j) => j.id === selectedJobId) ??
      previouslyLoggedJobs.find((j) => j.id === selectedJobId)
    return job
      ? formatJobOption(job, formatLoggingDate)
      : title || selectedJobId
  }, [jobsData, previouslyLoggedJobs, selectedJobId, title])

  const entryStartYear = React.useMemo(
    () => getYearFromIso(startAt) ?? new Date().getFullYear(),
    [startAt],
  )
  const entryEndYear = React.useMemo(
    () => getYearFromIso(endAt) ?? entryStartYear,
    [endAt, entryStartYear],
  )

  const { data: loggingPeriodsView = [] } = useQuery({
    ...loggingPeriodsQuery({
      companyId: companyId ?? '',
      year: selectedYear,
    }),
    enabled: !!companyId,
  })
  const { data: loggingPeriodsStart = [] } = useQuery({
    ...loggingPeriodsQuery({
      companyId: companyId ?? '',
      year: entryStartYear,
    }),
    enabled: !!companyId && entryStartYear !== selectedYear,
  })
  const { data: loggingPeriodsEnd = [] } = useQuery({
    ...loggingPeriodsQuery({
      companyId: companyId ?? '',
      year: entryEndYear,
    }),
    enabled:
      !!companyId &&
      entryEndYear !== selectedYear &&
      entryEndYear !== entryStartYear,
  })

  const lockedMonthSetForView = React.useMemo(
    () => buildLockedMonthSet(loggingPeriodsView),
    [loggingPeriodsView],
  )

  const lockedMonthSetForEntry = React.useMemo(
    () =>
      buildLockedMonthSet([
        ...loggingPeriodsView,
        ...loggingPeriodsStart,
        ...loggingPeriodsEnd,
      ]),
    [loggingPeriodsEnd, loggingPeriodsStart, loggingPeriodsView],
  )

  const isEntryInLockedPeriod = React.useMemo(() => {
    return isRangeOverlappingLockedPeriod({
      startAt,
      endAt,
      lockedMonthSet: lockedMonthSetForEntry,
    })
  }, [endAt, lockedMonthSetForEntry, startAt])

  const handleJobSelect = React.useCallback(
    (job: {
      id: string
      title: string
      jobnr: number | null
      start_at: string | null
      end_at: string | null
    }) => {
      // Keep the user's when-fields; attaching a job should not replace the
      // entry window with the job's full schedule (often multi-day).
      setSelectedJobId(job.id)
      setTitle(job.title || '')
      setJobNumber(job.jobnr != null ? String(job.jobnr) : '')
      setJobSearchOpen(false)
      setJobSearch('')
    },
    [],
  )

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error('Missing company or user')
      if (isEntryInLockedPeriod) {
        throw new Error('You cannot add an entry in a locked logging period')
      }
      if (!resolvedTitle) {
        throw new Error('Title is required')
      }
      let nextStartAt = startAt
      let nextEndAt = endAt
      if (timeMode === 'hours') {
        if (!isValidLoggedHours(parsedHours)) {
          throw new Error('Enter hours greater than 0, up to 24')
        }
        if (!startAt) {
          throw new Error('Date is required')
        }
        const range = hoursToRange(startAt, parsedHours)
        nextStartAt = range.startAt
        nextEndAt = range.endAt
      } else {
        if (!startAt || !endAt) {
          throw new Error('Start and end time are required')
        }
        if (hasInvalidTimeRange) {
          throw new Error('End time must be after start time')
        }
      }

      await createTimeEntry({
        company_id: companyId,
        user_id: userId,
        title: resolvedTitle,
        job_number: selectedJobId ? jobNumber.trim() || null : null,
        note: note.trim() || null,
        start_at: nextStartAt,
        end_at: nextEndAt,
        job_id: selectedJobId,
      } as TimeEntryInsert)
    },
    onSuccess: () => {
      const { startAt: resetStart, endAt: resetEnd } = getDefaultTimes()
      setNote('')
      if (timeMode === 'hours') {
        const hours = isValidLoggedHours(parsedHours) ? parsedHours : 1
        const range = hoursToRange(resetStart, hours)
        setStartAt(range.startAt)
        setEndAt(range.endAt)
        setHoursInput(formatHoursInput(hours))
      } else {
        setStartAt(resetStart)
        setEndAt(resetEnd)
      }
      if (selectedJobId) {
        success('Saved', 'Time entry added. You can add another for this job.')
        invalidateEntries()
        return
      }
      setTitle('')
      setJobNumber('')
      setJobSearch('')
      setSelectedJobId(null)
      success('Saved', 'Time entry added')
      invalidateEntries()
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : 'Please try again.'
      error('Failed to save', message)
    },
  })

  const deleteEntry = useMutation({
    mutationFn: async (entry: TimeEntryWithProfile) => {
      if (!companyId || !userId) throw new Error('Missing company or user')
      if (
        isRangeOverlappingLockedPeriod({
          startAt: entry.start_at,
          endAt: entry.end_at,
          lockedMonthSet: lockedMonthSetForView,
        })
      ) {
        throw new Error('You cannot delete an entry in a locked logging period')
      }
      await deleteTimeEntry({ id: entry.id })
    },
    onSuccess: () => {
      setDeleteCandidate(null)
      success('Deleted', 'Time entry removed')
      invalidateEntries()
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : 'Please try again.'
      error('Failed to delete', message)
    },
  })

  const invalidateEntries = React.useCallback(() => {
    void Promise.all([
      qc.invalidateQueries({
        queryKey: ['time_entries', companyId, userId, from, to],
      }),
      qc.invalidateQueries({
        queryKey: ['time_entries', companyId, 'all', from, to],
      }),
      qc.invalidateQueries({
        queryKey: ['logging', 'previously-logged-jobs', companyId, userId],
      }),
    ])
  }, [companyId, from, qc, to, userId])

  const lastSelectedMonthRef = React.useRef(selectedMonth)
  React.useEffect(() => {
    if (lastSelectedMonthRef.current === selectedMonth) return
    lastSelectedMonthRef.current = selectedMonth
    const shifted = shiftRangeToMonth({
      startAt,
      endAt,
      monthKey: selectedMonth,
    })
    if (!shifted) return
    if (shifted.startAt !== startAt) setStartAt(shifted.startAt)
    if (shifted.endAt !== endAt) setEndAt(shifted.endAt)
  }, [endAt, selectedMonth, startAt])

  const [editingEntry, setEditingEntry] =
    React.useState<TimeEntryWithProfile | null>(null)
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<TimeEntryWithProfile | null>(null)

  const openNewEntry = React.useCallback(() => {
    const { startAt: resetStart, endAt: resetEnd } = getDefaultTimes()
    const shifted = shiftRangeToMonth({
      startAt: resetStart,
      endAt: resetEnd,
      monthKey: selectedMonth,
    })
    setSelectedJobId(null)
    setShowAllJobs(false)
    setJobSearch('')
    setJobSearchOpen(false)
    setTitle('')
    setJobNumber('')
    setNote('')
    setTimeMode('range')
    setHoursInput('1')
    setStartAt(shifted?.startAt ?? resetStart)
    setEndAt(shifted?.endAt ?? resetEnd)
    setEditingEntry(null)
    openDrawer()
  }, [openDrawer, selectedMonth])

  const entryForm = (
    <>
      {isLarge && (
        <>
          <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
            <Heading size="5">Logging</Heading>
          </Flex>
          <Separator size="4" mb="4" />
        </>
      )}

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <LoggingJobPickerField
          selectedJobId={selectedJobId}
          selectedLabel={selectedJobLabel}
          search={jobSearch}
          onSearchChange={setJobSearch}
          open={jobSearchOpen}
          onOpenChange={setJobSearchOpen}
          showAllJobs={showAllJobs}
          onShowAllJobsChange={setShowAllJobs}
          sections={jobPickerSections}
          previouslyLoggedJobIds={previouslyLoggedJobIds}
          loading={jobsSearchLoading}
          truncated={jobsTruncated}
          truncatedLimit={LOGGING_JOBS_MAX_ROWS}
          onSelectJob={handleJobSelect}
          onClearJob={() => {
            setSelectedJobId(null)
            setJobSearch(title)
            setJobNumber('')
            setJobSearchOpen(true)
          }}
          onUseTitleOnly={() => {
            setJobSearchOpen(false)
          }}
          inputRef={jobSearchInputRef}
        />
        <Box style={{ gridColumn: '1 / -1' }}>
          <TimeEntryWhenFields
            mode={timeMode}
            onModeChange={setTimeMode}
            startAt={startAt}
            endAt={endAt}
            onRangeChange={({ startAt: s, endAt: e }) => {
              setStartAt(s)
              setEndAt(e)
            }}
            hoursInput={hoursInput}
            onHoursInputChange={setHoursInput}
            rangeInvalid={hasInvalidTimeRange}
          />
        </Box>
      </Box>

      <Box mt="4">
        <Text as="div" size="2" mb="1" weight="medium">
          Note
        </Text>
        <TextArea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional notes"
          style={{ minHeight: 60, width: '100%', display: 'block' }}
          disabled={false}
        />
      </Box>

      <Flex justify="between" align="center" mt="4" wrap="wrap" gap="2">
        <Text size="4" weight="bold">
          {pickedHours}
        </Text>
        <Button
          onClick={() => createEntry.mutate()}
          disabled={
            createEntry.isPending ||
            !resolvedTitle ||
            hasInvalidTimeRange ||
            hasInvalidHours ||
            isEntryInLockedPeriod
          }
        >
          {createEntry.isPending ? 'Saving…' : 'Add entry'}
        </Button>
      </Flex>
      {isEntryInLockedPeriod && (
        <Text size="2" color="red" mt="2">
          You can&apos;t add an entry in a locked logging period.
        </Text>
      )}
    </>
  )

  const totalHours = React.useMemo(() => {
    const total = entries.reduce((acc, entry) => {
      const start = new Date(entry.start_at).getTime()
      const end = new Date(entry.end_at).getTime()
      const durationMs = Math.max(0, end - start)
      return acc + durationMs
    }, 0)
    return total / (1000 * 60 * 60)
  }, [entries])

  const monthToolbar = (
    <Flex direction="column" gap="3" style={{ width: '100%', minWidth: 0 }}>
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="4">
          Entries for {userDisplayName ?? 'you'} – {label}
        </Heading>
        <Flex align="center" gap="3">
          <Text size="2" color="gray">
            {entries.length} total
          </Text>
          <Select.Root
            value={String(selectedYear)}
            onValueChange={(value: string) => {
              const monthPart = selectedMonth.split('-')[1] ?? '01'
              setSelectedMonth(`${value}-${monthPart}`)
            }}
          >
            <Select.Trigger />
            <Select.Content>
              {yearOptions.map((year) => (
                <Select.Item key={year} value={String(year)}>
                  {year}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>
      <LoggingMonthScroller
        value={selectedMonth}
        onValueChange={setSelectedMonth}
        months={monthOptions}
        lockedMonthSet={lockedMonthSetForView}
      />
    </Flex>
  )

  const entriesTable = (
    <>
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Box mb="2" style={{ flexShrink: 0 }}>
          {monthToolbar}
        </Box>
        <Separator size="4" mb="3" style={{ flexShrink: 0 }} />

        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <TimeEntriesTable
            entries={entries}
            isLoading={isLoading}
            showEmployeeColumn={false}
            onEditEntry={(entry) => setEditingEntry(entry)}
            canEditEntry={(entry) => {
              if (
                isRangeOverlappingLockedPeriod({
                  startAt: entry.start_at,
                  endAt: entry.end_at,
                  lockedMonthSet: lockedMonthSetForView,
                })
              )
                return false
              if (!userId) return false
              if (isGlobalSuperuser) return true
              return entry.user_id === userId
            }}
            onDeleteEntry={(entry) => {
              setDeleteCandidate(entry)
            }}
            canDeleteEntry={(entry) => {
              if (
                isRangeOverlappingLockedPeriod({
                  startAt: entry.start_at,
                  endAt: entry.end_at,
                  lockedMonthSet: lockedMonthSetForView,
                })
              )
                return false
              if (!userId) return false
              if (isGlobalSuperuser) return true
              return entry.user_id === userId && !deleteEntry.isPending
            }}
          />
        </Box>

        <Flex justify="end" mt="3" style={{ flexShrink: 0 }}>
          <Text size="4" weight="bold">
            Total: {totalHours.toFixed(2)} hours
          </Text>
        </Flex>
      </Box>
    </>
  )

  const entryDialogs = (
    <>
      <EditTimeEntryDialog
        open={Boolean(editingEntry)}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null)
        }}
        entry={editingEntry}
        onSaved={invalidateEntries}
        disabled={Boolean(
          editingEntry &&
            isRangeOverlappingLockedPeriod({
              startAt: editingEntry.start_at,
              endAt: editingEntry.end_at,
              lockedMonthSet: lockedMonthSetForView,
            }),
        )}
      />
      <Dialog.Root
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null)
        }}
      >
        <Dialog.Content size="2" style={{ maxWidth: 480 }}>
          <Dialog.Title>Delete time entry</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            This will permanently remove the entry.
          </Dialog.Description>
          {deleteCandidate && (
            <Text size="2" as="div">
              {deleteCandidate.title}
            </Text>
          )}
          <Flex justify="end" gap="2" mt="4">
            <Button
              variant="soft"
              disabled={deleteEntry.isPending}
              onClick={() => setDeleteCandidate(null)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (!deleteCandidate) return
                deleteEntry.mutate(deleteCandidate)
              }}
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.logging}
        leftMinWidthPx={320}
        rightMinWidthPx={320}
        showLeftHeader={false}
        showRightHeader={false}
        showInspector={false}
      />
    )
  }

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        drawerTitle="New entry"
        inspector={entryForm}
      >
        <MobilePageList toolbar={monthToolbar}>
          <Flex
            direction="column"
            gap="3"
            style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
          >
            <TimeEntriesTable
              entries={entries}
              isLoading={isLoading}
              showEmployeeColumn={false}
              onEditEntry={(entry) => setEditingEntry(entry)}
              canEditEntry={(entry) => {
                if (
                  isRangeOverlappingLockedPeriod({
                    startAt: entry.start_at,
                    endAt: entry.end_at,
                    lockedMonthSet: lockedMonthSetForView,
                  })
                )
                  return false
                if (!userId) return false
                if (isGlobalSuperuser) return true
                return entry.user_id === userId
              }}
              onDeleteEntry={(entry) => {
                setDeleteCandidate(entry)
              }}
              canDeleteEntry={(entry) => {
                if (
                  isRangeOverlappingLockedPeriod({
                    startAt: entry.start_at,
                    endAt: entry.end_at,
                    lockedMonthSet: lockedMonthSetForView,
                  })
                )
                  return false
                if (!userId) return false
                if (isGlobalSuperuser) return true
                return entry.user_id === userId && !deleteEntry.isPending
              }}
            />
            <Flex justify="end">
              <Text size="4" weight="bold">
                Total: {totalHours.toFixed(2)} hours
              </Text>
            </Flex>
          </Flex>
        </MobilePageList>
        <MobileBottomActionBar hidden={drawerOpen}>
          <Button variant="ghost" size="3" onClick={openNewEntry}>
            <Plus width={18} height={18} />
            New entry
          </Button>
        </MobileBottomActionBar>
        {entryDialogs}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.logging}
      leftMinWidthPx={320}
      rightMinWidthPx={320}
      showLeftHeader={false}
      showRightHeader={false}
      left={entryForm}
      leftBodyStyle={{ overflowY: 'auto' }}
      right={
        <>
          {entriesTable}
          {entryDialogs}
        </>
      }
      rightBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  )
}
