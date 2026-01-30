import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Popover,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import {
  Check,
  Edit,
  Link,
  LinkSlash,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Trash,
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { FixedTimePeriodEditor } from '@features/calendar/components/reservations/TimePeriodPicker'
import { jobDetailQuery, upsertTimePeriod } from '@features/jobs/api/queries'
import { partnerCustomersQuery } from '@features/inventory/api/partners'
import BookItemsDialog from '../dialogs/BookItemsDialog'
import SelectExternalOwnerDialog from '../dialogs/SelectExternalOwnerDialog'
import type {
  BookingStatus,
  ExternalReqStatus,
  ItemLite,
  ReservedItemRow,
} from '../../types'

export default function EquipmentTab({ jobId }: { jobId: string }) {
  const [bookItemsOpen, setBookItemsOpen] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [externalEditMode, setExternalEditMode] = React.useState(false)
  const [view, setView] = React.useState<'internal' | 'external'>('internal')
  const { companyId } = useCompany()
  const { companyRole } = useAuthz()
  const canBook = !!companyId && companyRole !== 'freelancer'

  const handleViewChange = (value: string) => {
    if (value === 'internal' || value === 'external') {
      setView(value)
    }
  }

  const { data } = useQuery({
    queryKey: ['jobs.equipment', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, category')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr
      const resIds = (timePeriods as Array<{ id: string }>).map((r) => r.id)

      // Return time periods too for external equipment sections
      const externalTimePeriods = timePeriods
        .filter((tp) => {
          if (tp.category !== 'equipment' || !tp.title) return false
          const match = tp.title.match(/^(.+?)\s+Equipment period$/)
          if (!match) return false
          const ownerName = match[1].trim()
          return ownerName.toLowerCase() !== 'equipment'
        })
        .map((tp) => ({
          id: tp.id,
          title: tp.title as string,
          start_at: tp.start_at,
          end_at: tp.end_at,
        }))

      if (!resIds.length) {
        return {
          internal: [],
          external: [],
          externalTimePeriods,
        }
      }

      const { data: items, error } = await supabase
        .from('reserved_items')
        .select(
          `
          id, time_period_id, item_id, quantity, source_group_id, source_kind,
          status, external_status, external_note, forced,
          item:item_id (
            id, name, category_id, brand_id, model,
            category:category_id ( name ),
            brand:brand_id ( name ),
            external_owner_id,
            external_owner:external_owner_id ( name )
          ),
          source_group:source_group_id (
            id, name, category_id,
            category:category_id ( name )
          ),
          time_period:time_period_id ( id, title, start_at, end_at )
        `,
        )
        .in('time_period_id', resIds)
      if (error) throw error

      const rows = items as Array<ReservedItemRow & any>
      const internal = rows.filter((x) => !extOwnerId(x.item))
      const external = rows.filter((x) => !!extOwnerId(x.item))
      return {
        internal,
        external,
        externalTimePeriods,
      }
    },
  })

  return (
    <Box>
      {/* INTERNAL VIEW */}
      {view === 'internal' && (
        <InternalEquipmentTable
          rows={data?.internal ?? []}
          jobId={jobId}
          canBook={canBook}
          companyId={companyId ?? undefined}
          bookItemsOpen={bookItemsOpen}
          setBookItemsOpen={setBookItemsOpen}
          editMode={editMode}
          setEditMode={setEditMode}
          view={view}
          onViewChange={handleViewChange}
        />
      )}

      {/* EXTERNAL VIEW */}
      {view === 'external' && (
        <ExternalEquipmentTable
          rows={data?.external ?? []}
          externalTimePeriods={data?.externalTimePeriods ?? []}
          canBook={canBook}
          jobId={jobId}
          companyId={companyId}
          editMode={externalEditMode}
          setEditMode={setExternalEditMode}
          view={view}
          onViewChange={handleViewChange}
        />
      )}
    </Box>
  )
}

/* ------------------- Internal Table ------------------- */
function InternalEquipmentTable({
  rows,
  jobId,
  canBook,
  companyId,
  bookItemsOpen,
  setBookItemsOpen,
  editMode,
  setEditMode,
  view,
  onViewChange,
}: {
  rows: Array<any>
  jobId: string
  canBook: boolean
  companyId: string | undefined
  bookItemsOpen: boolean
  setBookItemsOpen: (v: boolean) => void
  editMode: boolean
  setEditMode: (v: boolean) => void
  view: 'internal' | 'external'
  onViewChange: (v: 'internal' | 'external') => void
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )
  const [editingQty, setEditingQty] = React.useState<{
    id: string
    value: number
  } | null>(null)
  const [editingQtyDrafts, setEditingQtyDrafts] = React.useState<
    Partial<Record<string, string>>
  >({})
  const [statusPopoverOpen, setStatusPopoverOpen] = React.useState<
    string | null
  >(null)
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null)
  const [decoupledRows, setDecoupledRows] = React.useState<Set<string>>(
    new Set(),
  )
  const [decoupledGroups, setDecoupledGroups] = React.useState<Set<string>>(
    new Set(),
  )

  const groupStatusKey = (groupId: string, timePeriodId: string) =>
    `group:${groupId}:${timePeriodId}`

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const getRowCategory = (row: any, sourceGroup?: any) => {
    const groupCategory = Array.isArray(sourceGroup?.category)
      ? sourceGroup?.category[0]?.name
      : sourceGroup?.category?.name
    if (groupCategory) return groupCategory
    const item = firstItem(row.item) as any
    return item?.category?.name ?? 'Uncategorized'
  }

  const categorizedEntries = React.useMemo(() => {
    // Group rows by source_group_id (compute inside memo so deps are stable)
    const groupMap = new Map<string, Array<any>>()
    const directRows: Array<any> = []

    rows.forEach((r) => {
      if (r.source_kind === 'group' && r.source_group_id) {
        const arr = groupMap.get(r.source_group_id) ?? []
        arr.push(r)
        groupMap.set(r.source_group_id, arr)
      } else {
        directRows.push(r)
      }
    })

    const categoryMap = new Map<
      string,
      {
        groupEntries: Array<[string, Array<any>]>
        directRows: Array<any>
      }
    >()

    for (const [groupId, groupRows] of groupMap.entries()) {
      const firstRow = groupRows[0]
      const sourceGroup = Array.isArray(firstRow?.source_group)
        ? firstRow?.source_group[0]
        : firstRow?.source_group
      const categoryName = getRowCategory(firstRow, sourceGroup)
      const entry = categoryMap.get(categoryName) ?? {
        groupEntries: [],
        directRows: [],
      }
      entry.groupEntries.push([groupId, groupRows])
      categoryMap.set(categoryName, entry)
    }

    for (const row of directRows) {
      const categoryName = getRowCategory(row)
      const entry = categoryMap.get(categoryName) ?? {
        groupEntries: [],
        directRows: [],
      }
      entry.directRows.push(row)
      categoryMap.set(categoryName, entry)
    }

    const entries = Array.from(categoryMap.entries()).map(
      ([categoryName, entry]) => ({
        categoryName,
        groupEntries: entry.groupEntries,
        directRows: entry.directRows,
      }),
    )

    entries.sort((a, b) => {
      if (a.categoryName === 'Uncategorized') return 1
      if (b.categoryName === 'Uncategorized') return -1
      return a.categoryName.localeCompare(b.categoryName)
    })

    return entries
  }, [rows])

  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set())

  React.useEffect(() => {
    setExpandedCategories((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const entry of categorizedEntries) {
        if (!next.has(entry.categoryName)) {
          next.add(entry.categoryName)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [categorizedEntries])

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryName)) {
        next.delete(categoryName)
      } else {
        next.add(categoryName)
      }
      return next
    })
  }

  const handleSaveQty = async (rowId: string, newQty: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ quantity: newQty })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      setEditingQty(null)
      setEditingQtyDrafts((prev) => {
        if (!(rowId in prev)) return prev
        const next = { ...prev }
        delete next[rowId]
        return next
      })
      success('Saved', 'Quantity updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDelete = async (rowId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('id', rowId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleDeleteGroup = async (groupId: string, timePeriodId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('source_group_id', groupId)
        .eq('time_period_id', timePeriodId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Group booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleUpdateStatus = async (
    rowId: string,
    newStatus: BookingStatus,
  ) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ status: newStatus })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Updated', 'Booking status updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleUpdateGroupStatus = async (
    groupId: string,
    timePeriodId: string,
    newStatus: BookingStatus,
  ) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ status: newStatus })
        .eq('source_group_id', groupId)
        .eq('time_period_id', timePeriodId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Updated', 'Group booking status updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleBulkUpdateStatus = async (newStatus: BookingStatus) => {
    try {
      // Filter out decoupled rows from bulk update
      const itemIds = rows
        .filter((r) => {
          if (decoupledRows.has(r.id)) return false
          if (r.source_kind === 'group' && r.source_group_id && r.time_period_id) {
            const key = groupStatusKey(r.source_group_id, r.time_period_id)
            if (decoupledGroups.has(key)) return false
          }
          return true
        })
        .map((r) => r.id)
      if (itemIds.length === 0) return

      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ status: newStatus })
        .in('id', itemIds)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success(
        'Updated',
        `Updated status for ${itemIds.length} booking${itemIds.length !== 1 ? 's' : ''}`,
      )
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDecoupleRow = (rowId: string) => {
    setDecoupledRows((prev) => {
      const next = new Set(prev)
      next.add(rowId)
      return next
    })
  }

  const handleRecoupleRow = (rowId: string) => {
    setDecoupledRows((prev) => {
      const next = new Set(prev)
      next.delete(rowId)
      return next
    })
  }

  const handleDecoupleGroup = (key: string) => {
    setDecoupledGroups((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  const handleRecoupleGroup = (key: string) => {
    setDecoupledGroups((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const handleViewChange = (value: string) => {
    if (value === 'internal' || value === 'external') {
      onViewChange(value)
    }
  }

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
        <Heading size="3">Internal equipment</Heading>
        {companyRole !== 'freelancer' && (
          <Flex align="center" gap="3">
            {rows.length > 0 && (
              <>
                <Select.Root
                  onValueChange={(value) =>
                    handleBulkUpdateStatus(value as BookingStatus)
                  }
                >
                  <Select.Trigger
                    variant="soft"
                    placeholder="Set all status..."
                  />
                  <Select.Content>
                    <Select.Item value="planned">Planned</Select.Item>
                    <Select.Item value="confirmed">Confirmed</Select.Item>
                    <Select.Item value="canceled">Canceled</Select.Item>
                  </Select.Content>
                </Select.Root>
                <Button
                  size="2"
                  variant={editMode ? 'solid' : 'soft'}
                  color={editMode ? 'green' : undefined}
                  disabled={!canBook}
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit width={16} height={16} />{' '}
                  {editMode ? 'Done editing' : 'Edit bookings'}
                </Button>
              </>
            )}
            <Button
              size="2"
              disabled={!canBook}
              onClick={() => setBookItemsOpen(true)}
            >
              <Plus width={16} height={16} /> Book items
            </Button>
            <SegmentedControl.Root
              value={view}
              onValueChange={handleViewChange}
              size="2"
            >
              <SegmentedControl.Item value="internal">
                Internal equipment
              </SegmentedControl.Item>
              <SegmentedControl.Item value="external">
                External equipment
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
        )}
        {canBook && companyId && (
          <BookItemsDialog
            open={bookItemsOpen}
            onOpenChange={setBookItemsOpen}
            jobId={jobId}
            companyId={companyId}
            timePeriodId={undefined}
            externalOnlyInitial={false}
          />
        )}
      </Box>

      <Flex direction="column" gap="3">
        {categorizedEntries.map((category) => {
          const isCategoryExpanded = expandedCategories.has(
            category.categoryName,
          )
          const itemCount =
            category.directRows.length +
            category.groupEntries.reduce((sum, [, groupRows]) => {
              return sum + groupRows.length
            }, 0)

          return (
            <Box
              key={category.categoryName}
              style={{
                border: '1px solid var(--gray-a5)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--gray-a1)',
              }}
            >
              <Box
                p="3"
                style={{
                  background: 'var(--gray-a2)',
                  cursor: 'pointer',
                  borderBottom: isCategoryExpanded
                    ? '1px solid var(--gray-a5)'
                    : 'none',
                }}
                onClick={() => toggleCategory(category.categoryName)}
              >
                <Flex align="center" justify="between">
                  <Flex align="center" gap="3">
                    {isCategoryExpanded ? (
                      <NavArrowDown width={18} height={18} />
                    ) : (
                      <NavArrowRight width={18} height={18} />
                    )}
                    <Text weight="medium">{category.categoryName}</Text>
                    <Text size="2" color="gray">
                      ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                    </Text>
                  </Flex>
                </Flex>
              </Box>

              {isCategoryExpanded && (
                <Box p="3">
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>
                          Category
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>
                          Time period
                        </Table.ColumnHeaderCell>
                        {editMode && <Table.ColumnHeaderCell />}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {/* Render grouped items */}
                      {category.groupEntries.map(([groupId, groupRows]) => {
                        const firstRow = groupRows[0]
                        const sourceGroup = Array.isArray(
                          firstRow?.source_group,
                        )
                          ? firstRow?.source_group[0]
                          : firstRow?.source_group
                        const groupName =
                          sourceGroup?.name ?? `Group ${groupId.slice(0, 8)}`
                        const groupCategory = Array.isArray(
                          sourceGroup?.category,
                        )
                          ? sourceGroup?.category[0]?.name
                          : sourceGroup?.category?.name
                        const isExpanded = expandedGroups.has(groupId)
                        const statusKey = groupStatusKey(
                          groupId,
                          firstRow.time_period_id,
                        )
                        const totalQty = groupRows.reduce(
                          (sum, r) => sum + (r.quantity ?? 0),
                          0,
                        )

                        return (
                          <React.Fragment key={groupId}>
                            {/* Group header row */}
                            <Table.Row
                              style={{
                                cursor: editMode ? 'default' : 'pointer',
                                backgroundColor: 'var(--gray-a1)',
                              }}
                              onClick={() => !editMode && toggleGroup(groupId)}
                            >
                              <Table.Cell>
                                <Box
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  {!editMode &&
                                    (isExpanded ? (
                                      <NavArrowDown width={18} height={18} />
                                    ) : (
                                      <NavArrowRight width={18} height={18} />
                                    ))}
                                  <Text>{groupName}</Text>
                                  <Badge color="pink" variant="soft">
                                    Group
                                  </Badge>
                                </Box>
                              </Table.Cell>
                              <Table.Cell>
                                <Text weight="bold">{totalQty}</Text>
                              </Table.Cell>
                              <Table.Cell>—</Table.Cell>
                              <Table.Cell>—</Table.Cell>
                              <Table.Cell>{groupCategory ?? '—'}</Table.Cell>
                              <Table.Cell>
                                <Box
                                  onMouseEnter={() =>
                                    !isReadOnly && setHoveredRowId(statusKey)
                                  }
                                  onMouseLeave={() => setHoveredRowId(null)}
                                >
                                  <Flex align="center" gap="2">
                                    <Badge
                                      radius="full"
                                      highContrast
                                      color={
                                        firstRow?.status === 'confirmed'
                                          ? 'green'
                                          : firstRow?.status === 'canceled'
                                            ? 'red'
                                            : 'gray'
                                      }
                                    >
                                      {firstRow?.status ?? 'planned'}
                                    </Badge>
                                    {!isReadOnly && (
                                      <>
                                        {decoupledGroups.has(statusKey) ? (
                                          <>
                                            <Popover.Root
                                              open={statusPopoverOpen === statusKey}
                                              onOpenChange={(open) =>
                                                setStatusPopoverOpen(
                                                  open ? statusKey : null,
                                                )
                                              }
                                            >
                                              <Popover.Trigger>
                                                <IconButton
                                                  size="1"
                                                  variant="ghost"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                  }}
                                                >
                                                  <Edit width={14} height={14} />
                                                </IconButton>
                                              </Popover.Trigger>
                                              <Popover.Content style={{ width: 180 }}>
                                                <Flex direction="column" gap="2">
                                                  <Text size="2" weight="medium">
                                                    Change status
                                                  </Text>
                                                  <Select.Root
                                                    value={
                                                      (firstRow?.status ??
                                                        'planned') as BookingStatus
                                                    }
                                                    onValueChange={(value) => {
                                                      handleUpdateGroupStatus(
                                                        groupId,
                                                        firstRow.time_period_id,
                                                        value as BookingStatus,
                                                      )
                                                      setStatusPopoverOpen(null)
                                                    }}
                                                  >
                                                    <Select.Trigger size="2" />
                                                    <Select.Content>
                                                      <Select.Item value="planned">
                                                        Planned
                                                      </Select.Item>
                                                      <Select.Item value="confirmed">
                                                        Confirmed
                                                      </Select.Item>
                                                      <Select.Item value="canceled">
                                                        Canceled
                                                      </Select.Item>
                                                    </Select.Content>
                                                  </Select.Root>
                                                </Flex>
                                              </Popover.Content>
                                            </Popover.Root>
                                            <IconButton
                                              size="1"
                                              variant="ghost"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleRecoupleGroup(statusKey)
                                              }}
                                              style={{
                                                opacity:
                                                  hoveredRowId === statusKey ? 1 : 0,
                                                pointerEvents:
                                                  hoveredRowId === statusKey
                                                    ? 'auto'
                                                    : 'none',
                                              }}
                                            >
                                              <Link width={14} height={14} />
                                            </IconButton>
                                          </>
                                        ) : (
                                          <IconButton
                                            size="1"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDecoupleGroup(statusKey)
                                            }}
                                            style={{
                                              opacity:
                                                hoveredRowId === statusKey ? 1 : 0,
                                              pointerEvents:
                                                hoveredRowId === statusKey
                                                  ? 'auto'
                                                  : 'none',
                                            }}
                                          >
                                            <LinkSlash width={14} height={14} />
                                          </IconButton>
                                        )}
                                      </>
                                    )}
                                  </Flex>
                                </Box>
                              </Table.Cell>
                              <Table.Cell>
                                {firstRow?.time_period?.title ??
                                  `${fmtDate(firstRow?.time_period?.start_at)} – ${fmtDate(firstRow?.time_period?.end_at)}`}
                              </Table.Cell>
                              {editMode && (
                                <Table.Cell align="right">
                                  <Button
                                    size="1"
                                    variant="soft"
                                    color="red"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteGroup(
                                        groupId,
                                        firstRow.time_period_id,
                                      )
                                    }}
                                  >
                                    <Trash width={14} height={14} />
                                  </Button>
                                </Table.Cell>
                              )}
                            </Table.Row>

                            {/* Expanded group items */}
                            {isExpanded &&
                              !editMode &&
                              groupRows.map((r) => {
                                const item = firstItem(r.item)
                                return (
                                  <Table.Row
                                    key={r.id}
                                    style={{
                                      backgroundColor: 'var(--gray-a1)',
                                    }}
                                  >
                                    <Table.Cell style={{ paddingLeft: 32 }}>
                                      <Text color="gray">
                                        ↳ {item?.name ?? '—'}
                                      </Text>
                                    </Table.Cell>
                                    <Table.Cell>{r.quantity}</Table.Cell>
                                    <Table.Cell>
                                      {item?.brand?.name ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell>
                                      {item?.model ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell>
                                      {item?.category?.name ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell>—</Table.Cell>
                                    <Table.Cell>—</Table.Cell>
                                  </Table.Row>
                                )
                              })}
                          </React.Fragment>
                        )
                      })}

                      {/* Render direct items */}
                      {category.directRows.map((r) => {
                        const item = firstItem(r.item)
                        const isEditing = editingQty?.id === r.id
                        return (
                          <Table.Row key={r.id}>
                            <Table.Cell>{item?.name ?? '—'}</Table.Cell>
                            <Table.Cell>
                              {editMode ? (
                                <Box
                                  style={{
                                    display: 'flex',
                                    gap: 4,
                                    alignItems: 'center',
                                  }}
                                >
                                  <TextField.Root
                                    type="number"
                                    min="1"
                                    value={String(
                                      editingQtyDrafts[r.id] ??
                                        (isEditing && editingQty
                                          ? editingQty.value
                                          : r.quantity),
                                    )}
                                    onChange={(e) => {
                                      const nextValue = e.target.value
                                      setEditingQtyDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: nextValue,
                                      }))

                                      if (nextValue === '') return
                                      const parsed = Number(nextValue)
                                      if (Number.isNaN(parsed)) return

                                      setEditingQty({
                                        id: r.id,
                                        value: Math.max(1, parsed),
                                      })
                                      setEditingQtyDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[r.id]
                                        return next
                                      })
                                    }}
                                    onBlur={() => {
                                      if (editingQtyDrafts[r.id] === '') {
                                        setEditingQtyDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[r.id]
                                          return next
                                        })
                                      }
                                    }}
                                    style={{ width: 80 }}
                                  />
                                  {isEditing && editingQty && (
                                    <Button
                                      size="1"
                                      variant="soft"
                                      onClick={() =>
                                        handleSaveQty(r.id, editingQty.value)
                                      }
                                    >
                                      <Check width={14} height={14} />
                                    </Button>
                                  )}
                                </Box>
                              ) : (
                                r.quantity
                              )}
                            </Table.Cell>
                            <Table.Cell>{item?.brand?.name ?? '—'}</Table.Cell>
                            <Table.Cell>{item?.model ?? '—'}</Table.Cell>
                            <Table.Cell>
                              {item?.category?.name ?? '—'}
                            </Table.Cell>
                            <Table.Cell
                              onMouseEnter={() =>
                                !isReadOnly && setHoveredRowId(r.id)
                              }
                              onMouseLeave={() => setHoveredRowId(null)}
                            >
                              <Flex align="center" gap="2">
                                <Badge
                                  radius="full"
                                  highContrast
                                  color={
                                    r.status === 'confirmed'
                                      ? 'green'
                                      : r.status === 'canceled'
                                        ? 'red'
                                        : 'gray'
                                  }
                                >
                                  {r.status ?? 'planned'}
                                </Badge>
                                {!isReadOnly && (
                                  <>
                                    {decoupledRows.has(r.id) ? (
                                      <>
                                        <Popover.Root
                                          open={statusPopoverOpen === r.id}
                                          onOpenChange={(open) =>
                                            setStatusPopoverOpen(
                                              open ? r.id : null,
                                            )
                                          }
                                        >
                                          <Popover.Trigger>
                                            <IconButton
                                              size="1"
                                              variant="ghost"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <Edit width={14} height={14} />
                                            </IconButton>
                                          </Popover.Trigger>
                                          <Popover.Content
                                            style={{ width: 180 }}
                                          >
                                            <Flex direction="column" gap="2">
                                              <Text size="2" weight="medium">
                                                Change status
                                              </Text>
                                              <Select.Root
                                                value={r.status ?? 'planned'}
                                                onValueChange={(value) => {
                                                  handleUpdateStatus(
                                                    r.id,
                                                    value as BookingStatus,
                                                  )
                                                  setStatusPopoverOpen(null)
                                                }}
                                              >
                                                <Select.Trigger />
                                                <Select.Content>
                                                  <Select.Item value="planned">
                                                    Planned
                                                  </Select.Item>
                                                  <Select.Item value="confirmed">
                                                    Confirmed
                                                  </Select.Item>
                                                  <Select.Item value="canceled">
                                                    Canceled
                                                  </Select.Item>
                                                </Select.Content>
                                              </Select.Root>
                                            </Flex>
                                          </Popover.Content>
                                        </Popover.Root>
                                        <IconButton
                                          size="1"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleRecoupleRow(r.id)
                                          }}
                                          style={{
                                            opacity:
                                              hoveredRowId === r.id ? 1 : 0,
                                            pointerEvents:
                                              hoveredRowId === r.id
                                                ? 'auto'
                                                : 'none',
                                          }}
                                        >
                                          <Link width={14} height={14} />
                                        </IconButton>
                                      </>
                                    ) : (
                                      <IconButton
                                        size="1"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDecoupleRow(r.id)
                                        }}
                                        style={{
                                          opacity:
                                            hoveredRowId === r.id ? 1 : 0,
                                          pointerEvents:
                                            hoveredRowId === r.id
                                              ? 'auto'
                                              : 'none',
                                        }}
                                      >
                                        <LinkSlash width={14} height={14} />
                                      </IconButton>
                                    )}
                                  </>
                                )}
                              </Flex>
                            </Table.Cell>
                            <Table.Cell>
                              {r.time_period?.title ??
                                `${fmtDate(r.time_period?.start_at)} – ${fmtDate(r.time_period?.end_at)}`}
                            </Table.Cell>
                            {editMode && (
                              <Table.Cell align="right">
                                <Button
                                  size="1"
                                  variant="soft"
                                  color="red"
                                  onClick={() => handleDelete(r.id)}
                                >
                                  <Trash width={14} height={14} />
                                </Button>
                              </Table.Cell>
                            )}
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Box>
          )
        })}
      </Flex>

      {/* Empty State */}
      {rows.length === 0 && canBook && (
        <Box
          p="4"
          mt="3"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 100ms',
          }}
          onClick={() => setBookItemsOpen(true)}
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
              Book items
            </Text>
          </Flex>
        </Box>
      )}
    </Box>
  )
}

