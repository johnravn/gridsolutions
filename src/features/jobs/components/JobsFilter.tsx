import * as React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  IconButton,
  Popover,
  SegmentedControl,
  Select,
  Switch,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { Filter, InfoCircle } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { DialogTrigger, PopoverTrigger } from '@shared/ui/radixAsChild'
import { CalendarGrid } from '@shared/ui/components/pickers/CalendarGrid'
import {
  dateToLocalDate,
  getInitialMonth,
  normalizeDateRange,
} from '@shared/ui/components/pickers/dateTimeUtils'
import {
  jobsListDatePresetRange,
  jobsListYearOptions,
  jobsListYearRange,
  resolveJobsDatePreset,
  resolveJobsListYear,
} from '../utils/jobsListDateFilter'
import type { JobsDatePreset } from '../utils/jobsListDateFilter'
import type { DateRangeSelection } from '@shared/ui/components/pickers/dateTimeUtils'
import type { JobStatus } from '../types'

export const ALL_STATUSES: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'invoiced',
  'paid',
]

/** Working statuses: hide invoiced, canceled, and paid. */
export const ACTIVE_STATUS_FILTER: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
]

/** Jobs list default: same as the working-status set. */
export const DEFAULT_STATUS_FILTER: Array<JobStatus> = ACTIVE_STATUS_FILTER

