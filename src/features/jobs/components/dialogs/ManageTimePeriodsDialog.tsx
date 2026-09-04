import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Separator,
  Table,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { EditPencil, Plus, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  DateTimeRangePicker,
  isInvalidTimeRange,
} from '@shared/ui/components/pickers'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  DEFAULT_EQUIPMENT_PERIOD_TITLE,
  ensureDefaultEquipmentPeriod,
  jobDetailQuery,
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import type { TimePeriodLite } from '@features/jobs/types'

export type BookingTimePeriodCategory = 'equipment' | 'crew' | 'transport'

/** Stable default — never inline `['equipment', …]` in props/deps (new array each render). */
const DEFAULT_BOOKING_PERIOD_CATEGORIES: Array<BookingTimePeriodCategory> = [
  'equipment',
  'crew',
  'transport',
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  /** Which category tab to open on. */
  initialCategory?: BookingTimePeriodCategory
  /** Restrict visible tabs (default: all booking categories). */
  categories?: Array<BookingTimePeriodCategory>
  readOnly?: boolean
}

const CATEGORY_LABELS: Record<BookingTimePeriodCategory, string> = {
  equipment: 'Equipment',
  crew: 'Crew',
  transport: 'Transport',
}

function formatPeriodRange(startAt: string, endAt: string): string {
  try {
    const start = new Date(startAt)
    const end = new Date(endAt)
    const opts: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
    return `${start.toLocaleString(undefined, opts)} – ${end.toLocaleString(undefined, opts)}`
  } catch {
    return `${startAt} – ${endAt}`
  }
}