/* ------------------- External Table ------------------- */
function ExternalEquipmentTable({
  rows,
  externalTimePeriods,
  canBook,
  jobId,
  companyId,
  editMode,
  setEditMode,
  view,
  onViewChange,
}: {
  rows: Array<any>
  externalTimePeriods: Array<{
    id: string
    title: string
    start_at: string
    end_at: string
  }>
  canBook: boolean
  jobId: string
  companyId: string | null
  editMode: boolean
  setEditMode: (v: boolean) => void
  view: 'internal' | 'external'
  onViewChange: (v: 'internal' | 'external') => void
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [editingQty, setEditingQty] = React.useState<{
    id: string
    value: number
  } | null>(null)
  const [editingQtyDrafts, setEditingQtyDrafts] = React.useState<
    Partial<Record<string, string>>
  >({})
  const [expandedOwners, setExpandedOwners] = React.useState<Set<string>>(
    new Set(),
  )
  const [ownerNotes, setOwnerNotes] = React.useState<Map<string, string>>(
    new Map(),
  )
  const [selectOwnerOpen, setSelectOwnerOpen] = React.useState(false)
  const [bookItemsOpenForOwner, setBookItemsOpenForOwner] = React.useState<{
    ownerId: string
    ownerName: string
    timePeriodId: string
  } | null>(null)
  const [deleteOwnerOpen, setDeleteOwnerOpen] = React.useState<{
    ownerId: string
    ownerName: string
    timePeriodId: string
    itemCount: number
  } | null>(null)
  const [decoupledRows, setDecoupledRows] = React.useState<Set<string>>(
    new Set(),
  )
  const [statusPopoverOpen, setStatusPopoverOpen] = React.useState<
    string | null
  >(null)
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null)

  // Fetch job to get duration times
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
  })

  // Fetch partners to map owner names to IDs
  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId: companyId || '' }),
    enabled: !!companyId,
  })

  // Extract owner info from time period titles (format: "{OwnerName} Equipment period")
  const ownerTimePeriodMap = React.useMemo(() => {
    const map = new Map<string, { timePeriodId: string; ownerName: string }>()
    for (const tp of externalTimePeriods) {
      // Extract owner name from title like "Acme Corp Equipment period"
      const match = tp.title.match(/^(.+?)\s+Equipment period$/)
      if (match) {
        const ownerName = match[1]
        // We need to find the owner ID - we'll look it up from items or fetch partners
        map.set(ownerName, {
          timePeriodId: tp.id,
          ownerName,
        })
      }
    }
    return map
  }, [externalTimePeriods])

  // Group items by external owner and map to time periods
  const ownerGroups = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        ownerId: string
        ownerName: string
        items: Array<any>
        timePeriodId: string | null
      }
    >()

    // First, add owners from existing items
    for (const row of rows) {
      const item = firstItem(row.item) as any
      const ownerId = item?.external_owner_id
      if (!ownerId) continue

      const ownerName = Array.isArray(item?.external_owner)
        ? item?.external_owner[0]?.name
        : item?.external_owner?.name

      if (!ownerName) continue

      if (!groups.has(ownerId)) {
        // Find time period for this owner
        const timePeriodEntry = Array.from(ownerTimePeriodMap.entries()).find(
          ([name]) => name === ownerName,
        )
        groups.set(ownerId, {
          ownerId,
          ownerName,
          items: [],
          timePeriodId: timePeriodEntry?.[1].timePeriodId ?? null,
        })
      }
      const group = groups.get(ownerId)!
      group.items.push(row)
    }

    // Also add owners from time periods that might not have items yet
    for (const [ownerName, { timePeriodId }] of ownerTimePeriodMap.entries()) {
      const existingOwner = Array.from(groups.values()).find(
        (g) => g.ownerName === ownerName,
      )
      if (!existingOwner) {
        // Find owner ID from partners list by matching name
        const partner = partners.find((p) => p.name === ownerName)
        const ownerId = partner?.id || `temp-${ownerName}`
        groups.set(ownerId, {
          ownerId,
          ownerName,
          items: [],
          timePeriodId,
        })
      }
    }

    return groups
  }, [rows, ownerTimePeriodMap, partners])

  // Sync ownerNotes when data changes
  React.useEffect(() => {
    setOwnerNotes((prevNotes) => {
      const newNotes = new Map<string, string>()
      // Compute owner groups from rows directly to avoid dependency on memoized Map
      const groups = new Map<
        string,
        {
          ownerId: string
          items: Array<any>
        }
      >()

      for (const row of rows) {
        const item = firstItem(row.item) as any
        const ownerId = item?.external_owner_id
        if (!ownerId) continue

        if (!groups.has(ownerId)) {
          groups.set(ownerId, { ownerId, items: [] })
        }
        groups.get(ownerId)!.items.push(row)
      }

      for (const [ownerId, group] of groups.entries()) {
        if (group.items.length > 0) {
          const currentNote = group.items[0]?.external_note ?? ''
          // Only keep notes that have been edited and differ from current
          const editedNote = prevNotes.get(ownerId)
          if (editedNote !== undefined && editedNote !== currentNote) {
            newNotes.set(ownerId, editedNote)
          }
        }
      }
      return newNotes
    })
  }, [rows])

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(ownerId)) {
        next.delete(ownerId)
      } else {
        next.add(ownerId)
      }
      return next
    })
  }

  const handleSaveQty = async (rowId: string, newQty: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ quantity: newQty })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      setEditingQty(null)
      setEditingQtyDrafts((prev) => {
        if (!(rowId in prev)) return prev
        const next = { ...prev }
        delete next[rowId]
        return next
      })
      success('Saved', 'Quantity updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDelete = async (rowId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('id', rowId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleUpdateOwnerItems = async (
    ownerItems: Array<any>,
    updates: {
      external_status?: ExternalReqStatus
      external_note?: string
      time_period_id?: string
    },
  ) => {
    try {
      const itemIds = ownerItems.map((r) => r.id)
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update(updates)
        .in('id', itemIds)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Updated', 'All items for this owner updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  // Handle adding a new owner
  const handleAddOwner = async (ownerId: string, ownerName: string) => {
    if (!companyId || !job) return

    try {
      // Create time period for this owner with job duration times
      const startTime = job.start_at || new Date().toISOString()
      const endTime =
        job.end_at || new Date(Date.now() + 86400000).toISOString()

      const timePeriodId = await upsertTimePeriod({
        job_id: jobId,
        company_id: companyId,
        title: `${ownerName} Equipment period`,
        start_at: startTime,
        end_at: endTime,
        category: 'equipment',
      })

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })

      // Open book items dialog for this owner
      setBookItemsOpenForOwner({
        ownerId,
        ownerName,
        timePeriodId,
      })

      success('Success', `Time period created for ${ownerName}`)
    } catch (e: any) {
      error('Failed to create time period', e?.message || 'Please try again.')
    }
  }

  // Get list of owner IDs that already have sections
  const existingOwnerIds = React.useMemo(() => {
    return Array.from(ownerGroups.values())
      .map((g) => {
        // Try to find real owner ID from items
        if (g.items.length > 0) {
          const item = firstItem(g.items[0].item) as any
          return item?.external_owner_id ?? null
        }
        return null
      })
      .filter((id): id is string => id !== null && !id.startsWith('temp-'))
  }, [ownerGroups])

  // Handle deleting entire owner booking
  const handleDeleteOwner = async () => {
    if (!deleteOwnerOpen) return

    try {
      const { timePeriodId } = deleteOwnerOpen

      // First, delete all reserved items for this time period
      if (deleteOwnerOpen.itemCount > 0) {
        const { error: itemsErr } = await supabase
          .from('reserved_items')
          .delete()
          .eq('time_period_id', timePeriodId)
        if (itemsErr) throw itemsErr
      }

      // Then, delete the time period
      const { error: tpErr } = await supabase
        .from('time_periods')
        .delete()
        .eq('id', timePeriodId)
      if (tpErr) throw tpErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })

      success('Deleted', `Removed booking for ${deleteOwnerOpen.ownerName}`)
      setDeleteOwnerOpen(null)
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleUpdateItemStatus = async (
    rowId: string,
    newStatus: ExternalReqStatus,
  ) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ external_status: newStatus })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Updated', 'Item status updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleBulkUpdateStatus = async (newStatus: ExternalReqStatus) => {
    try {
      // Filter out decoupled rows from bulk update
      const itemIds = rows
        .filter((r) => !decoupledRows.has(r.id))
        .map((r) => r.id)
      if (itemIds.length === 0) return

      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ external_status: newStatus })
        .in('id', itemIds)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success(
        'Updated',
        `Updated status for ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`,
      )
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDecoupleRow = (rowId: string) => {
    setDecoupledRows((prev) => {
      const next = new Set(prev)
      next.add(rowId)
      return next
    })
  }

  const handleRecoupleRow = (rowId: string) => {
    setDecoupledRows((prev) => {
      const next = new Set(prev)
      next.delete(rowId)
      return next
    })
  }

  const handleViewChange = (value: string) => {
    if (value === 'internal' || value === 'external') {
      onViewChange(value)
    }
  }

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
        <Heading size="3">External equipment</Heading>
        <Flex align="center" gap="3">
          {companyRole !== 'freelancer' && rows.length > 0 && (
            <Select.Root
              onValueChange={(value) =>
                handleBulkUpdateStatus(value as ExternalReqStatus)
              }
            >
              <Select.Trigger variant="soft" placeholder="Set all status..." />
              <Select.Content>
                <Select.Item value="planned">Planned</Select.Item>
                <Select.Item value="requested">Requested</Select.Item>
                <Select.Item value="confirmed">Confirmed</Select.Item>
              </Select.Content>
            </Select.Root>
          )}
          {companyRole !== 'freelancer' && (
            <SegmentedControl.Root
              value={view}
              onValueChange={handleViewChange}
              size="2"
            >
              <SegmentedControl.Item value="internal">
                Internal equipment
              </SegmentedControl.Item>
              <SegmentedControl.Item value="external">
                External equipment
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          )}
        </Flex>
      </Box>

      {/* Owner Sections */}
      <Flex direction="column" gap="3">
        {Array.from(ownerGroups.values()).map((group) => {
          const ownerId = group.ownerId
          const ownerName = group.ownerName
          const ownerItems = group.items
          const timePeriodId = group.timePeriodId
          const isExpanded = expandedOwners.has(ownerId)

          const firstRow = ownerItems[0]
          const currentStatus =
            ownerItems.length > 0
              ? (firstRow.external_status as ExternalReqStatus)
              : 'planned'
          const currentNote = firstRow?.external_note ?? ''
          const editedNote = ownerNotes.get(ownerId) ?? currentNote
          const noteChanged = editedNote !== currentNote

          return (
            <Box
              key={ownerId}
              style={{
                border: '1px solid var(--gray-a5)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--gray-a1)',
              }}
            >
              {/* Owner Header */}
              <Box
                p="3"
                style={{
                  background: 'var(--gray-a2)',
                  cursor: 'pointer',
                  borderBottom: isExpanded
                    ? '1px solid var(--gray-a5)'
                    : 'none',
                }}
                onClick={() => toggleOwner(ownerId)}
              >
                <Flex align="center" justify="between">
                  <Flex align="center" gap="3">
                    {isExpanded ? (
                      <NavArrowDown width={18} height={18} />
                    ) : (
                      <NavArrowRight width={18} height={18} />
                    )}
                    <Text weight="medium">{ownerName}</Text>
                    {ownerItems.length > 0 && (
                      <Text size="2" color="gray">
                        ({ownerItems.length}{' '}
                        {ownerItems.length === 1 ? 'item' : 'items'})
                      </Text>
                    )}
                  </Flex>
                  {ownerItems.length > 0 &&
                    (isReadOnly ? (
                      <Badge radius="full" highContrast>
                        {currentStatus}
                      </Badge>
                    ) : (
                      <StatusBadge
                        value={currentStatus}
                        onChange={(v) =>
                          handleUpdateOwnerItems(ownerItems, {
                            external_status: v,
                          })
                        }
                      />
                    ))}
                </Flex>
              </Box>

              {/* Expanded Details */}
              {isExpanded && (
                <Box
                  p="3"
                  style={{
                    background: 'var(--gray-a1)',
                    borderTop: '1px solid var(--gray-a4)',
                  }}
                >
                  <Flex direction="column" gap="3">
                    {/* Action Buttons */}
                    {!isReadOnly && timePeriodId && (
                      <Flex gap="2">
                        <Button
                          size="2"
                          variant="soft"
                          onClick={() =>
                            setBookItemsOpenForOwner({
                              ownerId,
                              ownerName,
                              timePeriodId,
                            })
                          }
                          disabled={!timePeriodId || !canBook}
                        >
                          <Plus width={16} height={16} /> Book items
                        </Button>
                        {ownerItems.length > 0 && (
                          <Button
                            size="2"
                            variant={editMode ? 'solid' : 'soft'}
                            color={editMode ? 'green' : undefined}
                            disabled={!canBook}
                            onClick={() => setEditMode(!editMode)}
                          >
                            <Edit width={16} height={16} />{' '}
                            {editMode ? 'Done editing' : 'Edit bookings'}
                          </Button>
                        )}
                        <Button
                          size="2"
                          variant="soft"
                          color="red"
                          onClick={() =>
                            setDeleteOwnerOpen({
                              ownerId,
                              ownerName,
                              timePeriodId,
                              itemCount: ownerItems.length,
                            })
                          }
                          disabled={!canBook}
                        >
                          <Trash width={16} height={16} /> Remove
                        </Button>
                      </Flex>
                    )}

                    <Box>
                      <Text size="1" weight="medium" mb="1">
                        Time Period
                      </Text>
                      {timePeriodId ? (
                        <FixedTimePeriodEditor
                          jobId={jobId}
                          timePeriodId={timePeriodId}
                          readOnly={isReadOnly}
                        />
                      ) : (
                        <Box
                          p="2"
                          style={{
                            border: '1px dashed var(--amber-a6)',
                            borderRadius: 8,
                            background: 'var(--amber-a2)',
                          }}
                        >
                          <Text size="2" color="amber">
                            No time period set
                          </Text>
                        </Box>
                      )}
                    </Box>

                    {ownerItems.length > 0 && (
                      <>
                        <Box>
                          <Text size="1" weight="medium" mb="1">
                            Note
                          </Text>
                          {isReadOnly ? (
                            <Text size="2">{editedNote || '—'}</Text>
                          ) : (
                            <TextField.Root
                              placeholder="Add note for all items from this owner…"
                              value={editedNote}
                              onChange={(e) => {
                                const newNotes = new Map(ownerNotes)
                                newNotes.set(ownerId, e.target.value)
                                setOwnerNotes(newNotes)
                              }}
                            >
                              {noteChanged && (
                                <TextField.Slot side="right">
                                  <Button
                                    size="2"
                                    variant="ghost"
                                    onClick={() => {
                                      handleUpdateOwnerItems(ownerItems, {
                                        external_note: editedNote,
                                      })
                                      const newNotes = new Map(ownerNotes)
                                      newNotes.delete(ownerId)
                                      setOwnerNotes(newNotes)
                                    }}
                                  >
                                    Save
                                  </Button>
                                </TextField.Slot>
                              )}
                            </TextField.Root>
                          )}
                        </Box>

                        {/* Items Table */}
                        <Box mt="3">
                          <Table.Root variant="surface">
                            <Table.Header>
                              <Table.Row>
                                <Table.ColumnHeaderCell>
                                  Item
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                  Qty
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                  Brand
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                  Model
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                  Status
                                </Table.ColumnHeaderCell>
                                {editMode && <Table.ColumnHeaderCell />}
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {ownerItems.map((r: ReservedItemRow) => {
                                const rowItem = firstItem(r.item) as any
                                return (
                                  <Table.Row key={r.id}>
                                    <Table.Cell>
                                      {rowItem?.name ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell>
                                      {editMode ? (
                                        <Box
                                          style={{
                                            display: 'flex',
                                            gap: 4,
                                            alignItems: 'center',
                                          }}
                                        >
                                          <TextField.Root
                                            type="number"
                                            min="1"
                                            value={String(
                                              editingQtyDrafts[r.id] ??
                                                (editingQty?.id === r.id
                                                  ? editingQty.value
                                                  : r.quantity),
                                            )}
                                            onChange={(e) => {
                                              const nextValue = e.target.value
                                              setEditingQtyDrafts((prev) => ({
                                                ...prev,
                                                [r.id]: nextValue,
                                              }))

                                              if (nextValue === '') return
                                              const parsed = Number(nextValue)
                                              if (Number.isNaN(parsed)) return

                                              setEditingQty({
                                                id: r.id,
                                                value: Math.max(1, parsed),
                                              })
                                              setEditingQtyDrafts((prev) => {
                                                const next = { ...prev }
                                                delete next[r.id]
                                                return next
                                              })
                                            }}
                                            onBlur={() => {
                                              if (
                                                editingQtyDrafts[r.id] === ''
                                              ) {
                                                setEditingQtyDrafts((prev) => {
                                                  const next = { ...prev }
                                                  delete next[r.id]
                                                  return next
                                                })
                                              }
                                            }}
                                            style={{ width: 80 }}
                                          />
                                          {editingQty?.id === r.id && (
                                            <Button
                                              size="1"
                                              variant="soft"
                                              onClick={() =>
                                                handleSaveQty(
                                                  r.id,
                                                  editingQty.value,
                                                )
                                              }
                                            >
                                              <Check width={14} height={14} />
                                            </Button>
                                          )}
                                        </Box>
                                      ) : (
                                        r.quantity
                                      )}
                                    </Table.Cell>
                                    <Table.Cell>
                                      {rowItem?.brand?.name ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell>
                                      {rowItem?.model ?? '—'}
                                    </Table.Cell>
                                    <Table.Cell
                                      onMouseEnter={() =>
                                        !isReadOnly && setHoveredRowId(r.id)
                                      }
                                      onMouseLeave={() => setHoveredRowId(null)}
                                    >
                                      <Flex align="center" gap="2">
                                        <Badge
                                          radius="full"
                                          highContrast
                                          color={
                                            r.external_status === 'confirmed'
                                              ? 'green'
                                              : r.external_status ===
                                                  'requested'
                                                ? 'amber'
                                                : 'gray'
                                          }
                                        >
                                          {r.external_status ?? 'planned'}
                                        </Badge>
                                        {!isReadOnly && (
                                          <>
                                            {decoupledRows.has(r.id) ? (
                                              <>
                                                <Popover.Root
                                                  open={
                                                    statusPopoverOpen === r.id
                                                  }
                                                  onOpenChange={(open) =>
                                                    setStatusPopoverOpen(
                                                      open ? r.id : null,
                                                    )
                                                  }
                                                >
                                                  <Popover.Trigger>
                                                    <IconButton
                                                      size="1"
                                                      variant="ghost"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      <Edit
                                                        width={14}
                                                        height={14}
                                                      />
                                                    </IconButton>
                                                  </Popover.Trigger>
                                                  <Popover.Content
                                                    style={{ width: 180 }}
                                                  >
                                                    <Flex
                                                      direction="column"
                                                      gap="2"
                                                    >
                                                      <Text
                                                        size="2"
                                                        weight="medium"
                                                      >
                                                        Change status
                                                      </Text>
                                                      <Select.Root
                                                        value={
                                                          r.external_status ??
                                                          'planned'
                                                        }
                                                        onValueChange={(
                                                          value,
                                                        ) => {
                                                          handleUpdateItemStatus(
                                                            r.id,
                                                            value as ExternalReqStatus,
                                                          )
                                                          setStatusPopoverOpen(
                                                            null,
                                                          )
                                                        }}
                                                      >
                                                        <Select.Trigger />
                                                        <Select.Content>
                                                          <Select.Item value="planned">
                                                            Planned
                                                          </Select.Item>
                                                          <Select.Item value="requested">
                                                            Requested
                                                          </Select.Item>
                                                          <Select.Item value="confirmed">
                                                            Confirmed
                                                          </Select.Item>
                                                        </Select.Content>
                                                      </Select.Root>
                                                    </Flex>
                                                  </Popover.Content>
                                                </Popover.Root>
                                                <IconButton
                                                  size="1"
                                                  variant="ghost"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRecoupleRow(r.id)
                                                  }}
                                                  style={{
                                                    opacity:
                                                      hoveredRowId === r.id
                                                        ? 1
                                                        : 0,
                                                    pointerEvents:
                                                      hoveredRowId === r.id
                                                        ? 'auto'
                                                        : 'none',
                                                  }}
                                                >
                                                  <Link
                                                    width={14}
                                                    height={14}
                                                  />
                                                </IconButton>
                                              </>
                                            ) : (
                                              <IconButton
                                                size="1"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleDecoupleRow(r.id)
                                                }}
                                                style={{
                                                  opacity:
                                                    hoveredRowId === r.id
                                                      ? 1
                                                      : 0,
                                                  pointerEvents:
                                                    hoveredRowId === r.id
                                                      ? 'auto'
                                                      : 'none',
                                                }}
                                              >
                                                <LinkSlash
                                                  width={14}
                                                  height={14}
                                                />
                                              </IconButton>
                                            )}
                                          </>
                                        )}
                                      </Flex>
                                    </Table.Cell>
                                    {editMode && (
                                      <Table.Cell align="right">
                                        <Button
                                          size="1"
                                          variant="soft"
                                          color="red"
                                          onClick={() => handleDelete(r.id)}
                                        >
                                          <Trash width={14} height={14} />
                                        </Button>
                                      </Table.Cell>
                                    )}
                                  </Table.Row>
                                )
                              })}
                            </Table.Body>
                          </Table.Root>
                        </Box>
                      </>
                    )}
                  </Flex>
                </Box>
              )}
            </Box>
          )
        })}

        {/* Add Owner Button */}
        {canBook && companyId && (
          <Box
            p="4"
            style={{
              border: '2px dashed var(--gray-a6)',
              borderRadius: 8,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 100ms',
            }}
            onClick={() => setSelectOwnerOpen(true)}
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
                Add partner
              </Text>
            </Flex>
          </Box>
        )}
      </Flex>

      {/* Dialogs */}
      {canBook && companyId && (
        <>
          <SelectExternalOwnerDialog
            open={selectOwnerOpen}
            onOpenChange={setSelectOwnerOpen}
            companyId={companyId}
            onSelect={handleAddOwner}
            excludeOwnerIds={existingOwnerIds}
          />
          {bookItemsOpenForOwner && (
            <BookItemsDialog
              open={!!bookItemsOpenForOwner}
              onOpenChange={(open) => {
                if (!open) setBookItemsOpenForOwner(null)
              }}
              jobId={jobId}
              companyId={companyId}
              timePeriodId={bookItemsOpenForOwner.timePeriodId}
              externalOwnerId={bookItemsOpenForOwner.ownerId}
            />
          )}
          <AlertDialog.Root
            open={!!deleteOwnerOpen}
            onOpenChange={(open) => {
              if (!open) setDeleteOwnerOpen(null)
            }}
          >
            <AlertDialog.Content maxWidth="480px">
              <AlertDialog.Title>Remove external booking?</AlertDialog.Title>
              <AlertDialog.Description size="2">
                This will remove the entire booking for{' '}
                <b>{deleteOwnerOpen?.ownerName}</b>
                {deleteOwnerOpen && deleteOwnerOpen.itemCount > 0 && (
                  <>
                    {' '}
                    including all{' '}
                    <b>
                      {deleteOwnerOpen.itemCount}{' '}
                      {deleteOwnerOpen.itemCount === 1 ? 'item' : 'items'}
                    </b>
                  </>
                )}
                . The time period will also be deleted. This action cannot be
                undone.
              </AlertDialog.Description>
              <Flex gap="3" justify="end" mt="4">
                <AlertDialog.Cancel>
                  <Button variant="soft">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action>
                  <Button
                    color="red"
                    variant="solid"
                    onClick={handleDeleteOwner}
                  >
                    Yes, remove
                  </Button>
                </AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </>
      )}
    </Box>
  )
}

