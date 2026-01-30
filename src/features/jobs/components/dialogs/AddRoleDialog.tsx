import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { addThreeHours } from '@shared/lib/generalFunctions'
import DateTimePicker from '@shared/ui/components/DateTimePicker'

export default function AddRoleDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
}) {
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [needed, setNeeded] = React.useState<number>(1)
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)
  const [startAt, setStartAt] = React.useState('')
  const [endAt, setEndAt] = React.useState('')
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(true)
  const [roleCategory, setRoleCategory] = React.useState('')

  // Fetch company_id from job
  const { data: job } = useQuery({
    queryKey: ['jobs-detail-lite', jobId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, company_id, start_at, end_at')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data as {
        id: string
        company_id: string
        start_at: string | null
        end_at: string | null
      }
    },
  })

  // Set default dates when job loads
  React.useEffect(() => {
    if (!open || !job) return
    if (!startAt && job.start_at) {
      setStartAt(job.start_at)
      setAutoSetEndTime(true)
    }
    if (!endAt && job.end_at) {
      setEndAt(job.end_at)
      setAutoSetEndTime(false)
    }
  }, [open, job, startAt, endAt])

  // Auto-set end time when start time changes
  React.useEffect(() => {
    if (!startAt || !autoSetEndTime) return
    setEndAt(addThreeHours(startAt))
  }, [startAt, autoSetEndTime])

  const titleSuggestions = [
    'Technician',
    'Loader',
    'FOH',
    'Monitors',
    'Hands',
    'Driver',
  ]

  const categorySuggestions = ['Audio', 'Lights', 'AV', 'Transport', 'Rigging']

  const save = useMutation({
    mutationFn: async () => {
      if (!job?.company_id) throw new Error('Missing company')
      if (!title.trim()) throw new Error('Title required')
      if (!startAt || !endAt) throw new Error('Start and end dates required')

      const payload: any = {
        job_id: jobId,
        company_id: job.company_id,
        title: title.trim(),
        start_at: startAt,
        end_at: endAt,
        needed_count: needed,
        category: 'crew',
        role_category: roleCategory.trim().toLowerCase() || null,
      }

      const { error } = await supabase.from('time_periods').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      onOpenChange(false)
      setTitle('')
      setNeeded(1)
      setNeededDraft(null)
      setStartAt('')
      setEndAt('')
      setRoleCategory('')
    },
  })

  const disabled = save.isPending || !title.trim() || !startAt || !endAt

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Add role</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Box>
            <Text size="2" color="gray" mb="1">
              Title
            </Text>
            <TextField.Root
              placeholder="e.g. FOH, Monitor, Loader"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Flex gap="2" wrap="wrap" mt="2">
              <Text size="1" color="gray" style={{ width: '100%' }}>
                Quick suggestions:
              </Text>
              {titleSuggestions.map((suggestion) => (
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
          </Box>
          <Box>
            <Text size="2" color="gray" mb="1">
              Needed
            </Text>
            <TextField.Root
              type="number"
              min="1"
              value={neededDraft ?? String(needed)}
              onChange={(e) => {
                const nextValue = e.target.value
                setNeededDraft(nextValue)

                if (nextValue === '') return
                const parsed = Number(nextValue)
                if (Number.isNaN(parsed)) return

                setNeeded(Math.max(1, parsed))
                setNeededDraft(null)
              }}
              onBlur={() => {
                if (neededDraft === '') {
                  setNeededDraft(null)
                }
              }}
              style={{ width: 120 }}
            />
          </Box>
          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="Start"
                value={startAt}
                onChange={(value) => {
                  setStartAt(value)
                  setAutoSetEndTime(true)
                }}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="End"
                value={endAt}
                onChange={(value) => {
                  setEndAt(value)
                  setAutoSetEndTime(false)
                }}
              />
            </Box>
          </Flex>
          <Box>
            <Text size="2" color="gray" mb="1">
              Role Category
            </Text>
            <TextField.Root
              placeholder="e.g. Audio, Lights, AV"
              value={roleCategory}
              onChange={(e) => setRoleCategory(e.target.value)}
            />
            <Flex gap="2" wrap="wrap" mt="2">
              <Text size="1" color="gray" style={{ width: '100%' }}>
                Quick suggestions:
              </Text>
              {categorySuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={() => setRoleCategory(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </Flex>
          </Box>
        </Flex>
        <Flex justify="end" gap="2" mt="4">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={disabled}
          >
            {save.isPending ? 'Saving…' : 'Add role'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