const DATE_PRESET_CHIPS: Array<{
  id: Exclude<JobsDatePreset, 'custom' | 'year'>
  label: string
}> = [
  { id: 'all', label: 'All dates' },
  { id: 'this_week', label: 'This week' },
  { id: 'next_2_weeks', label: 'Next 2 weeks' },
  { id: 'this_month', label: 'This month' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function sameStatusSet(a: Array<JobStatus>, b: Array<JobStatus>): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((status) => set.has(status))
}

function jobsFilterActiveCount({
  statusFilter,
  showOnlyArchived,
  showJobsInRecurringSeries,
  showMyJobsOnly,
  canFilterMyJobs,
  dateFrom,
  dateTo,
}: {
  statusFilter: Array<JobStatus>
  showOnlyArchived: boolean
  showJobsInRecurringSeries: boolean
  showMyJobsOnly: boolean
  canFilterMyJobs: boolean
  dateFrom: string
  dateTo: string
}): number {
  const statusIsDefault = sameStatusSet(statusFilter, DEFAULT_STATUS_FILTER)
  return (
    (statusIsDefault ? 0 : 1) +
    (showOnlyArchived ? 1 : 0) +
    (showJobsInRecurringSeries ? 1 : 0) +
    (canFilterMyJobs && showMyJobsOnly ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0)
  )
}

type Props = {
  statusFilter: Array<JobStatus>
  onStatusFilterChange: (v: Array<JobStatus>) => void
  showOnlyArchived: boolean
  onShowOnlyArchivedChange: (v: boolean) => void
  showJobsInRecurringSeries: boolean
  onShowJobsInRecurringSeriesChange: (v: boolean) => void
  showMyJobsOnly?: boolean
  onShowMyJobsOnlyChange?: (v: boolean) => void
  canFilterMyJobs?: boolean
  dateFrom?: string
  dateTo?: string
  onPeriodChange?: (range: { startDate: string; endDate: string }) => void
  compact?: boolean
}

function FilterTrigger({ activeCount }: { activeCount: number }) {
  return (
    <Box className="split-header-icon-wrap">
      <IconButton
        className="split-header-icon-button"
        variant="ghost"
        size="3"
        aria-label="Filters"
      >
        <Filter width={22} height={22} />
      </IconButton>
      {activeCount > 0 && (
        <Box aria-hidden className="split-header-icon-badge">
          {activeCount}
        </Box>
      )}
    </Box>
  )
}

function JobsFilterBody({
  statusFilter,
  onStatusFilterChange,
  showOnlyArchived,
  onShowOnlyArchivedChange,
  showJobsInRecurringSeries,
  onShowJobsInRecurringSeriesChange,
  showMyJobsOnly,
  onShowMyJobsOnlyChange,
  canFilterMyJobs,
  dateFrom,
  dateTo,
  onPeriodChange,
  compact = false,
}: Required<
  Pick<
    Props,
    | 'statusFilter'
    | 'onStatusFilterChange'
    | 'showOnlyArchived'
    | 'onShowOnlyArchivedChange'
    | 'showJobsInRecurringSeries'
    | 'onShowJobsInRecurringSeriesChange'
    | 'showMyJobsOnly'
    | 'canFilterMyJobs'
    | 'dateFrom'
    | 'dateTo'
  >
> &
  Pick<Props, 'onShowMyJobsOnlyChange' | 'onPeriodChange' | 'compact'>) {
  /** Radix size 3 on compact (phone sheet); size 2 on desktop popover. */
  const switchSize = compact ? '3' : '2'
  const selectedPreset = resolveJobsDatePreset(dateFrom, dateTo)
  const selectedYear = resolveJobsListYear(dateFrom, dateTo)
  const yearOptions = jobsListYearOptions()
  const [customOpen, setCustomOpen] = React.useState(
    selectedPreset === 'custom',
  )
  const [yearOpen, setYearOpen] = React.useState(selectedPreset === 'year')
  const [dateSelection, setDateSelection] = React.useState<DateRangeSelection>(
    () =>
      dateFrom
        ? { start: dateFrom, end: dateTo || dateFrom }
        : { start: null, end: null },
  )
  const [currentMonth, setCurrentMonth] = React.useState(() =>
    getInitialMonth(dateFrom || ''),
  )

  React.useEffect(() => {
    const preset = resolveJobsDatePreset(dateFrom, dateTo)
    setCustomOpen(preset === 'custom')
    setYearOpen(preset === 'year')
    if (dateFrom) {
      setDateSelection({ start: dateFrom, end: dateTo || dateFrom })
      setCurrentMonth(getInitialMonth(dateFrom))
    } else {
      setDateSelection({ start: null, end: null })
    }
  }, [dateFrom, dateTo])

  const showAllStatuses = sameStatusSet(statusFilter, ALL_STATUSES)

  const resetFilters = () => {
    onShowOnlyArchivedChange(false)
    onShowJobsInRecurringSeriesChange(false)
    onShowMyJobsOnlyChange?.(false)
    onStatusFilterChange([...DEFAULT_STATUS_FILTER])
    onPeriodChange?.({ startDate: '', endDate: '' })
    setCustomOpen(false)
    setYearOpen(false)
  }

  const applyPreset = (preset: Exclude<JobsDatePreset, 'custom' | 'year'>) => {
    setCustomOpen(false)
    setYearOpen(false)
    if (preset === 'all') {
      onPeriodChange?.({ startDate: '', endDate: '' })
      return
    }
    const range = jobsListDatePresetRange(preset)
    onPeriodChange?.({ startDate: range.dateFrom, endDate: range.dateTo })
  }

  const applyYear = (year: number) => {
    setCustomOpen(false)
    setYearOpen(true)
    const range = jobsListYearRange(year)
    onPeriodChange?.({ startDate: range.dateFrom, endDate: range.dateTo })
  }

  const openYearPicker = () => {
    setCustomOpen(false)
    setYearOpen(true)
    if (selectedPreset !== 'year') {
      applyYear(new Date().getFullYear())
    }
  }

  const handleDateClick = (date: Date) => {
    const clicked = dateToLocalDate(date)
    const { start, end } = dateSelection
    const hasCompletedMultiDay = start != null && end != null && start !== end
    if (!start || hasCompletedMultiDay) {
      setDateSelection({ start: clicked, end: null })
      return
    }
    const normalized = normalizeDateRange(start, clicked)
    setDateSelection({ start: normalized.start, end: normalized.end })
    onPeriodChange?.({
      startDate: normalized.start,
      endDate: normalized.end,
    })
  }

  const toggleStatus = (status: JobStatus) => {
    if (statusFilter.includes(status)) {
      const next = statusFilter.filter((s) => s !== status)
      if (next.length === 0) return
      onStatusFilterChange(next)
    } else {
      onStatusFilterChange([...statusFilter, status])
    }
  }

  const rangeForGrid: DateRangeSelection | undefined = dateSelection.start
    ? {
        start: dateSelection.start,
        end: dateSelection.end ?? dateSelection.start,
      }
    : undefined

  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center" gap="2">
        <Text size="3" weight="bold">
          Filters
        </Text>
        <Button size="1" variant="soft" color="gray" onClick={resetFilters}>
          Reset
        </Button>
      </Flex>

      {canFilterMyJobs && (
        <Flex direction="column" gap="1">
          <Flex align="center" justify="between" gap="3">
            <Text size="2" weight="medium">
              My jobs
            </Text>
            <Switch
              size={switchSize}
              checked={showMyJobsOnly}
              onCheckedChange={(checked) => onShowMyJobsOnlyChange?.(checked)}
              aria-label="My jobs"
            />
          </Flex>
          <Text size="1" color="gray">
            Crew or project lead.
          </Text>
        </Flex>
      )}

      <Flex direction="column" gap="2">
        <Flex direction="column" gap="1">
          <Text size="2" weight="medium">
            When
          </Text>
          <Text size="1" color="gray">
            Jobs that overlap this period.
          </Text>
        </Flex>
        <Flex gap="1" wrap="wrap">
          {DATE_PRESET_CHIPS.map((chip) => (
            <Button
              key={chip.id}
              size="1"
              variant={
                !customOpen && !yearOpen && selectedPreset === chip.id
                  ? 'solid'
                  : 'soft'
              }
              onClick={() => applyPreset(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
          <Button
            size="1"
            variant={yearOpen || selectedPreset === 'year' ? 'solid' : 'soft'}
            onClick={openYearPicker}
          >
            Year
          </Button>
          <Button
            size="1"
            variant={
              customOpen || selectedPreset === 'custom' ? 'solid' : 'soft'
            }
            onClick={() => {
              setYearOpen(false)
              setCustomOpen(true)
            }}
          >
            Custom
          </Button>
        </Flex>
        {yearOpen && (
          <Select.Root
            value={String(selectedYear ?? new Date().getFullYear())}
            onValueChange={(value) => applyYear(Number(value))}
          >
            <Select.Trigger
              aria-label="Filter year"
              style={{ width: '100%' }}
            />
            <Select.Content position="popper">
              {yearOptions.map((year) => (
                <Select.Item key={year} value={String(year)}>
                  {year}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        )}
        {customOpen && (
          <Flex direction="column" gap="2">
            <Text size="1" color="gray">
              {dateSelection.start && !dateSelection.end
                ? 'Select end date'
                : 'Select start and end date'}
            </Text>
            <CalendarGrid
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDateClick={handleDateClick}
              rangeSelection={rangeForGrid}
            />
          </Flex>
        )}
      </Flex>

      <Flex direction="column" gap="2">
        <Text size="2" weight="medium">
          Jobs
        </Text>
        <SegmentedControl.Root
          size="2"
          value={showOnlyArchived ? 'archived' : 'active'}
          onValueChange={(value) =>
            onShowOnlyArchivedChange(value === 'archived')
          }
        >
          <SegmentedControl.Item value="active">Active</SegmentedControl.Item>
          <SegmentedControl.Item value="archived">
            Archived
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Flex>

      <Flex direction="column" gap="1">
        <Flex align="center" justify="between" gap="3">
          <Text size="2" weight="medium">
            Jobs in a series
          </Text>
          <Switch
            size={switchSize}
            checked={showJobsInRecurringSeries}
            onCheckedChange={onShowJobsInRecurringSeriesChange}
            aria-label="Jobs in a series"
          />
        </Flex>
        <Text size="1" color="gray">
          Generated jobs from recurring templates. Off keeps those in the pin at
          the top.
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="2">
          <Flex align="center" gap="1">
            <Text size="2" weight="medium">
              Status
            </Text>
            <Tooltip content="Default is everything except invoiced, canceled, and paid.">
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                aria-label="Status help"
              >
                <InfoCircle width={14} height={14} />
              </IconButton>
            </Tooltip>
          </Flex>
          <Button
            size="1"
            variant={showAllStatuses ? 'solid' : 'soft'}
            onClick={() => onStatusFilterChange([...ALL_STATUSES])}
          >
            All
          </Button>
        </Flex>
        <Flex direction="column" gap="1">
          {ALL_STATUSES.map((status) => (
            <label
              key={status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Checkbox
                checked={statusFilter.includes(status)}
                onCheckedChange={() => toggleStatus(status)}
              />
              <Text size="2">{makeWordPresentable(status)}</Text>
            </label>
          ))}
        </Flex>
      </Flex>
    </Flex>
  )
}

export default function JobsFilter({
  statusFilter,
  onStatusFilterChange,
  showOnlyArchived,
  onShowOnlyArchivedChange,
  showJobsInRecurringSeries,
  onShowJobsInRecurringSeriesChange,
  showMyJobsOnly = false,
  onShowMyJobsOnlyChange,
  canFilterMyJobs = false,
  dateFrom = '',
  dateTo = '',
  onPeriodChange,
  compact = false,
}: Props) {
  const activeCount = jobsFilterActiveCount({
    statusFilter,
    showOnlyArchived,
    showJobsInRecurringSeries,
    showMyJobsOnly,
    canFilterMyJobs,
    dateFrom,
    dateTo,
  })

  const body = (
    <JobsFilterBody
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      showOnlyArchived={showOnlyArchived}
      onShowOnlyArchivedChange={onShowOnlyArchivedChange}
      showJobsInRecurringSeries={showJobsInRecurringSeries}
      onShowJobsInRecurringSeriesChange={onShowJobsInRecurringSeriesChange}
      showMyJobsOnly={showMyJobsOnly}
      onShowMyJobsOnlyChange={onShowMyJobsOnlyChange}
      canFilterMyJobs={canFilterMyJobs}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={onPeriodChange}
      compact={compact}
    />
  )

  if (compact) {
    return (
      <Dialog.Root>
        <DialogTrigger asChild>
          <span>
            <FilterTrigger activeCount={activeCount} />
          </span>
        </DialogTrigger>
        <Dialog.Content
          aria-describedby={undefined}
          className="home-bottom-sheet"
          style={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            top: 'auto',
            left: 0,
            right: 0,
            margin: 0,
            maxWidth: '100%',
            width: '100%',
            maxHeight: '70dvh',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Dialog.Title
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            Filters
          </Dialog.Title>
          <Box style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>{body}</Box>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <Popover.Root>
      <PopoverTrigger asChild>
        <span>
          <FilterTrigger activeCount={activeCount} />
        </span>
      </PopoverTrigger>
      <Popover.Content
        align="end"
        side="bottom"
        sideOffset={8}
        style={{
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'min(80vh, 640px)',
          overflowY: 'auto',
        }}
      >
        {body}
      </Popover.Content>
    </Popover.Root>
  )
}