/* ------------------- Helpers ------------------- */
function StatusBadge({
  value,
  onChange,
}: {
  value: ExternalReqStatus
  onChange: (v: ExternalReqStatus) => void
}) {
  const all: Array<ExternalReqStatus> = ['planned', 'requested', 'confirmed']
  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={(v) => onChange(v as ExternalReqStatus)}
      size="1"
    >
      {all.map((s) => (
        <SegmentedControl.Item key={s} value={s}>
          {s}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}

function firstItem(it: ReservedItemRow['item']): ItemLite | null {
  return Array.isArray(it) ? (it[0] ?? null) : it
}
function extOwnerId(it: ReservedItemRow['item']) {
  return firstItem(it)?.external_owner_id ?? null
}
function fmtDate(v?: string) {
  return v ? new Date(v).toLocaleDateString() : ''
}

function BookingStatusControl({
  value,
  onChange,
  size = '1',
}: {
  value: BookingStatus
  onChange: (v: BookingStatus) => void
  size?: '1' | '2'
}) {
  const all: Array<BookingStatus> = ['planned', 'confirmed', 'canceled']

  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={(v) => onChange(v as BookingStatus)}
      size={size}
    >
      {all.map((s) => (
        <SegmentedControl.Item
          key={s}
          value={s}
          style={{
            color:
              s === 'confirmed'
                ? 'var(--green-9)'
                : s === 'canceled'
                  ? 'var(--red-9)'
                  : undefined,
          }}
        >
          {s}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}
