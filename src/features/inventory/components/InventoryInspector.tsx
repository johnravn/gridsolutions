// src/features/inventory/components/InventoryInspector.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Separator,
  Spinner,
  Table,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { Edit, Trash } from 'iconoir-react'
import { toEventInputs } from '@features/calendar/components/domain'
import InspectorCalendar from '@features/calendar/components/InspectorCalendar'
import { itemCalendarQuery } from '@features/calendar/api/queries'
import { inventoryDetailQuery } from '../api/queries'

// ⬇️ We'll pass edit props to these (next step we'll add mode/initialData in those files)
import AddItemDialog from './AddItemDialog'
import AddGroupDialog from './AddGroupDialog'

export default function InventoryInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()
  const { info, error: toastError } = useToast()
  const [editOpen, setEditOpen] = React.useState(false)

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const qc = useQueryClient()

  const fmtCurrency = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !id) throw new Error('Missing company or id')
      const table = entry.type === 'item' ? 'items' : 'item_groups'
      const { error } = await supabase
        .from(table)
        .update({ deleted: true })
        .eq('company_id', companyId)
        .eq('id', id)
      if (error) throw error

      // Log activity
      try {
        const { logActivity } = await import('@features/latest/api/queries')
        await logActivity({
          companyId,
          activityType:
            entry.type === 'item'
              ? 'inventory_item_deleted'
              : 'inventory_group_deleted',
          metadata: {
            [entry.type === 'item' ? 'item_id' : 'group_id']: id,
            [entry.type === 'item' ? 'item_name' : 'group_name']: entry.name,
          },
          title: entry.name,
        })
      } catch (logErr) {
        console.error('Failed to log activity:', logErr)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-detail'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      info('Deleted', 'The entry has been deleted.')
      setDeleteOpen(false)
    },
    onError: (e: any) => {
      toastError('Failed to delete', e?.message ?? 'Please try again.')
    },
  })

  const enabled = Boolean(companyId && id)

  const { data, isLoading, isError, error } = useQuery({
    ...inventoryDetailQuery({
      companyId: companyId ?? '',
      id: id ?? '',
    }),
    enabled,
  })

  // Fetch calendar events for this item (only if it's an item, not a group)
  const isItem = data?.type === 'item'
  const { data: calendarRecords = [] } = useQuery({
    ...itemCalendarQuery({
      companyId: companyId ?? '',
      itemId: id ?? '',
    }),
    enabled: enabled && !!id && isItem,
  })

  const events = React.useMemo(
    () => toEventInputs(calendarRecords),
    [calendarRecords],
  )

  if (!id)
    return <Text color="gray">Select an item/bundle to view details.</Text>

  if (!enabled) return <Text color="gray">Preparing…</Text>

  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )

  // We treat "not found" as a valid (null) result in the query; real errors render here.
  if (isError) {
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  }

  if (!data) return <Text color="red">Not found.</Text>

  const entry = data
  const fmtDate = (iso?: string | null) =>
    iso
      ? (() => {
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
        })()
      : '—'

  // Build initialData we’ll feed into the dialogs in edit mode
  const initialItemData =
    entry.type === 'item'
      ? {
          id: entry.id,
          name: entry.name,
          categoryName: entry.category_name ?? null,
          brandName: entry.brand_name ?? null,
          model: entry.model ?? '',
          allow_individual_booking: entry.allow_individual_booking,
          active: entry.active,
          notes: entry.notes ?? '',
          nicknames: entry.nicknames ?? '',
          price: entry.current_price,
          total_quantity: entry.on_hand ?? 0,
          internally_owned: entry.internally_owned,
          external_owner_id: entry.external_owner_id,
        }
      : undefined

  const initialGroupData =
    entry.type === 'group'
      ? {
          id: entry.id,
          name: entry.name,
          categoryName: entry.category_name ?? null,
          description: entry.description ?? '',
          active: entry.active,
          price: entry.current_price,
          parts: entry.parts.map((p) => ({
            item_id: p.item_id,
            item_name: p.item_name,
            quantity: p.quantity,
            item_current_price: p.item_current_price,
          })),
          price_history: entry.price_history,
          internally_owned: entry.internally_owned,
          external_owner_id: entry.external_owner_id,
        }
      : undefined

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {entry.name}
          </Text>
          <Text as="div" color="gray" size="2">
            {entry.type}
            {entry.type === 'item' && entry.category_name
              ? ` · ${entry.category_name.toUpperCase()}`
              : ''}
            {entry.type === 'item' && entry.brand_name
              ? ` · ${entry.brand_name}`
              : ''}
            {entry.type === 'group' && entry.category_name
              ? ` · ${entry.category_name.toUpperCase()}`
              : ''}
          </Text>
        </div>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
            <Edit />
          </Button>

          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* ITEM DETAILS */}
      {entry.type === 'item' ? (
        <Flex direction="column" gap="3">
          {/* Quick stats */}
          <Grid columns={{ initial: '1', sm: '3' }} gap="3">
            <Stat label="On hand" value={<b>{entry.on_hand ?? 0}</b>} />
            <Stat
              label="Current price"
              value={
                entry.current_price != null ? (
                  <b>{fmtCurrency.format(Number(entry.current_price))}</b>
                ) : (
                  <Text color="gray">—</Text>
                )
              }
            />
            <Stat
              label="Booking"
              value={
                <Badge
                  color={entry.allow_individual_booking ? 'green' : 'gray'}
                  variant="soft"
                >
                  {entry.allow_individual_booking
                    ? 'Individual allowed'
                    : 'Group-only'}
                </Badge>
              }
            />
          </Grid>

          {/* Meta */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            <Field
              label="Category"
              value={
                entry.category_name ? entry.category_name.toUpperCase() : '—'
              }
            />
            <Field label="Brand" value={entry.brand_name ?? '—'} />
            <Field
              label="Owner"
              value={
                entry.internally_owned ? (
                  <Badge size="1" variant="soft" color="indigo">
                    Internal
                  </Badge>
                ) : (
                  <Badge size="1" variant="soft" color="amber">
                    {entry.external_owner_name ?? 'External'}
                  </Badge>
                )
              }
            />
            <Field
              label="Status"
              value={
                <Badge color={entry.active ? 'green' : 'red'} variant="soft">
                  {entry.active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
            <Field label="Model" value={entry.model ?? '—'} />
          </Grid>

          {/* Notes */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Notes
            </Text>
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              <Text size="2" color={entry.notes ? undefined : 'gray'}>
                {entry.notes || 'No notes'}
              </Text>
            </Box>
          </div>

          {/* Nicknames */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Nicknames
            </Text>
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              <Text size="2" color={entry.nicknames ? undefined : 'gray'}>
                {entry.nicknames || 'No nicknames'}
              </Text>
            </Box>
          </div>

          {/* Price history */}
          <div>
            <Flex align="baseline" justify="between" mb="2">
              <Text size="2" color="gray">
                Price history
              </Text>
              <Text size="1" color="gray">
                Most recent first
              </Text>
            </Flex>

            {entry.price_history.length === 0 ? (
              <Text size="2" color="gray">
                No price records yet.
              </Text>
            ) : (
              <Box
                style={{
                  maxHeight: 196, // ~3 rows + header (tweak if you use a different table size)
                  overflowY: 'auto',
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                }}
              >
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Edited</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Set by</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {entry.price_history.map((p) => (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          {fmtCurrency.format(Number(p.amount))}
                        </Table.Cell>
                        <Table.Cell>
                          <Code>{fmtDate(p.effective_from)}</Code>
                        </Table.Cell>
                        <Table.Cell>
                          {p.set_by_name || p.set_by || '—'}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </div>

          {/* Calendar */}
          <InspectorCalendar
            events={events}
            calendarHref={`/calendar?itemId=${id}`}
            onCreate={(e) => {}}
            onUpdate={(id, patch) => {}}
            onDelete={(id) => {}}
          />
        </Flex>
      ) : null}

      {/* GROUP DETAILS */}
      {entry.type === 'group' ? (
        <Flex direction="column" gap="3">
          {/* Quick stats */}
          <Grid columns={{ initial: '1', sm: '3' }} gap="3">
            <Stat label="On hand" value={<b>{entry.on_hand ?? 0}</b>} />
            <Stat
              label="Current price"
              value={
                entry.current_price != null ? (
                  <b>{fmtCurrency.format(Number(entry.current_price))}</b>
                ) : (
                  <Text color="gray">—</Text>
                )
              }
            />
            <div />
          </Grid>

          {/* Meta */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            <Field
              label="Category"
              value={
                entry.category_name ? entry.category_name.toUpperCase() : '—'
              }
            />
            <Field
              label="Owner"
              value={
                entry.internally_owned ? (
                  <Badge size="1" variant="soft" color="indigo">
                    Internal
                  </Badge>
                ) : (
                  <Badge size="1" variant="soft" color="amber">
                    {entry.external_owner_name ?? 'External'}
                  </Badge>
                )
              }
            />
            <Field
              label="Status"
              value={
                <Badge color={entry.active ? 'green' : 'red'} variant="soft">
                  {entry.active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
          </Grid>

          {/* Description */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Description
            </Text>
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              <Text size="2" color={entry.description ? undefined : 'gray'}>
                {entry.description || 'No description'}
              </Text>
            </Box>
          </div>

          {/* Parts */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Bundle contents
            </Text>

            {entry.parts.length ? (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Unit</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {entry.parts.map((p) => {
                    const unit = p.item_current_price ?? null
                    const total =
                      unit != null ? Number(unit) * Number(p.quantity) : null
                    return (
                      <Table.Row key={p.item_id}>
                        <Table.Cell>{p.item_name}</Table.Cell>
                        <Table.Cell>{p.quantity}</Table.Cell>
                        <Table.Cell>
                          {unit != null
                            ? fmtCurrency.format(Number(unit))
                            : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          {total != null ? fmtCurrency.format(total) : '—'}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell style={{ fontWeight: 600 }}>
                      Parts total
                    </Table.Cell>
                    <Table.Cell style={{ fontWeight: 600 }}>
                      {fmtCurrency.format(
                        entry.parts.reduce((sum, p) => {
                          const up = Number(p.item_current_price ?? 0)
                          return sum + up * p.quantity
                        }, 0),
                      )}
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            ) : (
              <Text size="2" color="gray">
                No parts
              </Text>
            )}
          </div>

          {/* Group price history */}
          <div>
            <Flex align="baseline" justify="between" mb="2">
              <Text size="2" color="gray">
                Price history
              </Text>
              <Text size="1" color="gray">
                Most recent first
              </Text>
            </Flex>

            {entry.price_history.length ? (
              <Box
                style={{
                  maxHeight: 196, // ~3 rows + header (tweak if you use a different table size)
                  overflowY: 'auto',
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                }}
              >
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Edited</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Set by</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {entry.price_history.map((p) => (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          {fmtCurrency.format(Number(p.amount))}
                        </Table.Cell>
                        <Table.Cell>
                          <Code>{fmtDate(p.effective_from)}</Code>
                        </Table.Cell>
                        <Table.Cell>
                          {p.set_by_name || p.set_by || '—'}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            ) : (
              <Text size="2" color="gray">
                No price records yet.
              </Text>
            )}
          </div>
        </Flex>
      ) : null}

      {/* --- Edit dialogs (shown when clicking Edit) --- */}
      {entry.type === 'item' && (
        <AddItemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          companyId={companyId ?? ''}
          mode="edit"
          initialData={initialItemData}
          onSaved={() => setEditOpen(false)}
        />
      )}

      {entry.type === 'group' && (
        <AddGroupDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          companyId={companyId ?? ''}
          mode="edit"
          initialData={initialGroupData}
          onSaved={() => setEditOpen(false)}
        />
      )}

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete {entry.type}?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will mark the {entry.type} <b>{entry.name}</b> as deleted. It
            won’t be removed permanently, but it will no longer show in the
            list.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  )
}

/* ---------- small presentational helpers ---------- */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box
      p="2"
      style={{
        border: '1px solid var(--gray-a6)',
        borderRadius: 8,
      }}
    >
      <Text as="div" size="1" color="gray" style={{ marginBottom: 2 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </Box>
  )
}
