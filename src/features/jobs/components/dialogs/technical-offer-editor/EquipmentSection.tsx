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
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight, Plus, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { AnimatedQuickSuggestions } from '@shared/ui/components/AnimatedQuickSuggestions'
import { escapeForPostgrestOr } from './utils'
import { ItemSearchField } from './ItemSearchField'
import { SortableEquipmentGroupCard, SortableEquipmentRow } from './sortable'
import type { LocalEquipmentGroup, LocalEquipmentItem } from './types'

export function EquipmentSection({
  groups,
  onGroupsChange,
  expandedGroups,
  onExpandedGroupsChange,
  companyId,
  equipmentDaysOfUse,
  equipmentRentalFactor,
  readOnly = false,
}: {
  groups: Array<LocalEquipmentGroup>
  onGroupsChange: (groups: Array<LocalEquipmentGroup>) => void
  expandedGroups: Set<string>
  onExpandedGroupsChange: (groups: Set<string>) => void
  companyId: string
  equipmentDaysOfUse: number
  equipmentRentalFactor: number
  readOnly?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Track search state per group
  const [searchTerms, setSearchTerms] = React.useState<Map<string, string>>(
    new Map(),
  )
  const [activeSearchGroupId, setActiveSearchGroupId] = React.useState<
    string | null
  >(null)
  const [quantityDrafts, setQuantityDrafts] = React.useState<
    Record<string, string>
  >({})
  const [unitPriceDrafts, setUnitPriceDrafts] = React.useState<
    Record<string, string>
  >({})
  const [searchResults, setSearchResults] = React.useState<
    Array<{
      id: string
      name: string
      is_group: boolean
      on_hand: number | null
      price: number | null
      item_kind: 'stock' | 'subrental'
      brand_name: string | null
      model: string | null
    }>
  >([])
  const groupItemsCacheRef = React.useRef<
    Map<
      string,
      Array<{
        id: string
        name: string
        brand_name: string | null
        model: string | null
        quantity: number
      }>
    >
  >(new Map())
  const groupsRef = React.useRef(groups)
  const [expandedGroupItems, setExpandedGroupItems] = React.useState<
    Set<string>
  >(new Set())
  const [focusedGroupNameId, setFocusedGroupNameId] = React.useState<
    string | null
  >(null)

  const groupNameSuggestions = ['Audio', 'Lights', 'Rigging', 'AV', 'General']

  React.useEffect(() => {
    groupsRef.current = groups
  }, [groups])

  // Get search term for a specific group
  const getSearchTerm = (groupId: string) => {
    return searchTerms.get(groupId) || ''
  }

  // Set search term for a specific group
  const setSearchTerm = (groupId: string, term: string) => {
    const newTerms = new Map(searchTerms)
    newTerms.set(groupId, term)
    setSearchTerms(newTerms)
    setActiveSearchGroupId(groupId) // Track which group is being searched
  }

  // Search for items
  const searchItems = React.useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }

      const termSafe = escapeForPostgrestOr(term)
      const { data, error } = await supabase
        .from('inventory_index')
        .select(
          `
          id,
          name,
          is_group,
          on_hand,
          current_price,
          item_kind,
          brand_name,
          model
        `,
        )
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .or('is_group.eq.true,allow_individual_booking.eq.true')
        .or(
          `name.ilike.%${termSafe}%,category_name.ilike.%${termSafe}%,brand_name.ilike.%${termSafe}%,model.ilike.%${termSafe}%,nicknames.ilike.%${termSafe}%`,
        )
        .limit(20)

      if (error) {
        console.error('Search error:', error)
        return
      }

      setSearchResults(
        data.map((r: any) => {
          return {
            id: r.id,
            name: r.name,
            is_group: !!r.is_group,
            on_hand: r.on_hand != null ? Number(r.on_hand) : null,
            price: r.current_price ?? null,
            item_kind: (r.item_kind ?? 'stock') as 'stock' | 'subrental',
            brand_name: r.brand_name ?? null,
            model: r.model ?? null,
          }
        }),
      )
    },
    [companyId],
  )

  const addGroup = () => {
    const newGroup: LocalEquipmentGroup = {
      id: `temp-${Date.now()}`,
      group_name: '',
      sort_order: groups.length,
      items: [],
    }
    onGroupsChange([...groups, newGroup])
    onExpandedGroupsChange(new Set([...expandedGroups, newGroup.id]))
  }

  const updateGroup = (
    groupId: string,
    updates: Partial<LocalEquipmentGroup>,
  ) => {
    onGroupsChange(
      groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    )
  }

  const deleteGroup = (groupId: string) => {
    onGroupsChange(groups.filter((g) => g.id !== groupId))
    const next = new Set(expandedGroups)
    next.delete(groupId)
    onExpandedGroupsChange(next)
  }

  const addItemToGroup = (groupId: string, itemId?: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    const selectedItem = searchResults.find((r) => r.id === itemId)
    if (!selectedItem) return
    const isGroup = selectedItem.is_group
    const newItem: LocalEquipmentItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      item_id: isGroup ? null : itemId || null,
      group_id: isGroup ? itemId || null : null,
      quantity: 1,
      unit_price: selectedItem.price ?? 0,
      is_internal: selectedItem.item_kind === 'stock',
      sort_order: group.items.length,
      item: !isGroup
        ? {
            id: selectedItem.id,
            name: selectedItem.name,
            item_kind: selectedItem.item_kind,
            brand: selectedItem.brand_name
              ? { id: 'temp', name: selectedItem.brand_name }
              : null,
            model: selectedItem.model ?? null,
          }
        : null,
      group: isGroup
        ? {
            id: selectedItem.id,
            name: selectedItem.name,
            item_kind: selectedItem.item_kind,
          }
        : null,
    }

    updateGroup(groupId, {
      items: [...group.items, newItem],
    })
    setSearchTerm(groupId, '')
    setActiveSearchGroupId(null)
    setSearchResults([])

    if (isGroup && itemId) {
      void loadGroupItems(itemId, groupId, newItem.id)
    }
  }

  const addCustomLineToGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    const newItem: LocalEquipmentItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      item_id: null,
      group_id: null,
      custom_line_description: '',
      custom_line_brand: '',
      custom_line_model: '',
      quantity: 1,
      unit_price: 0,
      is_internal: true,
      sort_order: group.items.length,
    }

    updateGroup(groupId, {
      items: [...group.items, newItem],
    })
  }

  // Derive active search term for dependency tracking
  const activeSearchTerm = React.useMemo(() => {
    if (!activeSearchGroupId) return ''
    return searchTerms.get(activeSearchGroupId) || ''
  }, [activeSearchGroupId, searchTerms])

  // Search effect - trigger search when active group's search term changes
  React.useEffect(() => {
    if (!activeSearchGroupId) {
      if (activeSearchTerm.trim() === '') {
        setSearchResults([])
      }
      return
    }

    if (!activeSearchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(() => {
      // Double-check the term hasn't changed and we're still on the same group
      const currentTerm = searchTerms.get(activeSearchGroupId) || ''
      if (
        activeSearchGroupId &&
        currentTerm.trim() === activeSearchTerm.trim()
      ) {
        searchItems(activeSearchTerm.trim())
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [activeSearchGroupId, activeSearchTerm, searchTerms, searchItems])

  const updateItem = (
    groupId: string,
    itemId: string,
    updates: Partial<LocalEquipmentItem>,
  ) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    })
  }

  const applyGroupItems = (
    groupId: string,
    groupItemId: string,
    groupItems: Array<{
      id: string
      name: string
      brand_name: string | null
      model: string | null
      quantity: number
    }>,
  ) => {
    const currentGroups = groupsRef.current
    const group = currentGroups.find((g) => g.id === groupId)
    if (!group) return

    onGroupsChange(
      currentGroups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              items: g.items.map((item) =>
                item.id === groupItemId
                  ? { ...item, group_items: groupItems }
                  : item,
              ),
            },
      ),
    )
  }

  const loadGroupItems = React.useCallback(
    async (groupId: string, targetGroupId: string, groupItemId: string) => {
      const cached = groupItemsCacheRef.current.get(groupId)
      if (cached) {
        applyGroupItems(targetGroupId, groupItemId, cached)
        return
      }

      const { data, error } = await supabase
        .from('group_items')
        .select(
          `
          item_id,
          quantity,
          item:items (
            id,
            name,
            model,
            brand:item_brands ( id, name )
          )
        `,
        )
        .eq('group_id', groupId)

      if (error) {
        console.error('Failed to load group items:', error)
        return
      }

      const groupItems = data.map((row: any) => {
        const rawItem = Array.isArray(row.item) ? row.item[0] : row.item
        const rawBrand = rawItem?.brand
        const brand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand
        return {
          id: rawItem?.id ?? row.item_id,
          name: rawItem?.name ?? 'Unknown item',
          brand_name: brand?.name ?? null,
          model: rawItem?.model ?? null,
          quantity: row.quantity ?? 1,
        }
      })

      groupItemsCacheRef.current.set(groupId, groupItems)
      applyGroupItems(targetGroupId, groupItemId, groupItems)
    },
    [],
  )

  const toggleGroupItems = (itemId: string) => {
    setExpandedGroupItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  React.useEffect(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.group_id && !item.group_items) {
          void loadGroupItems(item.group_id, group.id, item.id)
        }
      }
    }
  }, [groups, loadGroupItems])

  const deleteItem = (groupId: string, itemId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.filter((item) => item.id !== itemId),
    })
  }

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups)
    if (next.has(groupId)) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    onExpandedGroupsChange(next)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex
      direction="column"
      gap="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex justify="between" align="center" style={{ flexShrink: 0 }}>
        <Heading size="3">Equipment</Heading>
        {!readOnly && (
          <Button size="2" onClick={addGroup}>
            <Plus width={16} height={16} /> Add Group
          </Button>
        )}
      </Flex>

      <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
        Equipment totals are calculated as unit price × qty × rental factor (
        {equipmentDaysOfUse} day{equipmentDaysOfUse === 1 ? '' : 's'} →{' '}
        {equipmentRentalFactor.toFixed(2)}x).
      </Text>

      {groups.length > 0 && (
        <Flex direction="column" gap="2">
          {(() => {
            const sortedGroups = [...groups].sort(
              (a, b) => a.sort_order - b.sort_order,
            )
            const groupIds = sortedGroups.map((g) => g.id)

            const list = (
              <>
                {sortedGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.id)
                  const groupTotal = group.items.reduce(
                    (sum, item) =>
                      sum +
                      item.unit_price * item.quantity * equipmentRentalFactor,
                    0,
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
                          <Box
                            p="3"
                            style={{
                              background: 'var(--gray-a2)',
                              cursor: 'pointer',
                            }}
                            onClick={() => toggleGroup(group.id)}
                          >
                            <Flex align="center" justify="between">
                              <Flex align="center" gap="2">
                                {handle}
                                {isExpanded ? (
                                  <NavArrowDown width={18} height={18} />
                                ) : (
                                  <NavArrowRight width={18} height={18} />
                                )}
                                <TextField.Root
                                  value={group.group_name}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    updateGroup(group.id, {
                                      group_name: e.target.value,
                                    })
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => {
                                    e.stopPropagation()
                                    setFocusedGroupNameId(group.id)
                                  }}
                                  onBlur={() =>
                                    setFocusedGroupNameId((prev) =>
                                      prev === group.id ? null : prev,
                                    )
                                  }
                                  placeholder="Enter group name"
                                  style={{ width: 200 }}
                                  readOnly={readOnly}
                                />
                                <Text size="2" color="gray">
                                  ({group.items.length} items)
                                </Text>
                              </Flex>
                              <Flex align="center" gap="3">
                                <Text weight="medium">
                                  {formatCurrency(groupTotal)}
                                </Text>
                                {!readOnly && (
                                  <Button
                                    size="1"
                                    variant="soft"
                                    color="red"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteGroup(group.id)
                                    }}
                                  >
                                    <Trash width={14} height={14} />
                                  </Button>
                                )}
                              </Flex>
                            </Flex>
                            {!readOnly && (
                              <AnimatedQuickSuggestions
                                suggestions={groupNameSuggestions}
                                open={focusedGroupNameId === group.id}
                                staticOpen={!group.group_name}
                                label="Group name suggestions:"
                                showLabel
                                stopPropagation
                                onSelect={(suggestion) =>
                                  updateGroup(group.id, {
                                    group_name: suggestion,
                                  })
                                }
                                onAfterSelect={() =>
                                  setFocusedGroupNameId(null)
                                }
                              />
                            )}
                          </Box>

                          {isExpanded && (
                            <Box p="3" style={{ background: 'var(--gray-a1)' }}>
                              {/* Search for items */}
                              {!readOnly && (
                                <Flex
                                  gap="2"
                                  align="center"
                                  mb="3"
                                  style={{ width: '100%' }}
                                >
                                  <Box
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      width: '100%',
                                    }}
                                  >
                                    <ItemSearchField
                                      searchTerm={getSearchTerm(group.id)}
                                      onSearchChange={(term) =>
                                        setSearchTerm(group.id, term)
                                      }
                                      searchResults={
                                        activeSearchGroupId === group.id
                                          ? searchResults
                                          : []
                                      }
                                      onSelectItem={(itemId) =>
                                        addItemToGroup(group.id, itemId)
                                      }
                                      formatCurrency={formatCurrency}
                                      compact
                                    />
                                  </Box>
                                  <Button
                                    size="2"
                                    variant="soft"
                                    color="gray"
                                    style={{ flexShrink: 0 }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addCustomLineToGroup(group.id)
                                    }}
                                  >
                                    <Plus width={14} height={14} />
                                    Add custom line
                                  </Button>
                                </Flex>
                              )}

                              {/* Items table */}
                              {group.items.length > 0 ? (
                                <Table.Root variant="surface" size="1">
                                  <Table.Header>
                                    <Table.Row>
                                      {!readOnly && (
                                        <Table.ColumnHeaderCell
                                          style={{ width: 34 }}
                                        />
                                      )}
                                      <Table.ColumnHeaderCell>
                                        Item
                                      </Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>
                                        Brand
                                      </Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>
                                        Model
                                      </Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>
                                        Qty
                                      </Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>
                                        Unit Price (/day)
                                      </Table.ColumnHeaderCell>
                                      <Table.ColumnHeaderCell>
                                        Total
                                      </Table.ColumnHeaderCell>
                                      {!readOnly && <Table.ColumnHeaderCell />}
                                    </Table.Row>
                                  </Table.Header>
                                  {(() => {
                                    const sortedItems = [...group.items].sort(
                                      (a, b) => a.sort_order - b.sort_order,
                                    )
                                    const itemIds = sortedItems.map(
                                      (it) => it.id,
                                    )

                                    const body = (
                                      <Table.Body>
                                        {sortedItems.map((item) => {
                                          const isGroupExpanded =
                                            expandedGroupItems.has(item.id)
                                          const isCustomLine =
                                            !item.item && !item.group
                                          return (
                                            <React.Fragment key={item.id}>
                                              <SortableEquipmentRow
                                                id={item.id}
                                                disabled={readOnly}
                                              >
                                                <Table.Cell>
                                                  {isCustomLine ? (
                                                    <TextField.Root
                                                      value={
                                                        item.custom_line_description ??
                                                        ''
                                                      }
                                                      onChange={(e) =>
                                                        updateItem(
                                                          group.id,
                                                          item.id,
                                                          {
                                                            custom_line_description:
                                                              e.target.value,
                                                          },
                                                        )
                                                      }
                                                      placeholder="Description (e.g. one-off fee)"
                                                      style={{ minWidth: 180 }}
                                                      readOnly={readOnly}
                                                    />
                                                  ) : (
                                                    <Flex
                                                      align="center"
                                                      gap="2"
                                                      wrap="wrap"
                                                    >
                                                      {item.group && (
                                                        <IconButton
                                                          variant="ghost"
                                                          size="1"
                                                          onClick={() =>
                                                            toggleGroupItems(
                                                              item.id,
                                                            )
                                                          }
                                                          style={{
                                                            width: 20,
                                                            height: 20,
                                                            padding: 0,
                                                          }}
                                                        >
                                                          {isGroupExpanded ? (
                                                            <NavArrowDown
                                                              width={12}
                                                              height={12}
                                                            />
                                                          ) : (
                                                            <NavArrowRight
                                                              width={12}
                                                              height={12}
                                                            />
                                                          )}
                                                        </IconButton>
                                                      )}
                                                      <Text>
                                                        {item.item?.name ||
                                                          item.group?.name ||
                                                          '—'}
                                                      </Text>
                                                      {item.group ? (
                                                        <Badge
                                                          size="1"
                                                          variant="soft"
                                                          color="gray"
                                                        >
                                                          Group
                                                        </Badge>
                                                      ) : null}
                                                      {item.group?.item_kind ===
                                                        'subrental' ||
                                                      item.item?.item_kind ===
                                                        'subrental' ? (
                                                        <Badge
                                                          size="1"
                                                          variant="soft"
                                                          color="amber"
                                                        >
                                                          Subrental
                                                        </Badge>
                                                      ) : (
                                                        <Badge
                                                          size="1"
                                                          variant="soft"
                                                          color="indigo"
                                                        >
                                                          Stock
                                                        </Badge>
                                                      )}
                                                    </Flex>
                                                  )}
                                                </Table.Cell>
                                                <Table.Cell>
                                                  {isCustomLine ? (
                                                    <TextField.Root
                                                      value={
                                                        item.custom_line_brand ??
                                                        ''
                                                      }
                                                      onChange={(e) =>
                                                        updateItem(
                                                          group.id,
                                                          item.id,
                                                          {
                                                            custom_line_brand:
                                                              e.target.value,
                                                          },
                                                        )
                                                      }
                                                      placeholder="Brand"
                                                      style={{ minWidth: 100 }}
                                                      readOnly={readOnly}
                                                    />
                                                  ) : (
                                                    <Text>
                                                      {item.item?.brand?.name ??
                                                        '—'}
                                                    </Text>
                                                  )}
                                                </Table.Cell>
                                                <Table.Cell>
                                                  {isCustomLine ? (
                                                    <TextField.Root
                                                      value={
                                                        item.custom_line_model ??
                                                        ''
                                                      }
                                                      onChange={(e) =>
                                                        updateItem(
                                                          group.id,
                                                          item.id,
                                                          {
                                                            custom_line_model:
                                                              e.target.value,
                                                          },
                                                        )
                                                      }
                                                      placeholder="Model"
                                                      style={{ minWidth: 100 }}
                                                      readOnly={readOnly}
                                                    />
                                                  ) : (
                                                    <Text>
                                                      {item.item?.model ?? '—'}
                                                    </Text>
                                                  )}
                                                </Table.Cell>
                                                <Table.Cell>
                                                  <TextField.Root
                                                    type="number"
                                                    min="1"
                                                    value={
                                                      quantityDrafts[item.id] ??
                                                      String(item.quantity)
                                                    }
                                                    onChange={(e) => {
                                                      const nextValue =
                                                        e.target.value
                                                      setQuantityDrafts(
                                                        (prev) => ({
                                                          ...prev,
                                                          [item.id]: nextValue,
                                                        }),
                                                      )

                                                      if (nextValue === '')
                                                        return
                                                      const parsed =
                                                        Number(nextValue)
                                                      if (Number.isNaN(parsed))
                                                        return

                                                      updateItem(
                                                        group.id,
                                                        item.id,
                                                        {
                                                          quantity: Math.max(
                                                            1,
                                                            parsed,
                                                          ),
                                                        },
                                                      )
                                                      setQuantityDrafts(
                                                        (prev) => {
                                                          const next = {
                                                            ...prev,
                                                          }
                                                          delete next[item.id]
                                                          return next
                                                        },
                                                      )
                                                    }}
                                                    onBlur={() => {
                                                      if (
                                                        quantityDrafts[
                                                          item.id
                                                        ] === ''
                                                      ) {
                                                        setQuantityDrafts(
                                                          (prev) => {
                                                            const next = {
                                                              ...prev,
                                                            }
                                                            delete next[item.id]
                                                            return next
                                                          },
                                                        )
                                                      }
                                                    }}
                                                    style={{ width: 80 }}
                                                    readOnly={readOnly}
                                                  />
                                                </Table.Cell>
                                                <Table.Cell>
                                                  <TextField.Root
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                      unitPriceDrafts[
                                                        item.id
                                                      ] ??
                                                      String(item.unit_price)
                                                    }
                                                    onChange={(e) => {
                                                      const nextValue =
                                                        e.target.value
                                                      setUnitPriceDrafts(
                                                        (prev) => ({
                                                          ...prev,
                                                          [item.id]: nextValue,
                                                        }),
                                                      )

                                                      if (nextValue === '')
                                                        return
                                                      const parsed =
                                                        Number(nextValue)
                                                      if (Number.isNaN(parsed))
                                                        return

                                                      updateItem(
                                                        group.id,
                                                        item.id,
                                                        {
                                                          unit_price: Math.max(
                                                            0,
                                                            parsed,
                                                          ),
                                                        },
                                                      )
                                                      setUnitPriceDrafts(
                                                        (prev) => {
                                                          const next = {
                                                            ...prev,
                                                          }
                                                          delete next[item.id]
                                                          return next
                                                        },
                                                      )
                                                    }}
                                                    onBlur={() => {
                                                      if (
                                                        unitPriceDrafts[
                                                          item.id
                                                        ] === ''
                                                      ) {
                                                        setUnitPriceDrafts(
                                                          (prev) => {
                                                            const next = {
                                                              ...prev,
                                                            }
                                                            delete next[item.id]
                                                            return next
                                                          },
                                                        )
                                                      }
                                                    }}
                                                    style={{ width: 120 }}
                                                    readOnly={readOnly}
                                                  />
                                                </Table.Cell>
                                                <Table.Cell>
                                                  <Text>
                                                    {formatCurrency(
                                                      item.unit_price *
                                                        item.quantity *
                                                        equipmentRentalFactor,
                                                    )}
                                                  </Text>
                                                </Table.Cell>
                                                {!readOnly && (
                                                  <Table.Cell align="right">
                                                    <Button
                                                      size="1"
                                                      variant="soft"
                                                      color="red"
                                                      onClick={() =>
                                                        deleteItem(
                                                          group.id,
                                                          item.id,
                                                        )
                                                      }
                                                    >
                                                      <Trash
                                                        width={14}
                                                        height={14}
                                                      />
                                                    </Button>
                                                  </Table.Cell>
                                                )}
                                              </SortableEquipmentRow>
                                              {item.group &&
                                                isGroupExpanded &&
                                                item.group_items?.map(
                                                  (groupItem) => {
                                                    const totalQty =
                                                      groupItem.quantity *
                                                      item.quantity
                                                    return (
                                                      <Table.Row
                                                        key={`${item.id}-group-${groupItem.id}`}
                                                        style={{
                                                          background:
                                                            'var(--gray-a2)',
                                                          opacity: 0.75,
                                                        }}
                                                      >
                                                        {!readOnly && (
                                                          <Table.Cell />
                                                        )}
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                            style={{
                                                              paddingLeft: 16,
                                                            }}
                                                          >
                                                            {groupItem.name}
                                                          </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                          >
                                                            {groupItem.brand_name ??
                                                              '—'}
                                                          </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                          >
                                                            {groupItem.model ??
                                                              '—'}
                                                          </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                          >
                                                            {totalQty}
                                                          </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                          >
                                                            Included
                                                          </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                          <Text
                                                            size="1"
                                                            color="gray"
                                                          >
                                                            Included
                                                          </Text>
                                                        </Table.Cell>
                                                        {!readOnly && (
                                                          <Table.Cell />
                                                        )}
                                                      </Table.Row>
                                                    )
                                                  },
                                                )}
                                            </React.Fragment>
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
                                          if (!over || active.id === over.id)
                                            return
                                          const oldIndex = itemIds.indexOf(
                                            String(active.id),
                                          )
                                          const newIndex = itemIds.indexOf(
                                            String(over.id),
                                          )
                                          if (oldIndex < 0 || newIndex < 0)
                                            return
                                          const moved = arrayMove(
                                            sortedItems,
                                            oldIndex,
                                            newIndex,
                                          ).map((it, idx) => ({
                                            ...it,
                                            sort_order: idx,
                                          }))
                                          updateGroup(group.id, {
                                            items: moved,
                                          })
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
                              ) : (
                                <Text size="2" color="gray">
                                  No items in this group. Search above to add
                                  items.
                                </Text>
                              )}
                            </Box>
                          )}
                        </Box>
                      )}
                    </SortableEquipmentGroupCard>
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
        </Flex>
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
            {readOnly ? 'No equipment groups yet' : 'Add equipment group'}
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}
