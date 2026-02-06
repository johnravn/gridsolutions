import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Separator,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, NavArrowDown, NavArrowRight, Trash } from 'iconoir-react'
import {
  jobDetailQuery,
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { supabase } from '@shared/api/supabase'
import { addThreeHours } from '@shared/lib/generalFunctions'
import { useAuthz } from '@shared/auth/useAuthz'
import type { TimePeriodLite } from '@features/jobs/types'

export default function TimelineTab({ jobId }: { jobId: string }) {
  const { data: job } = useQuery(jobDetailQuery({ jobId }))

  if (!job) return <Text>Loading...</Text>

  return (
    <Box>
      <Heading size="3" mb="3">
        Time Periods
      </Heading>
      <TimePeriodsManager
        jobId={jobId}
        jobStartAt={job.start_at}
        jobEndAt={job.end_at}
      />
    </Box>
  )
}

function TimePeriodsManager({
  jobId,
  jobStartAt,
  jobEndAt,
}: {
  jobId: string
  jobStartAt: string | null
  jobEndAt: string | null
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)
  const [deleting, setDeleting] = React.useState<TimePeriodLite | null>(null)
  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set())

  // Helper function to check if time period is Job duration
  const isJobDuration = (tp: TimePeriodLite) =>
    tp.title?.toLowerCase().includes('job duration')

  // Separate Job duration from other periods
  const { jobDuration, otherPeriods } = React.useMemo(() => {
    const jobDurationPeriod = timePeriods.find((tp) => isJobDuration(tp))
    const others = timePeriods.filter((tp) => !isJobDuration(tp))
    return {
      jobDuration: jobDurationPeriod || null,
      otherPeriods: others,
    }
  }, [timePeriods])

  // Auto-create "Job duration" if missing
  const createJobDuration = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No companyId')
      const periodStart = jobStartAt || new Date().toISOString()
      const periodEnd =
        jobEndAt || new Date(Date.now() + 86400000).toISOString() // +1 day

      await upsertTimePeriod({
        job_id: jobId,
        company_id: companyId,
        title: 'Job duration',
        start_at: periodStart,
        end_at: periodEnd,
        category: 'program',
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Created', 'Job duration time period created automatically')
    },
    onError: (e: any) => {
      error('Failed to create Job duration', e?.message || 'Please try again.')
    },
  })

  // Auto-create "Job duration" when component mounts if it's missing
  React.useEffect(() => {
    if (
      isReadOnly ||
      !jobDuration &&
      timePeriods.length > 0 && // Only create if we've loaded time periods (avoid race condition)
      !createJobDuration.isPending
    ) {
      createJobDuration.mutate()
    }
  }, [isReadOnly, jobDuration, timePeriods.length, createJobDuration.isPending])

  // Group other time periods by category
  const groupedPeriods = React.useMemo(() => {
    const groups = new Map<
      'program' | 'equipment' | 'crew' | 'transport',
      Array<TimePeriodLite>
    >()
    const defaultCategory: 'program' | 'equipment' | 'crew' | 'transport' =
      'program'

    for (const tp of otherPeriods) {
      const category = tp.category || defaultCategory
      const existing = groups.get(category) || []
      existing.push(tp)
      groups.set(category, existing)
    }

    return groups
  }, [otherPeriods])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const categoryLabels: Record<
    'program' | 'equipment' | 'crew' | 'transport',
    string
  > = {
    program: 'Program',
    equipment: 'Equipment',
    crew: 'Crew',
    transport: 'Transport',
  }

  const categoryOrder: Array<'program' | 'equipment' | 'crew' | 'transport'> = [
    'program',
    'equipment',
    'crew',
    'transport',
  ]

  const save = useMutation({
    mutationFn: async (p: {
      id?: string
      title: string
      start_at: string
      end_at: string
    }) => {
      if (!companyId) throw new Error('No companyId')
      const id = await upsertTimePeriod({
        id: p.id,
        job_id: jobId,
        company_id: companyId,
        title: p.title,
        start_at: p.start_at,
        end_at: p.end_at,
      })
      return id
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      setEditing(null)
      success('Success', 'Time period saved successfully')
    },
    onError: (e: any) => {
      error('Failed to save', e?.hint || e?.message || 'Please try again.')
    },
  })

  const deleteTimePeriod = useMutation({
    mutationFn: async (periodId: string) => {
      // Find the "Job duration" time period to reassign items to
      const durationPeriod = timePeriods.find((tp) =>
        tp.title?.toLowerCase().includes('job duration'),
      )
      if (!durationPeriod) {
        throw new Error('Job duration time period not found. Cannot delete.')
      }

      // Reassign all reserved_items to job duration
      const { error: itemsErr } = await supabase
        .from('reserved_items')
        .update({ time_period_id: durationPeriod.id })
        .eq('time_period_id', periodId)
      if (itemsErr) throw itemsErr

      // Reassign all reserved_crew to job duration
      const { error: crewErr } = await supabase
        .from('reserved_crew')
        .update({ time_period_id: durationPeriod.id })
        .eq('time_period_id', periodId)
      if (crewErr) throw crewErr

      // Reassign all reserved_vehicles to job duration
      const { error: vehiclesErr } = await supabase
        .from('reserved_vehicles')
        .update({ time_period_id: durationPeriod.id })
        .eq('time_period_id', periodId)
      if (vehiclesErr) throw vehiclesErr

      // Now delete the time period
      const { error: deleteErr } = await supabase
        .from('time_periods')
        .delete()
        .eq('id', periodId)
      if (deleteErr) throw deleteErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      setDeleting(null)
      success(
        'Deleted',
        'Time period deleted and items reassigned to Job duration',
      )
    },
    onError: (e: any) => {
      error('Failed to delete', e?.hint || e?.message || 'Please try again.')
    },
  })

  return (
    <Box>
      {/* Time Periods Table */}
      <Table.Root variant="surface" mb="3">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ width: '120px' }}>
              Actions
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {timePeriods.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <Text size="2" color="gray">
                  No time periods yet
                </Text>
              </Table.Cell>
            </Table.Row>
          )}

          {/* Job Duration Row (always visible at top) */}
          {jobDuration && (
            <Table.Row>
              <Table.Cell>
                <Flex align="center" gap="2">
                  <Text weight="bold">{jobDuration.title || '(untitled)'}</Text>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(jobDuration.start_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(jobDuration.end_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Badge size="1" color="orange">
                  Required
                </Badge>
              </Table.Cell>
            </Table.Row>
          )}

          {/* Category Groups */}
          {categoryOrder.map((category) => {
            const periods = groupedPeriods.get(category) || []
            if (periods.length === 0) return null

            const isExpanded = expandedCategories.has(category)
            const categoryLabel = categoryLabels[category]

            return (
              <React.Fragment key={category}>
                {/* Category Header Row */}
                <Table.Row
                  style={{
                    cursor: 'pointer',
                    background: 'var(--gray-a2)',
                    fontWeight: '600',
                  }}
                  onClick={() => toggleCategory(category)}
                >
                  <Table.Cell colSpan={4}>
                    <Flex align="center" gap="2">
                      {isExpanded ? (
                        <NavArrowDown width={18} height={18} />
                      ) : (
                        <NavArrowRight width={18} height={18} />
                      )}
                      <Text weight="bold">{categoryLabel}</Text>
                      <Badge size="1" variant="soft" color="gray">
                        {periods.length}
                      </Badge>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                {/* Time Period Rows (when expanded) */}
                {isExpanded &&
                  periods.map((tp) => (
                    <Table.Row key={tp.id}>
                      <Table.Cell>
                        <Flex
                          align="center"
                          gap="2"
                          style={{ paddingLeft: 24 }}
                        >
                          <Text weight="regular">
                            {tp.title || '(untitled)'}
                          </Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatDateTime(tp.start_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatDateTime(tp.end_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {!isReadOnly && (
                          <Flex gap="2">
                            <IconButton
                              size="1"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditing(tp)
                              }}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleting(tp)
                              }}
                            >
                              <Trash />
                            </IconButton>
                          </Flex>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </React.Fragment>
            )
          })}
        </Table.Body>
      </Table.Root>

      {/* Edit Dialog */}
      {editing && (
        <EditTimePeriodDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          timePeriod={editing}
          onSave={(data) => save.mutate(data)}
          isSaving={save.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleting && (
        <Dialog.Root
          open={true}
          onOpenChange={(open) => {
            if (!open && !deleteTimePeriod.isPending) {
              setDeleting(null)
            }
          }}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Time Period?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to delete "{deleting.title}"? All items,
              crew, and vehicles in this period will be reassigned to "Job
              duration".
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                onClick={() => setDeleting(null)}
                disabled={deleteTimePeriod.isPending}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => deleteTimePeriod.mutate(deleting.id)}
                disabled={deleteTimePeriod.isPending}
              >
                {deleteTimePeriod.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

function EditTimePeriodDialog({
  open,
  onOpenChange,
  timePeriod,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  timePeriod: TimePeriodLite
  onSave: (data: {
    id?: string
    title: string
    start_at: string
    end_at: string
  }) => void
  isSaving: boolean
}) {
  const [title, setTitle] = React.useState(timePeriod.title || '')
  const [startAt, setStartAt] = React.useState(timePeriod.start_at)
  const [endAt, setEndAt] = React.useState(timePeriod.end_at)
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(!timePeriod.id)
  const getDateMs = (value: string) => {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? null : ms
  }
  const hasInvalidTimeRange = (() => {
    const startMs = getDateMs(startAt)
    const endMs = getDateMs(endAt)
    if (startMs === null || endMs === null) return false
    return endMs < startMs
  })()

  // Auto-set end time when start time changes (only for new time periods)
  React.useEffect(() => {
    if (!startAt || !autoSetEndTime || timePeriod.id) return
    setEndAt(addThreeHours(startAt))
  }, [startAt, autoSetEndTime, timePeriod.id])

  const handleSave = () => {
    onSave({
      id: timePeriod.id || undefined,
      title: title.trim(),
      start_at: startAt,
      end_at: endAt,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          {timePeriod.id ? 'Edit Time Period' : 'New Time Period'}
        </Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <Box>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Title
              </Text>
              <TextField.Root
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Setup, Show, Teardown"
              />
            </label>
            {!timePeriod.id && (
              <Flex gap="2" wrap="wrap" mt="2">
                <Text size="1" color="gray" style={{ width: '100%' }}>
                  Quick suggestions:
                </Text>
                {[
                  'Equipment period',
                  'Crew period',
                  'Vehicle period',
                  'Setup',
                  'Show',
                  'Teardown',
                  'Load in',
                  'Load out',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    size="1"
                    variant="soft"
                    color="gray"
                    onClick={() => setTitle(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Flex>
            )}
          </Box>

          <DateTimePicker
            label="Start"
            value={startAt}
            onChange={(value) => {
              setStartAt(value)
              setAutoSetEndTime(!timePeriod.id)
            }}
          />
          <DateTimePicker
            label="End"
            value={endAt}
            invalid={hasInvalidTimeRange}
            onChange={(value) => {
              setEndAt(value)
              setAutoSetEndTime(false)
            }}
          />
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || hasInvalidTimeRange}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Utility functions
function formatDateTime(iso: string) {
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + `, ${hours}:${minutes}`
  )
}
