import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Select,
  Separator,
  Switch,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { InfoCircle, Link as LinkIcon, Plus, Search } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import LoggingMonthScroller from '../components/LoggingMonthScroller'
import TimeEntriesTable from '../components/TimeEntriesTable'
import TimeEntryWhenFields from '../components/TimeEntryWhenFields'
import { buildLoggingJobPickerList, loggingSearchTerm } from '../lib/jobPicker'
import {
  formatHoursBetween,
  formatHoursInput,
  hoursFromRangeOrDefault,
  hoursToRange,
  isValidLoggedHours,
  parseHoursInput,
} from '../lib/timeEntryHours'
import {
  formatLoggingDate,
  formatMonthInput,
  getMonthOptions,
  getRange,
} from '../lib/timeEntryRange'
import type { TimeInputMode } from '../lib/timeEntryHours'
import type { LoggingPeriod } from '../api/loggingPeriods'
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

  const { data: jobsData = [], isLoading: jobsLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: loggingSearchTerm(jobSearch),
      sortBy: 'start_at',
      sortDir: 'desc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
      includeArchived: false,
      onlyCrewForUserId: showAllJobs ? null : (userId ?? null),
    }),
    enabled,
  })

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

  const jobsForPicker = React.useMemo(
    () =>
      buildLoggingJobPickerList({
        jobs: jobsData,
        previouslyLoggedJobs,
        search: jobSearch,
        now: new Date(),
      }),
    [jobSearch, jobsData, previouslyLoggedJobs],
  )

  const entryStartYear = React.useMemo(
    () => getYearFromIso(startAt) ?? new Date().getFullYear(),
    [startAt],
  )
  const entryEndYear = React.useMemo(
    () => getYearFromIso(endAt) ?? entryStartYear,
    [endAt, entryStartYear],
  )

  const { data: loggingPeriodsView = [] } = useQuery<Array<LoggingPeriod>>({
    queryKey: ['logging_periods', companyId ?? 'none', selectedYear],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return []
      const { queryFn } = loggingPeriodsQuery({ companyId, year: selectedYear })
      return queryFn()
    },
  })
  const { data: loggingPeriodsStart = [] } = useQuery<Array<LoggingPeriod>>({
    queryKey: ['logging_periods', companyId ?? 'none', entryStartYear],
    enabled: !!companyId && entryStartYear !== selectedYear,
    queryFn: async () => {
      if (!companyId) return []
      const { queryFn } = loggingPeriodsQuery({
        companyId,
        year: entryStartYear,
      })
      return queryFn()
    },
  })
  const { data: loggingPeriodsEnd = [] } = useQuery<Array<LoggingPeriod>>({
    queryKey: ['logging_periods', companyId ?? 'none', entryEndYear],
    enabled:
      !!companyId &&
      entryEndYear !== selectedYear &&
      entryEndYear !== entryStartYear,
    queryFn: async () => {
      if (!companyId) return []
      const { queryFn } = loggingPeriodsQuery({
        companyId,
        year: entryEndYear,
      })
      return queryFn()
    },
  })

  const lockedMonthSetForView = React.useMemo(() => {
    const set = new Set<string>()
    loggingPeriodsView.forEach((period) => {
      if (!period.is_locked) return
      const monthKey = toMonthKey(period.period_start)
      set.add(monthKey)
    })
    return set
  }, [loggingPeriodsView])

  const lockedMonthSetForEntry = React.useMemo(() => {
    const set = new Set<string>()
    const combined = [
      ...loggingPeriodsView,
      ...loggingPeriodsStart,
      ...loggingPeriodsEnd,
    ]
    combined.forEach((period) => {
      if (!period.is_locked) return
      const monthKey = toMonthKey(period.period_start)
      set.add(monthKey)
    })
    return set
  }, [loggingPeriodsEnd, loggingPeriodsStart, loggingPeriodsView])

  const isEntryInLockedPeriod = React.useMemo(() => {
    return isRangeOverlappingLockedPeriod({
      startAt,
      endAt,
      lockedMonthSet: lockedMonthSetForEntry,
    })
  }, [endAt, lockedMonthSetForEntry, startAt])

  const handleJobSelect = React.useCallback(
    (
      jobId: string,
      job?: {
        id: string
        title: string
        jobnr: number | null
        start_at: string | null
        end_at: string | null
      },
    ) => {
      setSelectedJobId(jobId)
      const resolved =
        job ??
        jobsData.find((item) => item.id === jobId) ??
        previouslyLoggedJobs.find((item) => item.id === jobId)
      if (!resolved) return

      setTitle(resolved.title || '')
      setJobNumber(resolved.jobnr != null ? String(resolved.jobnr) : '')

      const nextStart = resolved.start_at ?? ''
      if (timeMode === 'hours') {
        const hours = hoursFromRangeOrDefault(startAt, endAt)
        const dateIso = nextStart || startAt
        if (dateIso) {
          const range = hoursToRange(dateIso, hours)
          setStartAt(range.startAt)
          setEndAt(range.endAt)
          setHoursInput(formatHoursInput(hours))
        }
      } else if (nextStart) {
        setStartAt(nextStart)
        if (resolved.end_at) {
          setEndAt(resolved.end_at)
        } else {
          setEndAt(getEndFallback(nextStart))
        }
      }
      setJobSearchOpen(false)
      setJobSearch('')
    },
    [jobsData, previouslyLoggedJobs, startAt, endAt, timeMode],
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
    onSuccess: async () => {
      await invalidateEntries()
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
        return
      }
      setTitle('')
      setJobNumber('')
      setJobSearch('')
      setSelectedJobId(null)
      success('Saved', 'Time entry added')
    },
    onError: (e: any) => {
      error('Failed to save', e?.message || 'Please try again.')
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
    onSuccess: async () => {
      await invalidateEntries()
      setDeleteCandidate(null)
      success('Deleted', 'Time entry removed')
    },
    onError: (e: any) => {
      error('Failed to delete', e?.message || 'Please try again.')
    },
  })

  const invalidateEntries = React.useCallback(async () => {
    await qc.invalidateQueries({
      queryKey: ['time_entries', companyId, userId, from, to],
    })
    await qc.invalidateQueries({
      queryKey: ['time_entries', companyId, 'all', from, to],
    })
    await qc.invalidateQueries({
      queryKey: ['logging', 'previously-logged-jobs', companyId, userId],
    })
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
        <Box style={{ position: 'relative', gridColumn: '1 / -1' }}>
          <Text as="div" size="2" mb="1" weight="medium">
            Title
          </Text>
          {selectedJobId ? (
            <Flex align="center" gap="2">
              <Flex
                align="center"
                gap="2"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 'var(--space-6)',
                  padding: '0 var(--space-2)',
                  borderRadius: 'max(var(--radius-2), var(--radius-full))',
                  boxShadow: 'inset 0 0 0 1px var(--gray-a7)',
                  background: 'var(--color-surface)',
                }}
              >
                <Tooltip content="Linked to a job">
                  <span
                    aria-label="Linked to a job"
                    style={{
                      display: 'inline-flex',
                      flexShrink: 0,
                      color: 'var(--accent-11)',
                    }}
                  >
                    <LinkIcon width={16} height={16} />
                  </span>
                </Tooltip>
                <Text size="2" style={{ flex: 1, minWidth: 0 }} truncate>
                  {(() => {
                    const job =
                      jobsData.find((j) => j.id === selectedJobId) ??
                      previouslyLoggedJobs.find((j) => j.id === selectedJobId)
                    return job ? formatJobOption(job) : title || selectedJobId
                  })()}
                </Text>
              </Flex>
              <Button
                size="2"
                variant="soft"
                onClick={() => {
                  setSelectedJobId(null)
                  setJobSearch(title)
                  setJobNumber('')
                  setJobSearchOpen(true)
                }}
              >
                Change
              </Button>
            </Flex>
          ) : (
            <>
              <Flex align="center" gap="3" wrap="wrap">
                <Box ref={jobSearchInputRef} style={{ flex: 1, minWidth: 240 }}>
                  <TextField.Root
                    placeholder="Search a job or type a title"
                    value={jobSearch}
                    onChange={(e) => {
                      setJobSearch(e.target.value)
                      setJobSearchOpen(true)
                    }}
                    onFocus={() => setJobSearchOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setJobSearchOpen(false), 150)
                    }}
                  >
                    <TextField.Slot side="left">
                      <Search width={16} height={16} />
                    </TextField.Slot>
                  </TextField.Root>
                </Box>
                <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                  <Switch
                    checked={showAllJobs}
                    onCheckedChange={(v) => setShowAllJobs(Boolean(v))}
                  />
                  <Text size="2">Show all jobs</Text>
                  <Tooltip content="Job list: Off — Only jobs you're crew on (newest first, today and the next 2 days plus all past). On — All company jobs in the same date range. Jobs you've already logged time on always appear so you can add another entry.">
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="gray"
                      style={{ cursor: 'help' }}
                      aria-label="Explain job list options"
                    >
                      <InfoCircle width={16} height={16} />
                    </IconButton>
                  </Tooltip>
                </Flex>
              </Flex>
              {jobSearchOpen && (
                <Box
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    zIndex: 10,
                    maxHeight: 280,
                    overflow: 'auto',
                    background: 'var(--color-background)',
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 'var(--radius-3)',
                    boxShadow: 'var(--shadow-4)',
                  }}
                >
                  {jobsForPicker.length === 0 ? (
                    <Box p="3">
                      <Text size="2" color="gray">
                        {jobsLoading
                          ? 'Loading jobs…'
                          : jobSearch.trim()
                            ? 'No matching jobs. Keep this text as the title, or turn on "Show all jobs".'
                            : 'No jobs found. Try a different search or turn on "Show all jobs".'}
                      </Text>
                    </Box>
                  ) : (
                    jobsForPicker.map((job) => (
                      <Box
                        key={job.id}
                        asChild
                        p="2"
                        style={{
                          cursor: 'pointer',
                        }}
                        onClick={() => handleJobSelect(job.id, job)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div>
                          <Flex align="center" gap="2" wrap="wrap">
                            <Text size="2">{formatJobOption(job)}</Text>
                            {previouslyLoggedJobIds.has(job.id) && (
                              <Badge size="1" color="green" variant="soft">
                                Logged
                              </Badge>
                            )}
                            {isJobOnToday(job) && (
                              <Badge size="1" color="blue" variant="soft">
                                Today
                              </Badge>
                            )}
                          </Flex>
                          {(job.customer?.name ??
                            job.project_lead?.display_name) && (
                            <Text size="1" color="gray" as="div">
                              {[
                                job.customer?.name,
                                job.project_lead?.display_name,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          )}
                        </div>
                      </Box>
                    ))
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
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
          <Button variant="solid" size="3" onClick={openNewEntry}>
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

function getDefaultTimes() {
  const start = new Date()
  const minutes = start.getMinutes()
  start.setMinutes(0, 0, 0)
  if (minutes >= 30) {
    start.setHours(start.getHours() + 1)
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function getYearFromIso(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getFullYear()
}

function getMonthKeyFromDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function isRangeOverlappingLockedPeriod({
  startAt,
  endAt,
  lockedMonthSet,
}: {
  startAt: string
  endAt: string
  lockedMonthSet: Set<string>
}) {
  if (!startAt || !endAt || lockedMonthSet.size === 0) return false
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false
  }
  if (end.getTime() < start.getTime()) return false

  const cursor = new Date(start)
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)
  const endMonth = new Date(end)
  endMonth.setDate(1)
  endMonth.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= endMonth.getTime()) {
    if (lockedMonthSet.has(getMonthKeyFromDate(cursor))) return true
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return false
}

function shiftRangeToMonth({
  startAt,
  endAt,
  monthKey,
}: {
  startAt: string
  endAt: string
  monthKey: string
}) {
  if (!startAt || !endAt || !monthKey) return null
  if (toMonthKey(startAt) === monthKey) return null
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const nextDay = Math.min(start.getDate(), lastDay)

  const nextStart = new Date(start)
  nextStart.setFullYear(year, monthIndex, nextDay)
  const nextEnd = new Date(nextStart.getTime() + durationMs)
  return { startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() }
}

function formatJobOption(job: {
  title: string
  jobnr: number | null
  start_at: string | null
  end_at: string | null
}) {
  const numberPart = job.jobnr != null ? `#${job.jobnr}` : 'Job'
  const titlePart = job.title ? ` — ${job.title}` : ''
  const datePart = job.start_at ? ` (${formatLoggingDate(job.start_at)})` : ''
  return `${numberPart}${titlePart}${datePart}`
}

function isJobOnToday(job: {
  start_at: string | null
  end_at: string | null
}): boolean {
  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1
  if (job.start_at) {
    const t = new Date(job.start_at).getTime()
    if (t >= todayStart && t < todayEnd) return true
  }
  if (job.end_at) {
    const t = new Date(job.end_at).getTime()
    if (t >= todayStart && t < todayEnd) return true
  }
  return false
}

function getEndFallback(startAt: string) {
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return startAt
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return end.toISOString()
}

function toMonthKey(value: string) {
  const match = value.match(/^(\d{4}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 7)
  }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
