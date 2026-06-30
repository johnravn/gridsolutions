import * as React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowUp, Plus, Trash } from 'iconoir-react'
import { DatePicker } from '@shared/ui/components/pickers'
import { formatVehicleCategory } from './utils'
import { SortableEquipmentGroupCard, SortableEquipmentRow } from './sortable'
import type { LocalTransportGroup, LocalTransportItem } from './types'

export function TransportSection({
  groups,
  onGroupsChange,
  companyId: _companyId,
  readOnly = false,
  jobStartAt,
  jobEndAt,
  vehicleDailyRate,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
}: {
  groups: Array<LocalTransportGroup>
  onGroupsChange: (groups: Array<LocalTransportGroup>) => void
  companyId: string
  readOnly?: boolean
  jobStartAt?: string | null
  jobEndAt?: string | null
  vehicleDailyRate?: number | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number
}) {
  const transportGroupNameSuggestions = React.useMemo(
    () => ['Delivery', 'Pickup', 'General', 'Delivery & pickup'],
    [],
  )

  const [daysUsedDrafts, setDaysUsedDrafts] = React.useState<
    Record<string, string>
  >({})
  const [dailyRateDrafts, setDailyRateDrafts] = React.useState<
    Record<string, string>
  >({})
  const [distanceRateDrafts, setDistanceRateDrafts] = React.useState<
    Record<string, string>
  >({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const addGroup = () => {
    const groupTempId = `temp-${Date.now()}`
    const startDate = jobStartAt ? new Date(jobStartAt) : new Date()
    const endDate = jobEndAt
      ? new Date(jobEndAt)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    const increment = Math.max(1, vehicleDistanceIncrement ?? 150)
    const derivedDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    )

    const next: LocalTransportGroup = {
      id: groupTempId,
      group_name: 'Transport group',
      sort_order: groups.length,
      items: [
        {
          id: `${groupTempId}-item-0`,
          transport_group_id: groupTempId,
          vehicle_name: '',
          vehicle_id: null,
          vehicle_category: null,
          distance_km: increment,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days_used: derivedDays,
          daily_rate_count: null,
          daily_rate: null,
          distance_rate: null,
          is_internal: true,
          sort_order: 0,
        },
      ],
    }
    onGroupsChange([...groups, next])
  }

  const updateGroup = (
    groupId: string,
    updates: Partial<Omit<LocalTransportGroup, 'id' | 'items'>>,
  ) => {
    onGroupsChange(
      groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    )
  }

  const deleteGroup = (groupId: string) => {
    const next = groups.filter((g) => g.id !== groupId)
    onGroupsChange(next.map((g, idx) => ({ ...g, sort_order: idx })))
  }

  const addItemToGroup = (groupId: string) => {
    const startDate = jobStartAt ? new Date(jobStartAt) : new Date()
    const endDate = jobEndAt
      ? new Date(jobEndAt)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    const increment = Math.max(1, vehicleDistanceIncrement ?? 150)
    const derivedDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    )

    onGroupsChange(
      groups.map((g) => {
        if (g.id !== groupId) return g
        const newItem: LocalTransportItem = {
          id: `temp-${Date.now()}`,
          transport_group_id: groupId,
          vehicle_name: '',
          vehicle_id: null,
          vehicle_category: null,
          distance_km: increment,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days_used: derivedDays,
          daily_rate_count: null,
          daily_rate: null,
          distance_rate: null,
          is_internal: true,
          sort_order: g.items.length,
        }
        return { ...g, items: [...g.items, newItem] }
      }),
    )
  }

  const updateItem = (
    groupId: string,
    itemId: string,
    updates: Partial<LocalTransportItem>,
  ) => {
    onGroupsChange(
      groups.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.map((it) =>
            it.id === itemId ? { ...it, ...updates } : it,
          ),
        }
      }),
    )
  }

  const deleteItem = (groupId: string, itemId: string) => {
    onGroupsChange(
      groups.map((g) => {
        if (g.id !== groupId) return g
        const nextItems = g.items
          .filter((it) => it.id !== itemId)
          .map((it, idx) => ({ ...it, sort_order: idx }))
        return { ...g, items: nextItems }
      }),
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Ensure new/blank rows start with company defaults (as editable values)
  React.useEffect(() => {
    const companyDailyRate = vehicleDailyRate ?? null
    const companyDistanceRate = vehicleDistanceRate ?? null
    if (companyDailyRate == null && companyDistanceRate == null) return

    const needsUpdate = groups.some((g) =>
      g.items.some(
        (item) =>
          (item.daily_rate == null && companyDailyRate != null) ||
          (item.distance_rate == null && companyDistanceRate != null),
      ),
    )
    if (!needsUpdate) return

    onGroupsChange(
      groups.map((g) => ({
        ...g,
        items: g.items.map((item) => {
          const next: LocalTransportItem = { ...item }
          if (item.daily_rate == null && companyDailyRate != null) {
            next.daily_rate = companyDailyRate
          }
          if (item.distance_rate == null && companyDistanceRate != null) {
            next.distance_rate = companyDistanceRate
          }
          return next
        }),
      })),
    )
  }, [groups, onGroupsChange, vehicleDailyRate, vehicleDistanceRate])

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Transport</Heading>
        {!readOnly && (
          <Button size="2" onClick={addGroup}>
            <Plus width={16} height={16} /> Add group
          </Button>
        )}
      </Flex>

      {groups.length > 0 && (
        <Box>
          {(() => {
            const sortedGroups = [...groups].sort(
              (a, b) => a.sort_order - b.sort_order,
            )
            const groupIds = sortedGroups.map((g) => g.id)

            const list = (
              <Flex direction="column" gap="3">
                {sortedGroups.map((group) => {
                  const sortedItems = [...group.items].sort(
                    (a, b) => a.sort_order - b.sort_order,
                  )
                  const itemIds = sortedItems.map((it) => it.id)

                  const groupTotal = sortedItems.reduce((sum, item) => {
                    const companyDailyRate = vehicleDailyRate ?? null
                    const companyDistanceRate = vehicleDistanceRate ?? null
                    const distanceIncrement = Math.max(
                      1,
                      vehicleDistanceIncrement ?? 150,
                    )
                    const dailyRateValue = item.daily_rate ?? companyDailyRate
                    const distanceRateValue =
                      item.distance_rate ?? companyDistanceRate
                    const days = Math.ceil(
                      (new Date(item.end_date).getTime() -
                        new Date(item.start_date).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                    const derivedDays = Math.max(1, days)
                    const daysUsed = item.days_used ?? derivedDays
                    const dailyRates = daysUsed
                    const effectiveDailyRate = dailyRateValue ?? 0
                    const dailyCost =
                      effectiveDailyRate * Math.max(0, dailyRates)
                    const effectiveDistanceRate = distanceRateValue
                    const distanceIncrements = item.distance_km
                      ? Math.ceil(item.distance_km / distanceIncrement)
                      : 0
                    const distanceCost =
                      effectiveDistanceRate && distanceIncrements > 0
                        ? effectiveDistanceRate * distanceIncrements
                        : 0
                    return sum + dailyCost + distanceCost
                  }, 0)

                  const table = (
                    <Table.Root variant="surface">
                      <Table.Header>
                        <Table.Row>
                          {!readOnly && (
                            <Table.ColumnHeaderCell style={{ width: 40 }} />
                          )}
                          <Table.ColumnHeaderCell>
                            Vehicle Category
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Distance (km)
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Days used
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Start Date
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            End Date
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Daily Rate
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Distance Rate
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                          {!readOnly && <Table.ColumnHeaderCell />}
                        </Table.Row>
                      </Table.Header>
                      {(() => {
                        const body = (
                          <Table.Body>
                            {sortedItems.map((item) => {
                              const companyDailyRate = vehicleDailyRate ?? null
                              const companyDistanceRate =
                                vehicleDistanceRate ?? null
                              const distanceIncrement = Math.max(
                                1,
                                vehicleDistanceIncrement ?? 150,
                              )
                              const dailyRateValue =
                                item.daily_rate ?? companyDailyRate
                              const distanceRateValue =
                                item.distance_rate ?? companyDistanceRate
                              const adjustDistance = (delta: number) => {
                                const step = distanceIncrement
                                const current = item.distance_km ?? step
                                const next = current + delta
                                const minValue = step
                                let snapped: number
                                if (delta >= 0) {
                                  snapped = Math.ceil(next / step) * step
                                } else {
                                  snapped = Math.floor(next / step) * step
                                }
                                if (snapped < minValue) snapped = minValue
                                updateItem(group.id, item.id, {
                                  distance_km: snapped,
                                })
                              }

                              const days = Math.ceil(
                                (new Date(item.end_date).getTime() -
                                  new Date(item.start_date).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )
                              const derivedDays = Math.max(1, days)
                              const daysUsed = item.days_used ?? derivedDays
                              const dailyRates = daysUsed

                              const effectiveDailyRate = dailyRateValue ?? 0
                              const dailyCost =
                                effectiveDailyRate * Math.max(0, dailyRates)

                              const effectiveDistanceRate = distanceRateValue
                              const distanceIncrements = item.distance_km
                                ? Math.ceil(
                                    item.distance_km / distanceIncrement,
                                  )
                                : 0
                              const distanceCost =
                                effectiveDistanceRate && distanceIncrements > 0
                                  ? effectiveDistanceRate * distanceIncrements
                                  : 0
                              const total = dailyCost + distanceCost
                              const isUsingDefaultDistanceRate =
                                companyDistanceRate !== null &&
                                (item.distance_rate === null ||
                                  item.distance_rate === companyDistanceRate)
                              const isUsingDefaultDailyRate =
                                companyDailyRate !== null &&
                                (item.daily_rate === null ||
                                  item.daily_rate === companyDailyRate)

                              return (
                                <SortableEquipmentRow
                                  id={item.id}
                                  disabled={readOnly}
                                  key={item.id}
                                >
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    {readOnly ? (
                                      <Text>
                                        {formatVehicleCategory(
                                          item.vehicle_category,
                                        )}
                                      </Text>
                                    ) : (
                                      <Select.Root
                                        value={item.vehicle_category ?? ''}
                                        onValueChange={(value) =>
                                          updateItem(group.id, item.id, {
                                            vehicle_category: (value ||
                                              null) as LocalTransportItem['vehicle_category'],
                                          })
                                        }
                                      >
                                        <Select.Trigger placeholder="Select category" />
                                        <Select.Content
                                          style={{ zIndex: 10000 }}
                                        >
                                          <Select.Item value="passenger_car_small">
                                            Passenger Car - Small
                                          </Select.Item>
                                          <Select.Item value="passenger_car_medium">
                                            Passenger Car - Medium
                                          </Select.Item>
                                          <Select.Item value="passenger_car_big">
                                            Passenger Car - Big
                                          </Select.Item>
                                          <Select.Item value="van_small">
                                            Van - Small
                                          </Select.Item>
                                          <Select.Item value="van_medium">
                                            Van - Medium
                                          </Select.Item>
                                          <Select.Item value="van_big">
                                            Van - Big
                                          </Select.Item>
                                          <Select.Item value="C1">
                                            C1
                                          </Select.Item>
                                          <Select.Item value="C1E">
                                            C1E
                                          </Select.Item>
                                          <Select.Item value="C">C</Select.Item>
                                          <Select.Item value="CE">
                                            CE
                                          </Select.Item>
                                        </Select.Content>
                                      </Select.Root>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    {readOnly ? (
                                      <Text>{item.distance_km ?? '—'}</Text>
                                    ) : (
                                      <Flex align="center" gap="1">
                                        <TextField.Root
                                          type="number"
                                          min={distanceIncrement}
                                          step={String(distanceIncrement)}
                                          value={String(item.distance_km ?? '')}
                                          onChange={(e) => {
                                            const value = e.target.value
                                            if (value === '') {
                                              updateItem(group.id, item.id, {
                                                distance_km: null,
                                              })
                                            } else {
                                              const numValue =
                                                Number(value) || 0
                                              // Force to nearest increment (round to nearest)
                                              const rounded =
                                                Math.round(
                                                  numValue / distanceIncrement,
                                                ) * distanceIncrement
                                              updateItem(group.id, item.id, {
                                                distance_km: Math.max(
                                                  distanceIncrement,
                                                  rounded,
                                                ),
                                              })
                                            }
                                          }}
                                          onBlur={() => {
                                            // Ensure value is rounded to increment on blur
                                            if (
                                              item.distance_km !== null &&
                                              item.distance_km > 0
                                            ) {
                                              const rounded =
                                                Math.round(
                                                  item.distance_km /
                                                    distanceIncrement,
                                                ) * distanceIncrement
                                              const nextValue = Math.max(
                                                distanceIncrement,
                                                rounded,
                                              )
                                              if (
                                                nextValue !== item.distance_km
                                              ) {
                                                updateItem(group.id, item.id, {
                                                  distance_km: nextValue,
                                                })
                                              }
                                            }
                                            if (
                                              item.distance_km !== null &&
                                              item.distance_km <
                                                distanceIncrement
                                            ) {
                                              updateItem(group.id, item.id, {
                                                distance_km: distanceIncrement,
                                              })
                                            }
                                          }}
                                          placeholder="Distance"
                                          style={{ width: 80 }}
                                        />
                                        <Flex
                                          direction="column"
                                          gap="1"
                                          style={{ alignSelf: 'stretch' }}
                                        >
                                          <IconButton
                                            size="1"
                                            variant="soft"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustDistance(distanceIncrement)
                                            }}
                                            style={{
                                              width: 20,
                                              height: 18,
                                              padding: 0,
                                            }}
                                          >
                                            <NavArrowUp
                                              width={12}
                                              height={12}
                                            />
                                          </IconButton>
                                          <IconButton
                                            size="1"
                                            variant="soft"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustDistance(-distanceIncrement)
                                            }}
                                            style={{
                                              width: 20,
                                              height: 18,
                                              padding: 0,
                                            }}
                                          >
                                            <NavArrowDown
                                              width={12}
                                              height={12}
                                            />
                                          </IconButton>
                                        </Flex>
                                      </Flex>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    {readOnly ? (
                                      <Text>{item.days_used ?? 'Auto'}</Text>
                                    ) : (
                                      <TextField.Root
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={
                                          daysUsedDrafts[item.id] ??
                                          String(item.days_used ?? derivedDays)
                                        }
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setDaysUsedDrafts((prev) => ({
                                            ...prev,
                                            [item.id]: nextValue,
                                          }))

                                          if (nextValue === '') return
                                          const parsed = Number(nextValue)
                                          if (Number.isNaN(parsed)) return

                                          updateItem(group.id, item.id, {
                                            days_used: Math.max(1, parsed),
                                          })
                                          setDaysUsedDrafts((prev) => {
                                            const next = { ...prev }
                                            delete next[item.id]
                                            return next
                                          })
                                        }}
                                        onBlur={() => {
                                          if (daysUsedDrafts[item.id] === '') {
                                            updateItem(group.id, item.id, {
                                              days_used: null,
                                            })
                                            setDaysUsedDrafts((prev) => {
                                              const next = { ...prev }
                                              delete next[item.id]
                                              return next
                                            })
                                          }
                                        }}
                                        placeholder={String(derivedDays)}
                                        style={{ width: 90 }}
                                      />
                                    )}
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    {readOnly ? (
                                      <Text>
                                        {item.start_date
                                          ? new Date(
                                              item.start_date,
                                            ).toLocaleDateString('nb-NO')
                                          : '—'}
                                      </Text>
                                    ) : (
                                      <DatePicker
                                        value={item.start_date}
                                        onChange={(value) =>
                                          updateItem(group.id, item.id, {
                                            start_date: value,
                                          })
                                        }
                                      />
                                    )}
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    {readOnly ? (
                                      <Text>
                                        {item.end_date
                                          ? new Date(
                                              item.end_date,
                                            ).toLocaleDateString('nb-NO')
                                          : '—'}
                                      </Text>
                                    ) : (
                                      <DatePicker
                                        value={item.end_date}
                                        onChange={(value) =>
                                          updateItem(group.id, item.id, {
                                            end_date: value,
                                          })
                                        }
                                      />
                                    )}
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    <Flex direction="column" gap="1">
                                      <TextField.Root
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                          dailyRateDrafts[item.id] ??
                                          (item.daily_rate == null
                                            ? ''
                                            : String(item.daily_rate))
                                        }
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setDailyRateDrafts((prev) => ({
                                            ...prev,
                                            [item.id]: nextValue,
                                          }))

                                          if (nextValue === '') return
                                          const parsed = Number(nextValue)
                                          if (Number.isNaN(parsed)) return

                                          updateItem(group.id, item.id, {
                                            daily_rate: Math.max(0, parsed),
                                          })
                                          setDailyRateDrafts((prev) => {
                                            const next = { ...prev }
                                            delete next[item.id]
                                            return next
                                          })
                                        }}
                                        onBlur={() => {
                                          if (dailyRateDrafts[item.id] === '') {
                                            // Reset to default when cleared.
                                            updateItem(group.id, item.id, {
                                              daily_rate:
                                                companyDailyRate ?? null,
                                            })
                                            setDailyRateDrafts((prev) => {
                                              const next = { ...prev }
                                              delete next[item.id]
                                              return next
                                            })
                                          }
                                        }}
                                        style={{ width: 72 }}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly &&
                                        companyDailyRate !== null &&
                                        !isUsingDefaultDailyRate && (
                                          <Text
                                            size="1"
                                            color="gray"
                                            style={{ fontStyle: 'italic' }}
                                          >
                                            Default:{' '}
                                            {formatCurrency(companyDailyRate)}
                                            /day
                                          </Text>
                                        )}
                                    </Flex>
                                  </Table.Cell>
                                  <Table.Cell
                                    style={{ verticalAlign: 'middle' }}
                                  >
                                    <Flex direction="column" gap="1">
                                      <TextField.Root
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                          distanceRateDrafts[item.id] ??
                                          (item.distance_rate == null
                                            ? ''
                                            : String(item.distance_rate))
                                        }
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setDistanceRateDrafts((prev) => ({
                                            ...prev,
                                            [item.id]: nextValue,
                                          }))

                                          if (nextValue === '') return
                                          const parsed = Number(nextValue)
                                          if (Number.isNaN(parsed)) return

                                          updateItem(group.id, item.id, {
                                            distance_rate: Math.max(0, parsed),
                                          })
                                          setDistanceRateDrafts((prev) => {
                                            const next = { ...prev }
                                            delete next[item.id]
                                            return next
                                          })
                                        }}
                                        onBlur={() => {
                                          if (
                                            distanceRateDrafts[item.id] === ''
                                          ) {
                                            // Reset to default when cleared.
                                            updateItem(group.id, item.id, {
                                              distance_rate:
                                                companyDistanceRate ?? null,
                                            })
                                            setDistanceRateDrafts((prev) => {
                                              const next = { ...prev }
                                              delete next[item.id]
                                              return next
                                            })
                                          }
                                        }}
                                        style={{ width: 72 }}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly &&
                                        !isUsingDefaultDistanceRate &&
                                        companyDistanceRate !== null && (
                                          <Text
                                            size="1"
                                            color="gray"
                                            style={{ fontStyle: 'italic' }}
                                          >
                                            Default:{' '}
                                            {formatCurrency(
                                              companyDistanceRate,
                                            )}{' '}
                                            / {distanceIncrement}km
                                          </Text>
                                        )}
                                    </Flex>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>{formatCurrency(total)}</Text>
                                  </Table.Cell>
                                  {!readOnly && (
                                    <Table.Cell align="right">
                                      <Button
                                        size="1"
                                        variant="soft"
                                        color="red"
                                        onClick={() =>
                                          deleteItem(group.id, item.id)
                                        }
                                      >
                                        <Trash width={14} height={14} />
                                      </Button>
                                    </Table.Cell>
                                  )}
                                </SortableEquipmentRow>
                              )
                            })}
                          </Table.Body>
                        )

                        if (readOnly) return body

                        return (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={({ active, over }) => {
                              if (!over || active.id === over.id) return
                              const oldIndex = itemIds.indexOf(
                                String(active.id),
                              )
                              const newIndex = itemIds.indexOf(String(over.id))
                              if (oldIndex < 0 || newIndex < 0) return
                              const moved = arrayMove(
                                sortedItems,
                                oldIndex,
                                newIndex,
                              ).map((it, idx) => ({
                                ...it,
                                sort_order: idx,
                              }))
                              const movedById = new Map(
                                moved.map((it) => [it.id, it]),
                              )
                              onGroupsChange(
                                groups.map((g) =>
                                  g.id !== group.id
                                    ? g
                                    : {
                                        ...g,
                                        items: g.items.map(
                                          (it) => movedById.get(it.id) ?? it,
                                        ),
                                      },
                                ),
                              )
                            }}
                          >
                            <SortableContext
                              items={itemIds}
                              strategy={verticalListSortingStrategy}
                            >
                              {body}
                            </SortableContext>
                          </DndContext>
                        )
                      })()}
                    </Table.Root>
                  )

                  return (
                    <SortableEquipmentGroupCard
                      key={group.id}
                      id={group.id}
                      disabled={readOnly}
                    >
                      {({ handle }) => (
                        <Box
                          style={{
                            border: '1px solid var(--gray-a6)',
                            borderRadius: 8,
                            overflow: 'hidden',
                          }}
                        >
                          <Flex
                            align="center"
                            justify="between"
                            p="3"
                            style={{
                              background: 'var(--gray-a2)',
                              borderBottom: '1px solid var(--gray-a6)',
                            }}
                          >
                            <Flex align="center" gap="2">
                              {handle}
                              {readOnly ? (
                                <Text weight="medium">{group.group_name}</Text>
                              ) : (
                                <Flex align="center" gap="2">
                                  <TextField.Root
                                    value={group.group_name}
                                    onChange={(e) =>
                                      updateGroup(group.id, {
                                        group_name: e.target.value,
                                      })
                                    }
                                    style={{ width: 220 }}
                                  />
                                  <Flex gap="1" wrap="wrap">
                                    {transportGroupNameSuggestions.map((s) => (
                                      <Button
                                        key={s}
                                        size="1"
                                        variant="soft"
                                        color="gray"
                                        onClick={() =>
                                          updateGroup(group.id, {
                                            group_name: s,
                                          })
                                        }
                                        disabled={
                                          group.group_name
                                            .trim()
                                            .toLowerCase() === s.toLowerCase()
                                        }
                                      >
                                        {s}
                                      </Button>
                                    ))}
                                  </Flex>
                                </Flex>
                              )}
                              {!readOnly && (
                                <Button
                                  size="1"
                                  variant="soft"
                                  onClick={() => addItemToGroup(group.id)}
                                >
                                  <Plus width={14} height={14} /> Add item
                                </Button>
                              )}
                            </Flex>

                            <Flex align="center" gap="2">
                              <Text size="2" weight="medium">
                                {formatCurrency(groupTotal)}
                              </Text>
                              {!readOnly && (
                                <Button
                                  size="1"
                                  variant="soft"
                                  color="red"
                                  onClick={() => deleteGroup(group.id)}
                                >
                                  <Trash width={14} height={14} />
                                </Button>
                              )}
                            </Flex>
                          </Flex>

                          <Box p="3">
                            {table}
                            {!readOnly && group.items.length === 0 && (
                              <Box
                                mt="3"
                                p="4"
                                style={{
                                  border: '2px dashed var(--gray-a6)',
                                  borderRadius: 8,
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 100ms',
                                }}
                                onClick={() => addItemToGroup(group.id)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor =
                                    'var(--gray-a8)'
                                  e.currentTarget.style.background =
                                    'var(--gray-a2)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor =
                                    'var(--gray-a6)'
                                  e.currentTarget.style.background =
                                    'transparent'
                                }}
                              >
                                <Flex direction="column" align="center" gap="2">
                                  <Plus width={24} height={24} />
                                  <Text size="2" color="gray">
                                    Add transport item
                                  </Text>
                                </Flex>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}
                    </SortableEquipmentGroupCard>
                  )
                })}
              </Flex>
            )

            if (readOnly) return list

            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={({ active, over }) => {
                  if (!over || active.id === over.id) return
                  const oldIndex = groupIds.indexOf(String(active.id))
                  const newIndex = groupIds.indexOf(String(over.id))
                  if (oldIndex < 0 || newIndex < 0) return
                  const moved = arrayMove(sortedGroups, oldIndex, newIndex).map(
                    (g, idx) => ({ ...g, sort_order: idx }),
                  )
                  onGroupsChange(moved)
                }}
              >
                <SortableContext
                  items={groupIds}
                  strategy={verticalListSortingStrategy}
                >
                  {list}
                </SortableContext>
              </DndContext>
            )
          })()}
        </Box>
      )}

      {/* Always show empty state box at bottom */}
      <Box
        p="4"
        style={{
          border: '2px dashed var(--gray-a6)',
          borderRadius: 8,
          textAlign: 'center',
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 100ms',
        }}
        onClick={readOnly ? undefined : addGroup}
        onMouseEnter={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }
        }}
        onMouseLeave={(e) => {
          if (!readOnly) {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <Flex direction="column" align="center" gap="2">
          {!readOnly && <Plus width={24} height={24} />}
          <Text size="2" color="gray">
            {readOnly ? 'No transport groups yet' : 'Add transport group'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}