export default function ManageTimePeriodsDialog({
  open,
  onOpenChange,
  jobId,
  initialCategory = 'equipment',
  categories = DEFAULT_BOOKING_PERIOD_CATEGORIES,
  readOnly = false,
}: Props) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [activeCategory, setActiveCategory] =
    React.useState<BookingTimePeriodCategory>(initialCategory)
  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<TimePeriodLite | null>(null)
  const wasOpenRef = React.useRef(false)

  const { data: timePeriods = [] } = useQuery({
    ...jobTimePeriodsQuery({ jobId }),
    enabled: open && !!jobId,
  })
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open && !!jobId,
  })

  // Only reset UI state when the dialog *opens* — not on every parent re-render.
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveCategory(
        categories.includes(initialCategory)
          ? initialCategory
          : (categories[0] ?? 'equipment'),
      )
      setEditing(null)
      setCreating(false)
      setDeleting(null)
    }
    wasOpenRef.current = open
  }, [open, initialCategory, categories])

  const filtered = React.useMemo(
    () => timePeriods.filter((tp) => tp.category === activeCategory),
    [timePeriods, activeCategory],
  )

  const canAddPeriod =
    !readOnly && (activeCategory !== 'equipment' || filtered.length === 0)

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] }),
      qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] }),
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] }),
      qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] }),
      qc.invalidateQueries({ queryKey: ['jobs', jobId] }),
    ])
  }

  const save = useMutation({
    mutationFn: async (p: {
      id?: string
      title: string
      start_at: string
      end_at: string
      needed_count?: number | null
      role_category?: string | null
    }) => {
      if (!companyId) throw new Error('No companyId')
      if (
        !p.id &&
        activeCategory === 'equipment' &&
        timePeriods.some((tp) => tp.category === 'equipment')
      ) {
        throw new Error(
          'This job already has an equipment period. Edit the existing one instead.',
        )
      }
      return upsertTimePeriod({
        id: p.id,
        job_id: jobId,
        company_id: companyId,
        title: p.title,
        start_at: p.start_at,
        end_at: p.end_at,
        category: p.id ? undefined : activeCategory,
        needed_count: p.needed_count,
        role_category: p.role_category,
      })
    },
    onSuccess: async () => {
      setEditing(null)
      setCreating(false)
      success('Saved', 'Time period saved')
      await invalidate()
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Please try again.'
      error('Failed to save', msg)
    },
  })

  const deletePeriod = useMutation({
    mutationFn: async (period: TimePeriodLite) => {
      if (!companyId) throw new Error('No companyId')

      await Promise.all([
        supabase
          .from('offer_equipment_items')
          .update({ time_period_id: null })
          .eq('time_period_id', period.id),
        supabase
          .from('offer_crew_items')
          .update({ time_period_id: null })
          .eq('time_period_id', period.id),
        supabase
          .from('offer_transport_items')
          .update({ time_period_id: null })
          .eq('time_period_id', period.id),
      ])

      let fallbackId: string | null = null
      if (period.category === 'equipment') {
        const start =
          job?.start_at || period.start_at || new Date().toISOString()
        const end = job?.end_at || period.end_at || start
        fallbackId = await ensureDefaultEquipmentPeriod({
          jobId,
          companyId,
          startAt: start,
          endAt: end,
        })
        if (fallbackId === period.id) {
          const other = timePeriods.find(
            (tp) =>
              tp.category === 'equipment' &&
              tp.id !== period.id &&
              tp.title === DEFAULT_EQUIPMENT_PERIOD_TITLE,
          )
          fallbackId =
            other?.id ??
            timePeriods.find(
              (tp) => tp.category === 'equipment' && tp.id !== period.id,
            )?.id ??
            null
        }
      } else {
        fallbackId =
          timePeriods.find(
            (tp) => tp.category === period.category && tp.id !== period.id,
          )?.id ?? null
      }

      if (fallbackId && fallbackId !== period.id) {
        await Promise.all([
          supabase
            .from('reserved_items')
            .update({ time_period_id: fallbackId })
            .eq('time_period_id', period.id),
          supabase
            .from('reserved_crew')
            .update({ time_period_id: fallbackId })
            .eq('time_period_id', period.id),
          supabase
            .from('reserved_vehicles')
            .update({ time_period_id: fallbackId })
            .eq('time_period_id', period.id),
        ])
      } else {
        await Promise.all([
          supabase
            .from('reserved_items')
            .delete()
            .eq('time_period_id', period.id),
          supabase
            .from('reserved_crew')
            .delete()
            .eq('time_period_id', period.id),
          supabase
            .from('reserved_vehicles')
            .delete()
            .eq('time_period_id', period.id),
        ])
      }

      const { error: delErr } = await supabase
        .from('time_periods')
        .delete()
        .eq('id', period.id)
      if (delErr) throw delErr
    },
    onSuccess: async () => {
      setDeleting(null)
      success('Deleted', 'Time period deleted')
      await invalidate()
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Please try again.'
      error('Failed to delete', msg)
    },
  })

  const blankPeriod = (): TimePeriodLite => ({
    id: '',
    job_id: jobId,
    company_id: companyId || '',
    title:
      activeCategory === 'equipment'
        ? DEFAULT_EQUIPMENT_PERIOD_TITLE
        : activeCategory === 'crew'
          ? ''
          : 'Transport',
    start_at: job?.start_at || new Date().toISOString(),
    end_at: job?.end_at || new Date().toISOString(),
    category: activeCategory,
    needed_count: activeCategory === 'crew' ? 1 : null,
    role_category: null,
  })

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content
          maxWidth="720px"
          className="manage-time-periods-dialog"
          data-manage-time-periods-dialog=""
        >
          <Dialog.Title>Manage time periods</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            Booking windows for this job. Equipment uses a single period; crew
            and transport can have multiple.
          </Dialog.Description>

          <Tabs.Root
            value={activeCategory}
            onValueChange={(v) =>
              setActiveCategory(v as BookingTimePeriodCategory)
            }
          >
            <Tabs.List>
              {categories.map((cat) => (
                <Tabs.Trigger key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <Flex justify="between" align="center" my="3">
            <Heading size="3">
              {CATEGORY_LABELS[activeCategory]} periods
            </Heading>
            {canAddPeriod && (
              <Button
                size="2"
                onClick={() => {
                  setCreating(true)
                  setEditing(blankPeriod())
                }}
              >
                <Plus width={16} height={16} /> Add period
              </Button>
            )}
          </Flex>

          {activeCategory === 'equipment' && filtered.length > 0 && (
            <Text size="1" color="gray" mb="2" as="div">
              All equipment bookings use this one period. Change its dates to
              move the booking window; rental pricing on offers uses the Days
              field on the offer basis.
            </Text>
          )}

          <Box style={{ overflowX: 'auto' }}>
            <Table.Root variant="surface" size="2">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>When</Table.ColumnHeaderCell>
                  {activeCategory === 'crew' && (
                    <Table.ColumnHeaderCell>Needed</Table.ColumnHeaderCell>
                  )}
                  {!readOnly && <Table.ColumnHeaderCell width="80px" />}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={activeCategory === 'crew' ? 4 : 3}>
                      <Text size="2" color="gray">
                        No {CATEGORY_LABELS[activeCategory].toLowerCase()}{' '}
                        periods yet.
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filtered.map((tp) => (
                    <Table.Row key={tp.id}>
                      <Table.Cell>
                        <Text weight="medium">{tp.title || 'Untitled'}</Text>
                        {activeCategory === 'crew' && tp.role_category ? (
                          <Text size="1" color="gray" as="div">
                            {tp.role_category}
                          </Text>
                        ) : null}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">
                          {formatPeriodRange(tp.start_at, tp.end_at)}
                        </Text>
                      </Table.Cell>
                      {activeCategory === 'crew' && (
                        <Table.Cell>{tp.needed_count ?? '—'}</Table.Cell>
                      )}
                      {!readOnly && (
                        <Table.Cell>
                          <Flex gap="1">
                            <IconButton
                              size="1"
                              variant="ghost"
                              onClick={() => {
                                setCreating(false)
                                setEditing(tp)
                              }}
                            >
                              <EditPencil width={14} height={14} />
                            </IconButton>
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="red"
                              onClick={() => setDeleting(tp)}
                            >
                              <Trash width={14} height={14} />
                            </IconButton>
                          </Flex>
                        </Table.Cell>
                      )}
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>

          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {editing && (
        <EditPeriodDialog
          open={!!editing}
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null)
              setCreating(false)
            }
          }}
          period={editing}
          isNew={creating || !editing.id}
          category={activeCategory}
          isSaving={save.isPending}
          onSave={(data) => save.mutate(data)}
        />
      )}

      <AlertDialog.Root
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
      >
        <AlertDialog.Content
          maxWidth="420px"
          className="manage-time-periods-dialog"
          data-manage-time-periods-dialog=""
        >
          <AlertDialog.Title>Delete time period?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Bookings on “{deleting?.title || 'Untitled'}” will be moved to
            another period when possible, or removed. Offer basis lines linked
            to this period will be unassigned.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                loading={deletePeriod.isPending}
                onClick={() => {
                  if (deleting) deletePeriod.mutate(deleting)
                }}
              >
                Delete
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}

