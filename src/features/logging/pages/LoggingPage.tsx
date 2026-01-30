import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  SegmentedControl,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Lock } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { jobsIndexQuery } from '@features/jobs/api/queries'
import {
  createTimeEntry,
  deleteTimeEntry,
  timeEntriesQuery,
} from '../api/timeEntries'
import { loggingPeriodsQuery } from '../api/loggingPeriods'
import EditTimeEntryDialog from '../components/EditTimeEntryDialog'
import TimeEntriesTable from '../components/TimeEntriesTable'
import {
  formatMonthInput,
  getMonthOptions,
  getRange,
} from '../lib/timeEntryRange'
import type { LoggingPeriod } from '../api/loggingPeriods'
import type { TimeEntryWithProfile } from '../api/timeEntries'

export default function LoggingPage() {
  const { companyId } = useCompany()
  const { userId, isGlobalSuperuser, companyRole } = useAuthz()
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
  const [entryMode, setEntryMode] = React.useState<'manual' | 'job'>('manual')
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [jobNumber, setJobNumber] = React.useState('')
  const [note, setNote] = React.useState('')
  const [startAt, setStartAt] = React.useState(defaultStartAt)
  const [endAt, setEndAt] = React.useState(defaultEndAt)
  const hasInvalidTimeRange = React.useMemo(() => {
    if (!startAt || !endAt) return false
    return new Date(endAt).getTime() < new Date(startAt).getTime()
  }, [endAt, startAt])
  const pickedHours = React.useMemo(
    () => formatHoursBetween(startAt, endAt),
    [startAt, endAt],
  )

  const enabled = Boolean(companyId && userId)
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
      search: '',
      sortBy: 'start_at',
      sortDir: 'desc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
      includeArchived: false,
    }),
    enabled,
  })

  const recentJobs = React.useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return jobsData
      .filter((job) => {
        if (!job.start_at) return false
        return new Date(job.start_at).getTime() < todayStart.getTime()
      })
      .slice(0, 25)
  }, [jobsData])

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
    (jobId: string) => {
      setSelectedJobId(jobId)
      const job = recentJobs.find((item) => item.id === jobId)
      if (!job) return

      setTitle(job.title || '')
      setJobNumber(job.jobnr != null ? String(job.jobnr) : '')

      const nextStart = job.start_at ?? ''
      if (nextStart) {
        setStartAt(nextStart)
        if (job.end_at) {
          setEndAt(job.end_at)
        } else {
          setEndAt(getEndFallback(nextStart))
        }
      }
    },
    [recentJobs],
  )

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error('Missing company or user')
      if (isEntryInLockedPeriod) {
        throw new Error('You cannot add an entry in a locked logging period')
      }
      if (!title.trim()) {
        throw new Error('Title is required')
      }
      if (entryMode === 'job' && !selectedJobId) {
        throw new Error('Select a job to link')
      }
      if (!startAt || !endAt) {
        throw new Error('Start and end time are required')
      }
      if (hasInvalidTimeRange) {
        throw new Error('End time must be after start time')
      }

      await createTimeEntry({
        company_id: companyId,
        user_id: userId,
        title: title.trim(),
        job_number: jobNumber.trim() || null,
        note: note.trim() || null,
        start_at: startAt,
        end_at: endAt,
      })
    },
    onSuccess: async () => {
      await invalidateEntries()
      const { startAt: resetStart, endAt: resetEnd } = getDefaultTimes()
      setTitle('')
      setJobNumber('')
      setNote('')
      setStartAt(resetStart)
      setEndAt(resetEnd)
      setEntryMode('manual')
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
  }, [companyId, from, qc, to, userId])

  const handleStartChange = React.useCallback(
    (value: string) => {
      setStartAt(value)
      if (!value) return
      if (!endAt) {
        setEndAt(value)
        return
      }

      const startDate = new Date(value)
      const endDate = new Date(endAt)
      endDate.setFullYear(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      )
      const nextEndAt = endDate.toISOString()
      if (new Date(nextEndAt).getTime() < startDate.getTime()) {
        setEndAt(startDate.toISOString())
      } else {
        setEndAt(nextEndAt)
      }
    },
    [endAt],
  )

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

  const entryForm = (
    <>
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
        <Heading size="5">Logging</Heading>
      </Flex>
      <Separator size="4" mb="4" />

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Entry type
          </Text>
          <SegmentedControl.Root
            value={entryMode}
            onValueChange={(value) => {
              setEntryMode(value as 'manual' | 'job')
              if (value === 'manual') {
                setSelectedJobId(null)
              }
            }}
          >
            <SegmentedControl.Item value="manual">Manual</SegmentedControl.Item>
            <SegmentedControl.Item value="job">
              Link to job
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </label>
        {entryMode === 'job' && (
          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Recent job
            </Text>
            <Select.Root
              value={selectedJobId || undefined}
              onValueChange={handleJobSelect}
              disabled={false}
            >
              <Select.Trigger
                placeholder={jobsLoading ? 'Loading jobs…' : 'Select a job'}
              />
              <Select.Content>
                {recentJobs.length === 0 && (
                  <Select.Item value="none" disabled>
                    No recent jobs
                  </Select.Item>
                )}
                {recentJobs.map((job) => (
                  <Select.Item key={job.id} value={job.id}>
                    {formatJobOption(job)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>
        )}
        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Title
          </Text>
          <TextField.Root
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Time entry title"
            autoFocus
            disabled={false}
          />
        </label>
        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Job number
          </Text>
          <TextField.Root
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Optional"
            disabled={entryMode === 'job'}
          />
        </label>
        <DateTimePicker
          label="Start"
          value={startAt}
          onChange={handleStartChange}
          disabled={false}
        />
        <DateTimePicker
          label="End"
          value={endAt}
          onChange={(value) => setEndAt(value)}
          disabled={false}
          invalid={hasInvalidTimeRange}
        />
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
            !title.trim() ||
            hasInvalidTimeRange ||
            isEntryInLockedPeriod ||
            (entryMode === 'job' && !selectedJobId)
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

  const entriesTable = (
    <>
      <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
        <Heading size="4">Entries</Heading>
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2" color="gray">
            {entries.length} total
          </Text>
          <Select.Root
            value={String(selectedYear)}
            onValueChange={(value) => {
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
          <Box style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <SegmentedControl.Root
              value={selectedMonth}
              onValueChange={(value) => setSelectedMonth(value)}
              style={{ minWidth: 'max-content' }}
            >
              {monthOptions.map((month) => {
                const isLocked = lockedMonthSetForView.has(month.value)
                return (
                  <SegmentedControl.Item
                    key={month.value}
                    value={month.value}
                    style={
                      isLocked
                        ? {
                            backgroundColor: 'var(--green-3)',
                            color: 'var(--green-11)',
                          }
                        : undefined
                    }
                  >
                    <Flex align="center" gap="1">
                      <Text size="1">{month.label}</Text>
                      {isLocked && <Lock width={12} height={12} />}
                    </Flex>
                  </SegmentedControl.Item>
                )
              })}
            </SegmentedControl.Root>
          </Box>
        </Flex>
      </Flex>
      <Text size="2" color="gray" mb="3">
        Showing entries for {label}
      </Text>
      <Separator size="4" mb="3" />

      <TimeEntriesTable
        entries={entries}
        isLoading={isLoading}
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

      <Flex justify="end" mt="3">
        <Text size="4" weight="bold">
          Total: {totalHours.toFixed(2)} hours
        </Text>
      </Flex>
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

  // 35/65 split; same responsive pattern as you use elsewhere
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Resize state: track left panel width as percentage (default 35% for 35/65 ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(35)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      setLeftPanelWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!companyId) return <div>No company selected.</div>

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section style={{ minHeight: 0 }}>
        <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
          <Card size="3" style={{ minHeight: 0 }}>
            {entryForm}
          </Card>
          <Card size="3" style={{ overflowX: 'auto', minHeight: 0 }}>
            {entriesTable}
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <section style={{ height: '100%', minHeight: 0 }}>
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '320px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {entryForm}
          </Box>
        </Card>

        {/* RESIZER */}
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '6px',
            height: '20%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px',
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
              e.currentTarget.style.cursor = 'col-resize'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* RIGHT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '320px',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'auto',
            }}
          >
            {entriesTable}
          </Box>
        </Card>
      </Flex>
    </section>
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

function formatHoursBetween(startAt: string, endAt: string) {
  if (!startAt || !endAt) return '--'
  const start = new Date(startAt)
  const end = new Date(endAt)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const hours = durationMs / (1000 * 60 * 60)
  return `${hours.toFixed(2)} hours`
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
  const datePart = job.start_at ? ` (${formatJobDate(job.start_at)})` : ''
  return `${numberPart}${titlePart}${datePart}`
}

function formatJobDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
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
