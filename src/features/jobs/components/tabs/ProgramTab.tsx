import * as React from 'react'
import {
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
import { Edit, Plus, Trash } from 'iconoir-react'
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
import type { TimePeriodLite } from '../../types'

export default function ProgramTab({ jobId }: { jobId: string }) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const { data: job } = useQuery(jobDetailQuery({ jobId }))
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()
  const qc = useQueryClient()

  // Filter to only program periods (excluding "Job duration")
  const programPeriods = React.useMemo(() => {
    return timePeriods.filter(
      (tp) =>
        (tp.category === 'program' || !tp.category) &&
        !tp.title?.toLowerCase().includes('job duration'),
    )
  }, [timePeriods])

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)
  const [deleting, setDeleting] = React.useState<TimePeriodLite | null>(null)
  const [creating, setCreating] = React.useState(false)

  // Sort periods by start time
  const sortedPeriods = React.useMemo(() => {
    return [...programPeriods].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )
  }, [programPeriods])

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
        category: 'program',
      })
      return id
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      setEditing(null)
      setCreating(false)
      success('Success', 'Program period saved successfully')
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
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      setDeleting(null)
      success(
        'Deleted',
        'Program period deleted and items reassigned to Job duration',
      )
    },
    onError: (e: any) => {
      error('Failed to delete', e?.hint || e?.message || 'Please try again.')
    },
  })

  // Default start time based on job start or last period end
  const getDefaultStartTime = (): string => {
    if (sortedPeriods.length > 0) {
      const lastPeriod = sortedPeriods[sortedPeriods.length - 1]
      return lastPeriod.end_at
    }
    if (job?.start_at) {
      return job.start_at
    }
    return new Date().toISOString()
  }

  // Default end time (3 hours after start)
  const getDefaultEndTime = (startTime: string): string => {
    return addThreeHours(startTime)
  }

  if (!job) return <Text>Loading...</Text>

  return (
    <Box>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">Program</Heading>
        {!isReadOnly && (
          <Button
            size="2"
            onClick={() => {
              setCreating(true)
            }}
          >
            <Plus width={16} height={16} /> Add Period
          </Button>
        )}
      </Box>

      {sortedPeriods.length > 0 && (
        <Table.Root variant="surface" mb="3">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
              {!isReadOnly && (
                <Table.ColumnHeaderCell style={{ width: '120px' }}>
                  Actions
                </Table.ColumnHeaderCell>
              )}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sortedPeriods.map((tp) => {
              const start = new Date(tp.start_at)
              const end = new Date(tp.end_at)
              const durationMs = end.getTime() - start.getTime()
              const durationHours = durationMs / (1000 * 60 * 60)
              const durationMins = durationMs / (1000 * 60)

              let durationText = ''
              if (durationHours >= 1) {
                const hours = Math.floor(durationHours)
                const mins = Math.floor(
                  (durationMs % (1000 * 60 * 60)) / (1000 * 60),
                )
                if (mins > 0) {
                  durationText = `${hours}h ${mins}m`
                } else {
                  durationText = `${hours}h`
                }
              } else {
                durationText = `${Math.floor(durationMins)}m`
              }

              return (
                <Table.Row key={tp.id}>
                  <Table.Cell>
                    <Text weight="medium">{tp.title || '(untitled)'}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatTime(tp.start_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatTime(tp.end_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {durationText}
                    </Text>
                  </Table.Cell>
                  {!isReadOnly && (
                    <Table.Cell>
                      <Flex gap="2">
                        <IconButton
                          size="1"
                          variant="ghost"
                          onClick={() => setEditing(tp)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="red"
                          onClick={() => setDeleting(tp)}
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  )}
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      )}

      {!isReadOnly && (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 100ms',
          }}
          onClick={() => setCreating(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Flex direction="column" align="center" gap="2">
            <Plus width={24} height={24} />
            <Text size="2" color="gray">
              Add program period
            </Text>
          </Flex>
        </Box>
      )}

      {/* Create Dialog */}
      {!isReadOnly && creating && (
        <EditTimePeriodDialog
          open={creating}
          onOpenChange={(open) => {
            if (!open && !save.isPending) {
              setCreating(false)
            }
          }}
          timePeriod={
            {
              id: '', // New period - no ID yet
              job_id: jobId,
              company_id: companyId!,
              title: '',
              start_at: getDefaultStartTime(),
              end_at: getDefaultEndTime(getDefaultStartTime()),
              category: 'program',
            } as TimePeriodLite
          }
          onSave={(data) => save.mutate(data)}
          isSaving={save.isPending}
        />
      )}

      {/* Edit Dialog */}
      {!isReadOnly && editing && (
        <EditTimePeriodDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open && !save.isPending) {
              setEditing(null)
            }
          }}
          timePeriod={editing}
          onSave={(data) => save.mutate(data)}
          isSaving={save.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {!isReadOnly && deleting && (
        <Dialog.Root
          open={true}
          onOpenChange={(open) => {
            if (!open && !deleteTimePeriod.isPending) {
              setDeleting(null)
            }
          }}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Program Period?</Dialog.Title>
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

  // Reset form when timePeriod changes
  React.useEffect(() => {
    if (open) {
      setTitle(timePeriod.title || '')
      setStartAt(timePeriod.start_at)
      setEndAt(timePeriod.end_at)
      setAutoSetEndTime(!timePeriod.id)
    }
  }, [timePeriod, open])

  const handleSave = () => {
    if (!title.trim()) {
      return
    }
    onSave({
      id: timePeriod.id || undefined,
      title: title.trim(),
      start_at: startAt,
      end_at: endAt,
    })
  }

  const commonSuggestions = [
    'Load In',
    'Rigging',
    'Soundcheck',
    'Doors',
    'Concert',
    'Show',
    'Downrig',
    'Teardown',
    'Load Out',
    'Setup',
    'Break',
    'Rehearsal',
  ]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          {timePeriod.id ? 'Edit Program Period' : 'New Program Period'}
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
                placeholder="e.g. Load In, Rigging, Soundcheck"
                autoFocus
              />
            </label>
            {!timePeriod.id && (
              <Flex gap="2" wrap="wrap" mt="2">
                <Text size="1" color="gray" style={{ width: '100%' }}>
                  Quick suggestions:
                </Text>
                {commonSuggestions.map((suggestion) => (
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

// Utility function to format time (shows time only, not date)
function formatTime(iso: string) {
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
