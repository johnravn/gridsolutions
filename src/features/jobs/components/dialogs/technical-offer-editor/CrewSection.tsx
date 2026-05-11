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
import { Badge, Box, Button, Flex, Heading, Text, TextField } from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight, Plus, Trash } from 'iconoir-react'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import type { LocalCrewItem } from './types'
import { calculateHoursPerDay } from './utils'
import { SortableCrewCard } from './sortable'

export function CrewSection({
  items,
  onItemsChange,
  companyId: _companyId,
  readOnly = false,
  jobStartAt,
  jobEndAt,
  defaultRatePerDay,
  defaultRatePerHour,
  defaultBillingUnit = 'hour',
  defaultsLoading = false,
}: {
  items: Array<LocalCrewItem>
  onItemsChange: (items: Array<LocalCrewItem>) => void
  companyId: string
  readOnly?: boolean
  jobStartAt?: string | null
  jobEndAt?: string | null
  defaultRatePerDay?: number | null
  defaultRatePerHour?: number | null
  defaultBillingUnit?: 'day' | 'hour'
  defaultsLoading?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set(),
  )
  const [countDrafts, setCountDrafts] = React.useState<Record<string, string>>(
    {},
  )
  const [dailyRateDrafts, setDailyRateDrafts] = React.useState<
    Record<string, string>
  >({})
  const [roleCategoryDrafts, setRoleCategoryDrafts] = React.useState<
    Record<string, string>
  >({})

  const roleSuggestions = [
    'Technician',
    'Loader',
    'FOH',
    'Monitors',
    'Hands',
    'Driver',
  ]

  const categorySuggestions = ['Audio', 'Lights', 'AV', 'Transport', 'Rigging']

  const getRoleCategoryValue = (item: LocalCrewItem) => {
    if (Object.prototype.hasOwnProperty.call(roleCategoryDrafts, item.id)) {
      return roleCategoryDrafts[item.id] ?? ''
    }
    return item.role_category ?? ''
  }

  // Group items by category
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string | null, Array<LocalCrewItem>>()
    const noCategory: Array<LocalCrewItem> = []

    for (const item of items) {
      const cat = item.role_category || null
      if (!cat) {
        noCategory.push(item)
      } else {
        const existing = groups.get(cat) || []
        existing.push(item)
        groups.set(cat, existing)
      }
    }

    // Convert map to sorted array: no category first, then sorted categories
    const result: Array<{
      category: string | null
      items: Array<LocalCrewItem>
    }> = []
    if (noCategory.length > 0) {
      result.push({ category: null, items: noCategory })
    }

    const sortedCategories = Array.from(groups.keys()).sort()
    for (const cat of sortedCategories) {
      result.push({ category: cat, items: groups.get(cat)! })
    }

    return result
  }, [items])

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const addItem = () => {
    // Default to job duration if available, otherwise use current time + 1 day
    // This ensures times default to the job length (start_at to end_at)
    const startDate = jobStartAt ? new Date(jobStartAt) : new Date()
    const endDate = jobEndAt
      ? new Date(jobEndAt)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000) // +1 day if no job end

    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    const hasProvidedWindow = Boolean(jobStartAt && jobEndAt)
    const computedHours = calculateHoursPerDay(startIso, endIso)
    const hoursPerDay = hasProvidedWindow ? (computedHours ?? 8) : 8

    let newItem: LocalCrewItem
    if (defaultBillingUnit === 'day') {
      const dailyRate = defaultRatePerDay ?? 0
      newItem = {
        id: `temp-${Date.now()}`,
        role_title: '',
        crew_count: 1,
        start_date: startIso,
        end_date: endIso,
        daily_rate: dailyRate,
        hourly_rate: null,
        hours_per_day: null,
        billing_type: 'daily',
        sort_order: items.length,
        role_category: null,
      }
    } else {
      const hourlyRate = defaultRatePerHour ?? 0
      const dailyRate = hourlyRate * hoursPerDay
      newItem = {
        id: `temp-${Date.now()}`,
        role_title: '',
        crew_count: 1,
        start_date: startIso,
        end_date: endIso,
        daily_rate: dailyRate,
        hourly_rate: hourlyRate,
        hours_per_day: hoursPerDay,
        billing_type: 'hourly',
        sort_order: items.length,
        role_category: null,
      }
    }
    onItemsChange([...items, newItem])
    setExpandedItems((prev) => new Set([...prev, newItem.id]))
  }

  const normalizeCrewItem = (item: LocalCrewItem): LocalCrewItem => {
    if (item.billing_type === 'hourly') {
      const computedHours =
        calculateHoursPerDay(item.start_date, item.end_date) ??
        (item.hours_per_day != null ? Math.max(0, item.hours_per_day) : null) ??
        0
      const normalizedHourly = Math.max(
        0,
        item.hourly_rate != null ? item.hourly_rate : (defaultRatePerHour ?? 0),
      )
      return {
        ...item,
        hours_per_day: computedHours,
        hourly_rate: normalizedHourly,
        daily_rate: normalizedHourly * computedHours,
      }
    }

    return {
      ...item,
      hourly_rate: null,
      hours_per_day: null,
      daily_rate: Math.max(0, item.daily_rate),
    }
  }

  const updateItem = (itemId: string, updates: Partial<LocalCrewItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === itemId ? normalizeCrewItem({ ...item, ...updates }) : item,
      ),
    )
  }

  const commitRoleCategory = (itemId: string) => {
    if (!Object.prototype.hasOwnProperty.call(roleCategoryDrafts, itemId))
      return
    const raw = roleCategoryDrafts[itemId] ?? ''
    const normalized = raw.trim()
    updateItem(itemId, {
      role_category: normalized ? normalized.toLowerCase() : null,
    })
    setRoleCategoryDrafts((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const deleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Crew</Heading>
        {!readOnly && (
          <Button
            size="2"
            onClick={addItem}
            disabled={defaultsLoading}
            title={defaultsLoading ? 'Loading customer pricing…' : undefined}
          >
            <Plus width={16} height={16} /> Add Crew Item
          </Button>
        )}
      </Flex>

      {items.length > 0 && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedItems.map((group) => (
            <Box key={group.category || 'no-category'}>
              {group.category && (
                <Heading
                  size="4"
                  mb="2"
                  style={{ textTransform: 'capitalize' }}
                >
                  {group.category}
                </Heading>
              )}
              <Box
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {(() => {
                  const sortedItems = [...group.items].sort(
                    (a, b) => a.sort_order - b.sort_order,
                  )
                  const itemIds = sortedItems.map((it) => it.id)

                  const list = (
                    <>
                      {sortedItems.map((item) => {
                        const isExpanded = expandedItems.has(item.id)
                        const days = Math.ceil(
                          (new Date(item.end_date).getTime() -
                            new Date(item.start_date).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )
                        const total =
                          item.daily_rate * item.crew_count * Math.max(1, days)
                        const computedHoursPerDay =
                          item.billing_type === 'hourly'
                            ? (item.hours_per_day ??
                              calculateHoursPerDay(
                                item.start_date,
                                item.end_date,
                              ) ??
                              0)
                            : null
                        const formattedHoursPerDay =
                          computedHoursPerDay != null
                            ? Number(computedHoursPerDay.toFixed(2))
                            : null
                        const displayHourlyRate =
                          item.billing_type === 'hourly'
                            ? (item.hourly_rate ?? defaultRatePerHour ?? 0)
                            : null

                        return (
                          <SortableCrewCard
                            key={item.id}
                            id={item.id}
                            disabled={readOnly}
                          >
                            {({ handle }) => (
                              <Box
                                p="3"
                                style={{
                                  border: '1px solid var(--gray-a6)',
                                  borderRadius: 8,
                                  background: 'var(--gray-a2)',
                                }}
                              >
                                <Box
                                  style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                  onClick={() => toggleItem(item.id)}
                                >
                                  <Flex align="center" gap="2">
                                    {handle}
                                    {isExpanded ? (
                                      <NavArrowDown width={18} height={18} />
                                    ) : (
                                      <NavArrowRight width={18} height={18} />
                                    )}
                                    <Text weight="bold">
                                      {item.role_title || '—'}
                                    </Text>
                                    <Text size="2" color="gray">
                                      ({item.crew_count} crew
                                      {item.crew_count !== 1 ? 's' : ''})
                                    </Text>
                                    <Text size="2" color="gray">
                                      • {formatCurrency(total)}
                                    </Text>
                                  </Flex>
                                  {!readOnly && (
                                    <Button
                                      size="1"
                                      variant="soft"
                                      color="red"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteItem(item.id)
                                      }}
                                    >
                                      <Trash width={14} height={14} />
                                    </Button>
                                  )}
                                </Box>

                                {isExpanded && (
                                  <Box
                                    mt="3"
                                    pt="3"
                                    style={{
                                      borderTop: '1px solid var(--gray-a6)',
                                    }}
                                  >
                                    <Flex direction="column" gap="3">
                                      <Flex gap="3" wrap="wrap">
                                        {/* Role Title */}
                                        <Box style={{ flex: '1 1 260px' }}>
                                          <Text size="2" color="gray" mb="1">
                                            Role Title
                                          </Text>
                                          <TextField.Root
                                            value={item.role_title}
                                            onChange={(e) =>
                                              updateItem(item.id, {
                                                role_title: e.target.value,
                                              })
                                            }
                                            placeholder="e.g., Technician"
                                            readOnly={readOnly}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          {!readOnly && !item.role_title && (
                                            <Flex gap="2" wrap="wrap" mt="2">
                                              <Text
                                                size="1"
                                                color="gray"
                                                style={{ width: '100%' }}
                                              >
                                                Quick suggestions:
                                              </Text>
                                              {roleSuggestions.map(
                                                (suggestion) => (
                                                  <Button
                                                    key={suggestion}
                                                    size="1"
                                                    variant="soft"
                                                    color="gray"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      updateItem(item.id, {
                                                        role_title: suggestion,
                                                      })
                                                    }}
                                                  >
                                                    {suggestion}
                                                  </Button>
                                                ),
                                              )}
                                            </Flex>
                                          )}
                                        </Box>

                                        {/* Role Category */}
                                        <Box style={{ flex: '1 1 220px' }}>
                                          <Text size="2" color="gray" mb="1">
                                            Role Category
                                          </Text>
                                          <TextField.Root
                                            placeholder="e.g. Audio, Lights, AV"
                                            value={getRoleCategoryValue(item)}
                                            onChange={(e) => {
                                              const nextValue = e.target.value
                                              setRoleCategoryDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: nextValue,
                                              }))
                                            }}
                                            onBlur={() =>
                                              commitRoleCategory(item.id)
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                commitRoleCategory(item.id)
                                              }
                                            }}
                                            readOnly={readOnly}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          {!readOnly && (
                                            <Flex gap="2" wrap="wrap" mt="2">
                                              <Text
                                                size="1"
                                                color="gray"
                                                style={{ width: '100%' }}
                                              >
                                                Quick suggestions:
                                              </Text>
                                              {categorySuggestions.map(
                                                (suggestion) => (
                                                  <Button
                                                    key={suggestion}
                                                    size="1"
                                                    variant="soft"
                                                    color="gray"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      updateItem(item.id, {
                                                        role_category:
                                                          suggestion.toLowerCase(),
                                                      })
                                                    }}
                                                  >
                                                    {suggestion}
                                                  </Button>
                                                ),
                                              )}
                                            </Flex>
                                          )}
                                        </Box>
                                      </Flex>

                                      {/* Rate Type */}
                                      <Box>
                                        <Text size="2" color="gray" mb="1">
                                          Rate Type
                                        </Text>
                                        {readOnly ? (
                                          <Badge
                                            size="1"
                                            variant="soft"
                                            color="gray"
                                          >
                                            {item.billing_type === 'hourly'
                                              ? 'Hourly rate'
                                              : 'Daily rate'}
                                          </Badge>
                                        ) : (
                                          <Flex gap="2">
                                            <Button
                                              size="1"
                                              variant={
                                                item.billing_type === 'daily'
                                                  ? 'classic'
                                                  : 'soft'
                                              }
                                              color={
                                                item.billing_type === 'daily'
                                                  ? 'blue'
                                                  : 'gray'
                                              }
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (
                                                  item.billing_type !== 'daily'
                                                ) {
                                                  const fallbackDaily =
                                                    Math.max(
                                                      0,
                                                      defaultRatePerDay ??
                                                        item.daily_rate,
                                                    )
                                                  updateItem(item.id, {
                                                    billing_type: 'daily',
                                                    daily_rate: fallbackDaily,
                                                  })
                                                }
                                              }}
                                            >
                                              Daily
                                            </Button>
                                            <Button
                                              size="1"
                                              variant={
                                                item.billing_type === 'hourly'
                                                  ? 'classic'
                                                  : 'soft'
                                              }
                                              color={
                                                item.billing_type === 'hourly'
                                                  ? 'blue'
                                                  : 'gray'
                                              }
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (
                                                  item.billing_type !== 'hourly'
                                                ) {
                                                  const computedHours =
                                                    calculateHoursPerDay(
                                                      item.start_date,
                                                      item.end_date,
                                                    ) ??
                                                    (item.hours_per_day &&
                                                    item.hours_per_day > 0
                                                      ? item.hours_per_day
                                                      : 8)
                                                  const baseHourly =
                                                    defaultRatePerHour ??
                                                    (item.hourly_rate != null &&
                                                    item.hourly_rate > 0
                                                      ? item.hourly_rate
                                                      : computedHours > 0
                                                        ? item.daily_rate /
                                                          computedHours
                                                        : 0)
                                                  const resolvedHourly =
                                                    Number.isFinite(baseHourly)
                                                      ? baseHourly
                                                      : 0

                                                  updateItem(item.id, {
                                                    billing_type: 'hourly',
                                                    hours_per_day:
                                                      computedHours,
                                                    hourly_rate: Math.max(
                                                      0,
                                                      resolvedHourly,
                                                    ),
                                                  })
                                                }
                                              }}
                                            >
                                              Hourly
                                            </Button>
                                          </Flex>
                                        )}
                                      </Box>

                                      {/* Details Grid */}
                                      <Flex gap="3" wrap="wrap">
                                        <Box style={{ minWidth: 120 }}>
                                          <Text size="2" color="gray" mb="1">
                                            Crew Count
                                          </Text>
                                          <TextField.Root
                                            type="number"
                                            min="1"
                                            value={
                                              countDrafts[item.id] ??
                                              String(item.crew_count)
                                            }
                                            onChange={(e) => {
                                              const nextValue = e.target.value
                                              setCountDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: nextValue,
                                              }))

                                              if (nextValue === '') return
                                              const parsed = Number(nextValue)
                                              if (Number.isNaN(parsed)) return

                                              updateItem(item.id, {
                                                crew_count: Math.max(1, parsed),
                                              })
                                              setCountDrafts((prev) => {
                                                const next = { ...prev }
                                                delete next[item.id]
                                                return next
                                              })
                                            }}
                                            onBlur={() => {
                                              if (countDrafts[item.id] === '') {
                                                setCountDrafts((prev) => {
                                                  const next = { ...prev }
                                                  delete next[item.id]
                                                  return next
                                                })
                                              }
                                            }}
                                            style={{ width: 120 }}
                                            readOnly={readOnly}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </Box>

                                        <Box style={{ minWidth: 200 }}>
                                          <Text size="2" color="gray" mb="1">
                                            Start Date
                                          </Text>
                                          {readOnly ? (
                                            <Text>
                                              {item.start_date
                                                ? new Date(
                                                    item.start_date,
                                                  ).toLocaleDateString('nb-NO')
                                                : '—'}
                                            </Text>
                                          ) : (
                                            <div
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <DateTimePicker
                                                value={item.start_date}
                                                onChange={(value) =>
                                                  updateItem(item.id, {
                                                    start_date: value,
                                                  })
                                                }
                                              />
                                            </div>
                                          )}
                                        </Box>

                                        <Box style={{ minWidth: 200 }}>
                                          <Text size="2" color="gray" mb="1">
                                            End Date
                                          </Text>
                                          {readOnly ? (
                                            <Text>
                                              {item.end_date
                                                ? new Date(
                                                    item.end_date,
                                                  ).toLocaleDateString('nb-NO')
                                                : '—'}
                                            </Text>
                                          ) : (
                                            <div
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <DateTimePicker
                                                value={item.end_date}
                                                onChange={(value) =>
                                                  updateItem(item.id, {
                                                    end_date: value,
                                                  })
                                                }
                                              />
                                            </div>
                                          )}
                                        </Box>

                                        {item.billing_type === 'daily' ? (
                                          <Box style={{ minWidth: 120 }}>
                                            <Text size="2" color="gray" mb="1">
                                              Daily Rate
                                            </Text>
                                            <TextField.Root
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={
                                                dailyRateDrafts[item.id] ??
                                                String(item.daily_rate)
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

                                                updateItem(item.id, {
                                                  daily_rate: Math.max(
                                                    0,
                                                    parsed,
                                                  ),
                                                })
                                                setDailyRateDrafts((prev) => {
                                                  const next = { ...prev }
                                                  delete next[item.id]
                                                  return next
                                                })
                                              }}
                                              onBlur={() => {
                                                if (
                                                  dailyRateDrafts[item.id] ===
                                                  ''
                                                ) {
                                                  setDailyRateDrafts((prev) => {
                                                    const next = { ...prev }
                                                    delete next[item.id]
                                                    return next
                                                  })
                                                }
                                              }}
                                              placeholder={
                                                defaultRatePerDay != null
                                                  ? String(defaultRatePerDay)
                                                  : undefined
                                              }
                                              style={{ width: 110 }}
                                              readOnly={readOnly}
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            />
                                          </Box>
                                        ) : (
                                          <>
                                            <Box style={{ minWidth: 120 }}>
                                              <Text
                                                size="2"
                                                color="gray"
                                                mb="1"
                                              >
                                                Hourly Rate
                                              </Text>
                                              <TextField.Root
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                  item.hourly_rate == null
                                                    ? ''
                                                    : String(item.hourly_rate)
                                                }
                                                onChange={(e) => {
                                                  const value = e.target.value
                                                  if (value === '') {
                                                    updateItem(item.id, {
                                                      hourly_rate: null,
                                                    })
                                                    return
                                                  }
                                                  updateItem(item.id, {
                                                    hourly_rate: Math.max(
                                                      0,
                                                      Number(value) || 0,
                                                    ),
                                                  })
                                                }}
                                                onBlur={() => {
                                                  if (
                                                    item.hourly_rate == null
                                                  ) {
                                                    updateItem(item.id, {
                                                      hourly_rate:
                                                        defaultRatePerHour ?? 0,
                                                    })
                                                  }
                                                }}
                                                placeholder={
                                                  defaultRatePerHour != null
                                                    ? String(defaultRatePerHour)
                                                    : undefined
                                                }
                                                style={{ width: 110 }}
                                                readOnly={readOnly}
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              />
                                              {!readOnly &&
                                                defaultRatePerHour != null && (
                                                  <Text
                                                    size="1"
                                                    color="gray"
                                                    style={{
                                                      fontStyle: 'italic',
                                                    }}
                                                    mt="1"
                                                  >
                                                    Default:{' '}
                                                    {formatCurrency(
                                                      defaultRatePerHour,
                                                    )}
                                                    /hour
                                                  </Text>
                                                )}
                                            </Box>
                                            <Box style={{ minWidth: 120 }}>
                                              <Text
                                                size="2"
                                                color="gray"
                                                mb="1"
                                              >
                                                Hours per Day
                                              </Text>
                                              <TextField.Root
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                value={
                                                  formattedHoursPerDay != null
                                                    ? formattedHoursPerDay.toFixed(
                                                        2,
                                                      )
                                                    : ''
                                                }
                                                style={{ width: 110 }}
                                                disabled
                                                readOnly
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              />
                                            </Box>
                                            <Box style={{ minWidth: 160 }}>
                                              <Text
                                                size="2"
                                                color="gray"
                                                mb="1"
                                              >
                                                Daily Equivalent
                                              </Text>
                                              <Flex direction="column" gap="1">
                                                <Text weight="medium">
                                                  {formatCurrency(
                                                    item.daily_rate,
                                                  )}
                                                </Text>
                                                <Text size="1" color="gray">
                                                  per day
                                                </Text>
                                              </Flex>
                                            </Box>
                                          </>
                                        )}
                                      </Flex>

                                      {/* Summary */}
                                      <Box
                                        p="2"
                                        style={{
                                          background: 'var(--gray-a3)',
                                          borderRadius: 4,
                                        }}
                                      >
                                        <Flex justify="between" align="center">
                                          <Text size="2" color="gray">
                                            {days} day{days !== 1 ? 's' : ''} ×{' '}
                                            {item.crew_count} crew
                                            {item.crew_count !== 1
                                              ? 's'
                                              : ''}{' '}
                                            {item.billing_type === 'hourly'
                                              ? `• ${(formattedHoursPerDay ?? 0).toFixed(2)}h/day @ ${formatCurrency(displayHourlyRate ?? 0)}/hour`
                                              : `• ${formatCurrency(item.daily_rate)}/day`}
                                          </Text>
                                          <Text weight="medium">
                                            Total: {formatCurrency(total)}
                                          </Text>
                                        </Flex>
                                      </Box>
                                    </Flex>
                                  </Box>
                                )}
                              </Box>
                            )}
                          </SortableCrewCard>
                        )
                      })}
                    </>
                  )

                  if (readOnly) return list

                  return (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={({ active, over }) => {
                        if (!over || active.id === over.id) return
                        const oldIndex = itemIds.indexOf(String(active.id))
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

                        // Merge back into full list while only affecting this category group.
                        const movedById = new Map(
                          moved.map((it) => [it.id, it]),
                        )
                        onItemsChange(items.map((it) => movedById.get(it.id) ?? it))
                      }}
                    >
                      <SortableContext
                        items={itemIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {list}
                      </SortableContext>
                    </DndContext>
                  )
                })()}
              </Box>
            </Box>
          ))}
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
        onClick={readOnly ? undefined : addItem}
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
            {readOnly ? 'No crew items yet' : 'Add crew item'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}

