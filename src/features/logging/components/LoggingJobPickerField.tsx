import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  SegmentedControl,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { InfoCircle, Link as LinkIcon, Search } from 'iconoir-react'
import { formatJobOption, isJobOnToday } from '../lib/jobPicker'
import { formatLoggingDate } from '../lib/timeEntryRange'
import type {
  LoggingJobPickerItem,
  LoggingJobPickerSection,
} from '../lib/jobPicker'

export type LoggingJobPickerSelection = LoggingJobPickerItem

type Props = {
  selectedJobId: string | null
  selectedLabel: string
  search: string
  onSearchChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  showAllJobs: boolean
  onShowAllJobsChange: (showAll: boolean) => void
  sections: Array<LoggingJobPickerSection<LoggingJobPickerItem>>
  previouslyLoggedJobIds: Set<string>
  loading?: boolean
  truncated?: boolean
  truncatedLimit?: number
  onSelectJob: (job: LoggingJobPickerSelection) => void
  onClearJob: () => void
  onUseTitleOnly?: (title: string) => void
  inputRef?: React.RefObject<HTMLDivElement | null>
}

export default function LoggingJobPickerField({
  selectedJobId,
  selectedLabel,
  search,
  onSearchChange,
  open,
  onOpenChange,
  showAllJobs,
  onShowAllJobsChange,
  sections,
  previouslyLoggedJobIds,
  loading = false,
  truncated = false,
  truncatedLimit,
  onSelectJob,
  onClearJob,
  onUseTitleOnly,
  inputRef,
}: Props) {
  const flatJobs = React.useMemo(
    () => sections.flatMap((section) => section.jobs),
    [sections],
  )
  const sectionRows = React.useMemo(() => {
    let index = 0
    return sections.map((section) => ({
      ...section,
      rows: section.jobs.map((job) => {
        const jobIndex = index
        index += 1
        return { job, index: jobIndex }
      }),
    }))
  }, [sections])
  const [highlightIndex, setHighlightIndex] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)
  const trimmedSearch = search.trim()
  const showTitleOnly =
    Boolean(onUseTitleOnly) && trimmedSearch.length > 0 && !selectedJobId

  React.useEffect(() => {
    setHighlightIndex(0)
  }, [search, sections, open])

  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-job-index="${highlightIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  const moveHighlight = (delta: number) => {
    if (flatJobs.length === 0) return
    setHighlightIndex((prev) => {
      const next = prev + delta
      if (next < 0) return flatJobs.length - 1
      if (next >= flatJobs.length) return 0
      return next
    })
  }

  const selectHighlighted = () => {
    const job = flatJobs[highlightIndex]
    if (job) onSelectJob(job)
  }

  if (selectedJobId) {
    return (
      <Box style={{ gridColumn: '1 / -1' }}>
        <Text as="div" size="2" mb="1" weight="medium">
          Job
        </Text>
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
              {selectedLabel}
            </Text>
          </Flex>
          <Button size="2" variant="soft" onClick={onClearJob}>
            Change
          </Button>
        </Flex>
      </Box>
    )
  }

  return (
    <Box style={{ position: 'relative', gridColumn: '1 / -1' }}>
      <Flex align="center" justify="between" gap="2" mb="1" wrap="wrap">
        <Text as="div" size="2" weight="medium">
          Job
        </Text>
        <Flex align="center" gap="2">
          <SegmentedControl.Root
            size="1"
            value={showAllJobs ? 'all' : 'mine'}
            onValueChange={(value) => onShowAllJobsChange(value === 'all')}
          >
            <SegmentedControl.Item value="mine">My jobs</SegmentedControl.Item>
            <SegmentedControl.Item value="all">All jobs</SegmentedControl.Item>
          </SegmentedControl.Root>
          <Tooltip content="My jobs: crew assignments (plus anything you've logged before). All jobs: whole company. Typing a search always looks across all jobs so you can find the one you need.">
            <span
              aria-label="Explain job list options"
              style={{
                cursor: 'help',
                color: 'var(--gray-11)',
                display: 'inline-flex',
              }}
            >
              <InfoCircle width={16} height={16} />
            </span>
          </Tooltip>
        </Flex>
      </Flex>

      <Box ref={inputRef}>
        <TextField.Root
          placeholder="Search #, title, or customer — or type a free title"
          value={search}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="logging-job-picker-list"
          onChange={(e) => {
            onSearchChange(e.target.value)
            onOpenChange(true)
          }}
          onFocus={() => onOpenChange(true)}
          onBlur={() => {
            setTimeout(() => onOpenChange(false), 150)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              onOpenChange(true)
              moveHighlight(1)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onOpenChange(true)
              moveHighlight(-1)
              return
            }
            if (e.key === 'Enter' && open && flatJobs.length > 0) {
              e.preventDefault()
              selectHighlighted()
              return
            }
            if (e.key === 'Escape') {
              onOpenChange(false)
            }
          }}
        >
          <TextField.Slot side="left">
            <Search width={16} height={16} />
          </TextField.Slot>
        </TextField.Root>
      </Box>
      <Text size="1" color="gray" mt="1" as="div">
        Pick a job to attach this entry, or keep typing a title without linking.
      </Text>

      {open && (
        <Box
          id="logging-job-picker-list"
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 10,
            maxHeight: 320,
            overflow: 'auto',
            background: 'var(--color-background)',
            border: '1px solid var(--gray-a6)',
            borderRadius: 'var(--radius-3)',
            boxShadow: 'var(--shadow-4)',
          }}
        >
          {truncated && (
            <Box px="3" pt="2">
              <Text size="1" color="gray">
                Top {truncatedLimit} results — refine search
              </Text>
            </Box>
          )}

          {flatJobs.length === 0 ? (
            <Box p="3">
              <Text size="2" color="gray">
                {loading
                  ? 'Searching…'
                  : trimmedSearch
                    ? `No matches for “${trimmedSearch}”`
                    : showAllJobs
                      ? 'No jobs found. Try a different search.'
                      : 'No jobs in My jobs. Switch to All jobs or search by number/title.'}
              </Text>
            </Box>
          ) : (
            sectionRows.map((section) => (
              <Box key={section.id}>
                <Box px="3" pt="2" pb="1">
                  <Text
                    size="1"
                    weight="medium"
                    color="gray"
                    style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
                  >
                    {section.label}
                  </Text>
                </Box>
                {section.rows.map(({ job, index }) => {
                  const highlighted = index === highlightIndex
                  return (
                    <Box
                      key={job.id}
                      asChild
                      p="2"
                      data-job-index={index}
                      role="option"
                      aria-selected={highlighted}
                      style={{
                        cursor: 'pointer',
                        background: highlighted
                          ? 'var(--accent-a3)'
                          : undefined,
                      }}
                      onClick={() => onSelectJob(job)}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightIndex(index)}
                    >
                      <div>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text size="2">
                            {formatJobOption(job, formatLoggingDate)}
                          </Text>
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
                  )
                })}
              </Box>
            ))
          )}

          {showTitleOnly && (
            <Box
              p="2"
              style={{
                borderTop: '1px solid var(--gray-a5)',
                cursor: 'pointer',
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onUseTitleOnly?.(trimmedSearch)}
            >
              <Text size="2">Use “{trimmedSearch}” as title (no job)</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
