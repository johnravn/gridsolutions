import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'

type InitialRole = {
  id: string
  title: string | null
  start_at: string | null
  end_at: string | null
  needed_count: number | null
  role_category: string | null
}

export default function EditRoleDialog({
  open,
  onOpenChange,
  jobId,
  initial,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  initial: InitialRole | null
}) {
  const qc = useQueryClient()
  const { error: toastError, success } = useToast()

  const [title, setTitle] = React.useState('')
  const [needed, setNeeded] = React.useState<number>(1)
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)
  const [startAt, setStartAt] = React.useState('')
  const [endAt, setEndAt] = React.useState('')
  const [roleCategory, setRoleCategory] = React.useState('')

  React.useEffect(() => {
    if (!open || !initial) return
    setTitle(initial.title ?? '')
    setNeeded(initial.needed_count ?? 1)
    setNeededDraft(null)
    setStartAt(initial.start_at ?? '')
    setEndAt(initial.end_at ?? '')
    setRoleCategory(initial.role_category ?? '')
  }, [open, initial?.id])

  const save = useMutation({
    mutationFn: async () => {
      if (!initial?.id) throw new Error('Missing role')
      if (!title.trim()) throw new Error('Title required')
      if (!startAt || !endAt) throw new Error('Start and end dates required')

      const payload = {
        title: title.trim(),
        start_at: startAt,
        end_at: endAt,
        needed_count: needed,
        role_category: roleCategory.trim().toLowerCase() || null,
      }

      const { error } = await supabase
        .from('time_periods')
        .update(payload)
        .eq('id', initial.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      success('Role updated', 'Role details saved.')
      onOpenChange(false)
    },
    onError: (e: any) => {
      toastError(
        'Failed to update role',
        e?.hint || e?.message || 'Please try again.',
      )
    },
  })

  const disabled =
    save.isPending || !title.trim() || !startAt || !endAt || !initial?.id

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Edit role</Dialog.Title>
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
                onChange={setStartAt}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <DateTimePicker label="End" value={endAt} onChange={setEndAt} />
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
            {save.isPending ? 'Saving…' : 'Save role'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
