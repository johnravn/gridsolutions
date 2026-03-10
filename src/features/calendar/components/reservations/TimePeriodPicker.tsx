import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Flex, Select, TextField } from '@radix-ui/themes'
import { Calendar, Edit, Plus } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import type { TimePeriodLite } from '@features/jobs/types'

type Props = {
  jobId: string
  value: string | null
  onChange: (timePeriodId: string | null) => void
  categoryFilter?: 'program' | 'equipment' | 'crew' | 'transport'
  defaultCategory?: 'program' | 'equipment' | 'crew' | 'transport'
}

export default function TimePeriodPicker({
  jobId,
  value,
  onChange,
  categoryFilter,
  defaultCategory,
}: Props) {
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: allTimePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  // Filter time periods by category if categoryFilter is provided
  const timePeriods = React.useMemo(() => {
    if (!categoryFilter) return allTimePeriods
    return allTimePeriods.filter((tp) => tp.category === categoryFilter)
  }, [allTimePeriods, categoryFilter])

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)

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
        category: p.id ? undefined : defaultCategory, // Only set category when creating new
      })
      return id
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      onChange(id)
      setEditing(null)
      success('Success', 'Time period saved successfully')
    },
    onError: (e: any) => {
      error('Failed to update', e?.hint || e?.message || 'Please try again.')
    },
  })

  return (
    <Box
      mb="3"
      p="2"
      height="100%"
      style={{ border: '1px dashed var(--gray-a6)', borderRadius: 10 }}
    >
      <Flex direction={'column'} align="start" gap="2">
        <Flex align="center" gap="2">
          <Calendar />
          <strong>Time period</strong>
        </Flex>
        <Flex
          align="center"
          justify="between"
          gap="2"
          wrap="wrap"
          width={'100%'}
        >
          <Flex align="center" gap="2">
            <Select.Root
              value={value ?? ''}
              onValueChange={(v) => onChange(v || null)}
            >
              <Select.Trigger placeholder="Select time period…" />
              <Select.Content style={{ zIndex: 10001 }}>
                {timePeriods.map((r) => (
                  <Select.Item key={r.id} value={r.id}>
                    {r.title || '(untitled)'} — {fmt(r.start_at)} →{' '}
                    {fmt(r.end_at)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {value && (
              <Button
                size="1"
                variant="soft"
                onClick={() => {
                  const r = timePeriods.find((x) => x.id === value) || null
                  setEditing(r)
                }}
              >
                <Edit width={14} height={14} /> Edit
              </Button>
            )}
          </Flex>
          <Button
            size="1"
            onClick={() =>
              setEditing({
                id: '' as any,
                job_id: jobId,
                company_id: companyId!,
                title:
                  defaultCategory === 'equipment'
                    ? 'Equipment period'
                    : defaultCategory === 'crew'
                      ? 'Crew period'
                      : defaultCategory === 'transport'
                        ? 'Transport period'
                        : '',
                start_at: isoLocalStart(), // see util below
                end_at: isoLocalEnd(),
              } as TimePeriodLite)
            }
          >
            <Plus width={14} height={14} /> New time period
          </Button>
        </Flex>
      </Flex>

      {/* inline editor (minimal) */}
      {editing && (
        <Box
          mt="2"
          p="2"
          style={{ background: 'var(--gray-2)', borderRadius: 8 }}
        >
          <Flex gap="2" wrap="wrap" align="center">
            <TextField.Root
              placeholder="Title"
              value={editing.title ?? ''}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
            <DateTimePicker
              value={editing.start_at}
              onChange={(iso) => setEditing({ ...editing, start_at: iso })}
            />
            <DateTimePicker
              value={editing.end_at}
              onChange={(iso) => setEditing({ ...editing, end_at: iso })}
            />
            <Flex gap="2" ml="auto">
              <Button size="1" variant="soft" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                size="1"
                variant="solid"
                onClick={() =>
                  save.mutate({
                    id: editing.id || undefined,
                    title: editing.title ?? '',
                    start_at: editing.start_at,
                    end_at: editing.end_at,
                  })
                }
              >
                Save
              </Button>
            </Flex>
          </Flex>
        </Box>
      )}
    </Box>
  )
}

function fmt(iso: string) {
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ` ${hours}:${minutes}`
  )
}

function isoLocalStart() {
  return new Date().toISOString()
}
function isoLocalEnd() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
}

/* =============== Fixed Time Period Editor (No Switching) =============== */
type FixedTimePeriodEditorProps = {
  jobId: string
  timePeriodId: string
  readOnly?: boolean
}

export function FixedTimePeriodEditor({
  jobId,
  timePeriodId,
  readOnly = false,
}: FixedTimePeriodEditorProps) {
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  const [editing, setEditing] = React.useState(false)
  const [editData, setEditData] = React.useState<{
    start_at: string
    end_at: string
  } | null>(null)

  const timePeriod = timePeriods.find((tp) => tp.id === timePeriodId)

  // Initialize edit data when editing starts
  React.useEffect(() => {
    if (editing && timePeriod && !editData) {
      setEditData({
        start_at: timePeriod.start_at,
        end_at: timePeriod.end_at,
      })
    }
  }, [editing, timePeriod, editData])

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId || !editData || !timePeriod)
        throw new Error('Missing data')
      await upsertTimePeriod({
        id: timePeriodId,
        job_id: jobId,
        company_id: companyId,
        title: timePeriod.title ?? '', // Keep existing title
        start_at: editData.start_at,
        end_at: editData.end_at,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      setEditing(false)
      setEditData(null)
      success('Success', 'Time period updated successfully')
    },
    onError: (e: any) => {
      error('Failed to update', e?.hint || e?.message || 'Please try again.')
    },
  })

  if (!timePeriod) {
    return (
      <Box
        p="2"
        style={{
          border: '1px dashed var(--red-a6)',
          borderRadius: 8,
          background: 'var(--red-a2)',
        }}
      >
        <Flex align="center" gap="2">
          <Calendar />
          <strong style={{ color: 'var(--red-11)' }}>
            Time period not found
          </strong>
        </Flex>
      </Box>
    )
  }

  return (
    <Box
      p="2"
      style={{
        border: '1px dashed var(--gray-a6)',
        borderRadius: 8,
        background: editing ? 'var(--blue-a2)' : undefined,
      }}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Calendar />
            <strong>{timePeriod.title || '(untitled)'}</strong>
          </Flex>
          {!readOnly && !editing && (
            <Button size="1" variant="soft" onClick={() => setEditing(true)}>
              <Edit width={14} height={14} /> Edit
            </Button>
          )}
        </Flex>

        {!editing ? (
          <Flex gap="2" wrap="wrap">
            <Box
              p="1"
              px="2"
              style={{
                background: 'var(--gray-a3)',
                borderRadius: 6,
                fontSize: '0.875rem',
              }}
            >
              {fmt(timePeriod.start_at)}
            </Box>
            <span>→</span>
            <Box
              p="1"
              px="2"
              style={{
                background: 'var(--gray-a3)',
                borderRadius: 6,
                fontSize: '0.875rem',
              }}
            >
              {fmt(timePeriod.end_at)}
            </Box>
          </Flex>
        ) : (
          editData && (
            <Box p="2" style={{ background: 'var(--gray-2)', borderRadius: 8 }}>
              <Flex gap="2" wrap="wrap" align="center">
                <DateTimePicker
                  value={editData.start_at}
                  onChange={(iso) =>
                    setEditData({
                      ...editData,
                      start_at: iso,
                    })
                  }
                />
                <DateTimePicker
                  value={editData.end_at}
                  onChange={(iso) =>
                    setEditData({
                      ...editData,
                      end_at: iso,
                    })
                  }
                />
                <Flex gap="2" ml="auto">
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => {
                      setEditing(false)
                      setEditData(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="1"
                    variant="solid"
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                  >
                    {save.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </Flex>
              </Flex>
            </Box>
          )
        )}
      </Flex>
    </Box>
  )
}
