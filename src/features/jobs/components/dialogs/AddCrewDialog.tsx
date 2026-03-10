// src/features/jobs/components/dialogs/AddCrewDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import type { CrewReqStatus, UUID } from '../../types'

export default function AddCrewDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [userId, setUserId] = React.useState<UUID | ''>('')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<CrewReqStatus>('planned')
  const [timePeriodId, setTimePeriodId] = React.useState<string>('')

  // search crew by name/email
  const { data: people = [], isFetching } = useQuery({
    queryKey: ['crew-picker', search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .limit(20)

      // Apply fuzzy search using multiple patterns
      if (search.trim()) {
        const term = search.trim()
        const patterns = [
          `%${term}%`,
          term.length > 2 ? `%${term.split('').join('%')}%` : null,
        ].filter(Boolean) as Array<string>

        const conditions = patterns
          .flatMap((pattern) => [
            `display_name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ])
          .join(',')

        q = q.or(conditions)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  // Load roles (time periods with category = 'crew') for this job
  const { data: roles = [] } = useQuery({
    queryKey: ['jobs', jobId, 'time_periods', 'roles'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'crew')
        .order('start_at', { ascending: true })

      if (error) throw error

      return data as Array<{
        id: string
        title: string | null
        start_at: string | null
        end_at: string | null
      }>
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (roles.length && !timePeriodId) setTimePeriodId(roles[0].id)
  }, [open, roles, timePeriodId])

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Choose a person')
      if (!timePeriodId) throw new Error('Choose a role/time period')
      const { error } = await supabase.from('reserved_crew').insert({
        time_period_id: timePeriodId,
        user_id: userId,
        status,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      onOpenChange(false)
      setUserId('')
      setStatus('planned')
    },
  })

  const disabled = save.isPending || !userId || !timePeriodId

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add crew booking</Dialog.Title>

        <Field label="Person">
          <TextField.Root
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Box
            mt="2"
            p="2"
            style={{
              border: '1px solid var(--gray-a6)',
              borderRadius: 8,
              maxHeight: 220,
              overflow: 'auto',
            }}
          >
            {isFetching && (
              <Text size="2" color="gray">
                Searching…
              </Text>
            )}
            {!isFetching && people.length === 0 && (
              <Text size="2" color="gray">
                No results
              </Text>
            )}
            {!isFetching &&
              people.map((p, idx) => (
                <Box
                  key={p.user_id}
                  p="2"
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    background:
                      userId === p.user_id ? 'var(--blue-a3)' : 'transparent',
                  }}
                  onClick={() => setUserId(p.user_id)}
                >
                  <Flex align="center" justify="between">
                    <div>
                      <Text weight="medium">{p.display_name ?? p.email}</Text>
                      {p.display_name && (
                        <Text size="1" color="gray" style={{ marginLeft: 6 }}>
                          {p.email}
                        </Text>
                      )}
                    </div>
                    {userId === p.user_id && (
                      <Text size="1" color="blue">
                        Selected
                      </Text>
                    )}
                  </Flex>
                  {idx < people.length - 1 && <Separator my="2" />}
                </Box>
              ))}
          </Box>
        </Field>

        <Field label="Role / Time period">
          <Select.Root
            value={timePeriodId}
            onValueChange={(v) => setTimePeriodId(v)}
          >
            <Select.Trigger placeholder="Select role…" />
            <Select.Content style={{ zIndex: 10000 }}>
              {roles.map((tp) => (
                <Select.Item key={tp.id} value={tp.id}>
                  {(tp.title || 'Untitled') +
                    ' — ' +
                    formatWhen(tp.start_at) +
                    ' → ' +
                    formatWhen(tp.end_at)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>

        <Field label="Status">
          <Select.Root
            value={status}
            onValueChange={(v: string) => setStatus(v as CrewReqStatus)}
          >
            <Select.Trigger />
            <Select.Content style={{ zIndex: 10000 }}>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="confirmed">confirmed</Select.Item>
              <Select.Item value="canceled">canceled</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>

        {/* Start/end are defined by the selected role's time period */}

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="solid"
            onClick={() => save.mutate()}
            disabled={disabled}
          >
            {save.isPending ? 'Saving…' : 'Add'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export function EditCrewDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: {
    id: UUID
    status: CrewReqStatus
    start_at: string | null
    end_at: string | null
  }
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState<CrewReqStatus>(row.status)
  // Times now come from the role (time period)

  React.useEffect(() => {
    if (!open) return
    setStatus(row.status)
    // no-op for start/end
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reserved_crew')
        .update({
          status,
          // start/end removed; defined by time_period
        })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit crew booking</Dialog.Title>
        <Field label="Status">
          <Select.Root
            value={status}
            onValueChange={(v: string) => setStatus(v as CrewReqStatus)}
          >
            <Select.Trigger />
            <Select.Content style={{ zIndex: 10000 }}>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="confirmed">confirmed</Select.Item>
              <Select.Item value="canceled">canceled</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>
        {/* Start/end are defined by the role's time period */}
        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="solid"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: 'var(--gray-11)', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function formatWhen(iso?: string | null) {
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}