function EditPeriodDialog({
  open,
  onOpenChange,
  period,
  isNew,
  category,
  isSaving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: TimePeriodLite
  isNew: boolean
  category: BookingTimePeriodCategory
  isSaving: boolean
  onSave: (data: {
    id?: string
    title: string
    start_at: string
    end_at: string
    needed_count?: number | null
    role_category?: string | null
  }) => void
}) {
  const [title, setTitle] = React.useState(period.title || '')
  const [startAt, setStartAt] = React.useState(period.start_at)
  const [endAt, setEndAt] = React.useState(period.end_at)
  const [neededCount, setNeededCount] = React.useState(
    String(period.needed_count ?? 1),
  )
  const [roleCategory, setRoleCategory] = React.useState(
    period.role_category || '',
  )

  React.useEffect(() => {
    if (open) {
      setTitle(period.title || '')
      setStartAt(period.start_at)
      setEndAt(period.end_at)
      setNeededCount(String(period.needed_count ?? 1))
      setRoleCategory(period.role_category || '')
    }
  }, [open, period])

  const invalid = isInvalidTimeRange(startAt, endAt)
  const titleOk = title.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="520px"
        className="manage-time-periods-dialog"
        data-manage-time-periods-dialog=""
      >
        <Dialog.Title>
          {isNew
            ? `New ${CATEGORY_LABELS[category].toLowerCase()} period`
            : 'Edit time period'}
        </Dialog.Title>
        <Separator my="3" />
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Title
            </Text>
            <TextField.Root
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                category === 'crew'
                  ? 'e.g. Technician'
                  : category === 'equipment'
                    ? DEFAULT_EQUIPMENT_PERIOD_TITLE
                    : 'e.g. Load in'
              }
            />
          </Box>

          {category === 'crew' && (
            <>
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  People needed
                </Text>
                <TextField.Root
                  type="number"
                  min={1}
                  value={neededCount}
                  onChange={(e) => setNeededCount(e.target.value)}
                />
              </Box>
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Role category
                </Text>
                <TextField.Root
                  value={roleCategory}
                  onChange={(e) => setRoleCategory(e.target.value)}
                  placeholder="e.g. Audio"
                />
              </Box>
            </>
          )}

          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Time range
            </Text>
            <DateTimeRangePicker
              startAt={startAt}
              endAt={endAt}
              onChange={({ startAt: s, endAt: e }) => {
                setStartAt(s)
                setEndAt(e)
              }}
            />
            {invalid && (
              <Text size="1" color="red" mt="1">
                End must be after start.
              </Text>
            )}
          </Box>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            disabled={!titleOk || invalid || isSaving}
            loading={isSaving}
            onClick={() =>
              onSave({
                id: isNew ? undefined : period.id || undefined,
                title: title.trim(),
                start_at: startAt,
                end_at: endAt,
                needed_count:
                  category === 'crew'
                    ? Math.max(1, Number(neededCount) || 1)
                    : null,
                role_category:
                  category === 'crew' ? roleCategory.trim() || null : null,
              })
            }
          >
            Save
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

/** Compact button that opens ManageTimePeriodsDialog. */
export function ManageTimePeriodsButton({
  jobId,
  initialCategory = 'equipment',
  categories,
  readOnly = false,
  size = '2',
  variant = 'soft',
}: {
  jobId: string
  initialCategory?: BookingTimePeriodCategory
  categories?: Array<BookingTimePeriodCategory>
  readOnly?: boolean
  size?: '1' | '2' | '3'
  variant?: 'soft' | 'solid' | 'outline' | 'ghost'
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        Manage periods
      </Button>
      <ManageTimePeriodsDialog
        open={open}
        onOpenChange={setOpen}
        jobId={jobId}
        initialCategory={initialCategory}
        categories={categories}
        readOnly={readOnly}
      />
    </>
  )
}
