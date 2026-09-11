import * as React from 'react'
import { Badge, Box, Flex, IconButton, Text } from '@radix-ui/themes'
import { useDraggable } from '@dnd-kit/core'
import {
  Community,
  DotsGrid3x3,
  NavArrowDown,
  NavArrowRight,
  Package,
  Truck,
} from 'iconoir-react'
import { JobBookingRecap } from '../JobBookingRecap'
import {
  syncPreviewEquipmentKeys,
  syncPreviewGroupKeys,
  syncPreviewLineKeys,
} from '../../utils/offerBookingDiff'
import type { JobBookingSummary } from '../../utils/bookingSummary'
import type {
  SyncIgnoreNode,
  SyncPreviewCompact,
  SyncPreviewCrew,
  SyncPreviewItem,
  SyncPreviewLine,
  SyncPreviewOfferGroup,
  SyncPreviewVehicle,
} from '../../utils/offerBookingDiff'

export type SyncPreviewDragColumn = 'left' | 'right'

export type SyncPreviewDragContext = {
  column: SyncPreviewDragColumn
  side: 'add' | 'remove'
  disabled?: boolean
}

function asBookingSummary(compact: SyncPreviewCompact): JobBookingSummary {
  return {
    hasEquipment: compact.equipmentByCategory.length > 0,
    hasVehicles: compact.vehicleNames.length > 0,
    equipmentByCategory: compact.equipmentByCategory,
    vehicleNames: compact.vehicleNames,
    crewLabels: compact.crewLabels,
  }
}

function itemMeta(item: SyncPreviewItem): string {
  const parts = [item.brand, item.model, `${item.quantity}×`].filter(
    (part): part is string => !!part && part.trim().length > 0,
  )
  return parts.join(' · ')
}

function toggleOnActivate(event: React.KeyboardEvent, toggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}

function DragHandle({
  id,
  node,
  disabled,
}: {
  id: string
  node: SyncIgnoreNode
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: node,
    disabled,
  })

  return (
    <IconButton
      ref={setNodeRef as React.Ref<HTMLButtonElement>}
      size="1"
      variant="ghost"
      color="gray"
      disabled={disabled}
      aria-label={`Move ${node.label}`}
      onClick={(event) => event.stopPropagation()}
      style={{
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
      }}
      {...attributes}
      {...listeners}
    >
      <DotsGrid3x3 width={14} height={14} />
    </IconButton>
  )
}

function ExpandHeader({
  expanded,
  title,
  countLabel,
  icon,
  disabled = false,
  leading,
}: {
  expanded: boolean
  title: string
  countLabel?: string
  icon?: React.ReactNode
  disabled?: boolean
  leading?: React.ReactNode
}) {
  return (
    <Flex align="center" gap="2" wrap="wrap">
      {leading}
      {disabled ? null : expanded ? (
        <NavArrowDown width={16} height={16} />
      ) : (
        <NavArrowRight width={16} height={16} />
      )}
      {icon ? (
        <Box
          style={{
            flexShrink: 0,
            color: disabled ? 'var(--gray-8)' : 'var(--accent-11)',
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Text size="2" weight="medium" color={disabled ? 'gray' : undefined}>
        {title}
      </Text>
      {countLabel ? (
        <Text size="1" color="gray">
          {countLabel}
        </Text>
      ) : null}
    </Flex>
  )
}

function CollapsibleBox({
  title,
  countLabel,
  icon,
  hasContent,
  children,
  leading,
  defaultExpanded = false,
}: {
  title: string
  countLabel?: string
  icon?: React.ReactNode
  hasContent: boolean
  children: React.ReactNode
  leading?: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const disabled = !hasContent

  return (
    <Box
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--gray-a1)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Box
        p="2"
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        aria-expanded={disabled ? undefined : expanded}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return
          setExpanded((value) => !value)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          toggleOnActivate(event, () => setExpanded((value) => !value))
        }}
        style={{
          background: 'var(--gray-a2)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderBottom:
            expanded && !disabled ? '1px solid var(--gray-a5)' : 'none',
        }}
      >
        <ExpandHeader
          expanded={expanded && !disabled}
          title={title}
          countLabel={countLabel}
          icon={icon}
          disabled={disabled}
          leading={leading}
        />
      </Box>
      {expanded && !disabled ? (
        <Flex direction="column" gap="2" p="2">
          {children}
        </Flex>
      ) : null}
    </Box>
  )
}

function PreviewItemRow({
  item,
  nested = false,
  drag,
}: {
  item: SyncPreviewItem
  nested?: boolean
  drag?: SyncPreviewDragContext
}) {
  return (
    <Box pl={nested ? '4' : '0'} py="1">
      <Flex align="start" gap="2">
        {drag ? (
          <DragHandle
            id={`${drag.column}:${drag.side}:item:${item.key}`}
            node={{
              side: drag.side,
              equipmentKeys: [item.key],
              crewKeys: [],
              transportKeys: [],
              label: item.name,
            }}
            disabled={drag.disabled}
          />
        ) : null}
        <Box>
          <Text size="2" weight="medium" as="div">
            {item.name}
          </Text>
          <Text size="1" color="gray" as="div">
            {itemMeta(item)}
          </Text>
        </Box>
      </Flex>
    </Box>
  )
}

function InventoryGroupLine({
  line,
  sectionKey,
  drag,
}: {
  line: Extract<SyncPreviewLine, { kind: 'group' }>
  sectionKey: string
  drag?: SyncPreviewDragContext
}) {
  const [expanded, setExpanded] = React.useState(false)
  const itemKeys = syncPreviewLineKeys(line)

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) =>
          toggleOnActivate(event, () => setExpanded((value) => !value))
        }
        style={{ cursor: 'pointer' }}
      >
        <Flex align="center" gap="2">
          {drag ? (
            <DragHandle
              id={`${drag.column}:${drag.side}:inv:${sectionKey}:${line.group_id}`}
              node={{
                side: drag.side,
                equipmentKeys: itemKeys,
                crewKeys: [],
                transportKeys: [],
                label: line.groupName,
              }}
              disabled={drag.disabled}
            />
          ) : null}
          {expanded ? (
            <NavArrowDown width={16} height={16} />
          ) : (
            <NavArrowRight width={16} height={16} />
          )}
          <Text size="2" weight="medium">
            {line.groupName}
          </Text>
          <Badge color="pink" variant="soft">
            Group
          </Badge>
          <Text size="1" color="gray">
            {line.quantity}×
          </Text>
        </Flex>
      </Box>
      {expanded ? (
        <Box mt="1">
          {line.items.map((item) => (
            <PreviewItemRow
              key={`${sectionKey}:${item.key}`}
              item={item}
              nested
              drag={drag}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

function OfferGroupBlock({
  group,
  sectionKey,
  drag,
}: {
  group: SyncPreviewOfferGroup
  sectionKey: string
  drag?: SyncPreviewDragContext
}) {
  const groupKeys = syncPreviewGroupKeys(group)
  return (
    <CollapsibleBox
      title={group.name}
      hasContent={group.lines.length > 0}
      leading={
        drag ? (
          <DragHandle
            id={`${drag.column}:${drag.side}:group:${group.id}`}
            node={{
              side: drag.side,
              equipmentKeys: groupKeys,
              crewKeys: [],
              transportKeys: [],
              label: group.name,
            }}
            disabled={drag.disabled}
          />
        ) : undefined
      }
    >
      {group.lines.map((line) =>
        line.kind === 'direct' ? (
          <PreviewItemRow key={line.item.key} item={line.item} drag={drag} />
        ) : (
          <InventoryGroupLine
            key={`${sectionKey}:${line.group_id}`}
            line={line}
            sectionKey={`${sectionKey}:${group.id}`}
            drag={drag}
          />
        ),
      )}
    </CollapsibleBox>
  )
}

function UngroupedBlock({
  items,
  title,
  drag,
}: {
  items: Array<SyncPreviewItem>
  title: string
  drag?: SyncPreviewDragContext
}) {
  if (items.length === 0) return null

  const itemKeys = items.map((item) => item.key)

  return (
    <CollapsibleBox
      title={title}
      countLabel={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      hasContent
      leading={
        drag ? (
          <DragHandle
            id={`${drag.column}:${drag.side}:ungrouped:${title}`}
            node={{
              side: drag.side,
              equipmentKeys: itemKeys,
              crewKeys: [],
              transportKeys: [],
              label: title,
            }}
            disabled={drag.disabled}
          />
        ) : undefined
      }
    >
      {items.map((item) => (
        <PreviewItemRow key={item.key} item={item} drag={drag} />
      ))}
    </CollapsibleBox>
  )
}

function formatCrewDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    }) + `, ${hours}:${minutes}`
  )
}

function displayCrewCategory(category: string | null | undefined): string {
  const name = category?.trim()
  if (!name) return 'Uncategorized'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function groupCrewByCategory(
  rows: Array<SyncPreviewCrew>,
): Array<{ category: string; roles: Array<SyncPreviewCrew> }> {
  const groups = new Map<string, Array<SyncPreviewCrew>>()
  for (const row of rows) {
    const category = displayCrewCategory(row.category)
    const list = groups.get(category) ?? []
    list.push(row)
    groups.set(category, list)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    .map(([category, roles]) => ({ category, roles }))
}

function CrewRoleBlock({
  row,
  drag,
}: {
  row: SyncPreviewCrew
  drag?: SyncPreviewDragContext
}) {
  return (
    <CollapsibleBox
      title={row.title}
      countLabel={row.quantity > 1 ? `${row.quantity}×` : undefined}
      hasContent
      leading={
        drag ? (
          <DragHandle
            id={`${drag.column}:${drag.side}:crew:${row.key}`}
            node={{
              side: drag.side,
              equipmentKeys: [],
              crewKeys: [row.key],
              transportKeys: [],
              label: row.title,
            }}
            disabled={drag.disabled}
          />
        ) : undefined
      }
    >
      <Text size="1" color="gray" as="div">
        {formatCrewDateTime(row.start_at)} – {formatCrewDateTime(row.end_at)}
      </Text>
      <Badge
        size="1"
        variant="soft"
        color={row.confirmedCount > 0 ? 'green' : 'gray'}
        style={{ alignSelf: 'flex-start' }}
      >
        {row.confirmedCount > 0
          ? row.confirmedCount === 1
            ? 'Confirmed'
            : `${row.confirmedCount} confirmed`
          : 'Not confirmed'}
      </Badge>
    </CollapsibleBox>
  )
}

function CrewCategoryBlock({
  category,
  roles,
  drag,
}: {
  category: string
  roles: Array<SyncPreviewCrew>
  drag?: SyncPreviewDragContext
}) {
  const totalQuantity = roles.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <CollapsibleBox
      title={category}
      countLabel={totalQuantity > 0 ? `${totalQuantity}×` : undefined}
      hasContent={roles.length > 0}
      leading={
        drag ? (
          <DragHandle
            id={`${drag.column}:${drag.side}:crew-cat:${category}`}
            node={{
              side: drag.side,
              equipmentKeys: [],
              crewKeys: roles.map((row) => row.key),
              transportKeys: [],
              label: category,
            }}
            disabled={drag.disabled}
          />
        ) : undefined
      }
    >
      {roles.map((row) => (
        <CrewRoleBlock key={row.key} row={row} drag={drag} />
      ))}
    </CollapsibleBox>
  )
}

export function SyncPreviewChangeList({
  title,
  compact,
  groups,
  ungrouped,
  ungroupedTitle,
  extraSummary,
  crew,
  vehicles,
  drag,
  defaultExpanded = false,
}: {
  title: string
  compact: SyncPreviewCompact
  groups: Array<SyncPreviewOfferGroup>
  ungrouped: Array<SyncPreviewItem>
  ungroupedTitle: string
  extraSummary?: string | null
  crew?: Array<SyncPreviewCrew>
  vehicles?: Array<SyncPreviewVehicle>
  drag?: SyncPreviewDragContext
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const summary = asBookingSummary(compact)
  const crewRows = crew ?? []
  const vehicleRows = vehicles ?? []
  const hasEquipment = groups.length > 0 || ungrouped.length > 0
  const hasCrew = crewRows.length > 0
  const hasTransport =
    vehicleRows.length > 0 || compact.vehicleNames.length > 0 || !!extraSummary
  const hasDetail = hasEquipment || hasCrew || hasTransport
  const equipmentKeys = syncPreviewEquipmentKeys(groups, ungrouped)
  const crewKeys = crewRows.map((row) => row.key)
  const transportKeys = vehicleRows.map((row) => row.key)

  const equipmentSummary = summary.equipmentByCategory
    .filter((row) => row.quantity > 0)
    .map((row) => `${row.quantity}× ${row.categoryName}`)
    .join(' · ')
  const crewSummary = compact.crewLabels.join(', ')
  const transportSummary = compact.vehicleNames.join(' · ')

  const toggle = () => {
    if (!hasDetail) return
    setExpanded((value) => !value)
  }

  return (
    <Box>
      <Box
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
        onClick={toggle}
        onKeyDown={(event) => {
          if (!hasDetail) return
          toggleOnActivate(event, toggle)
        }}
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <Flex align="center" gap="1">
          {drag && hasDetail ? (
            <DragHandle
              id={`${drag.column}:${drag.side}:section:${title}`}
              node={{
                side: drag.side,
                equipmentKeys,
                crewKeys,
                transportKeys,
                label: title,
              }}
              disabled={drag.disabled}
            />
          ) : null}
          {hasDetail ? (
            expanded ? (
              <NavArrowDown width={14} height={14} />
            ) : (
              <NavArrowRight width={14} height={14} />
            )
          ) : null}
          <Text size="2" weight="bold">
            {title}
          </Text>
        </Flex>

        {!expanded || !hasDetail ? (
          <Box mt="2" pl={hasDetail ? '4' : '0'}>
            <JobBookingRecap
              summary={summary}
              layout="inline"
              emptyMessage="None"
            />
          </Box>
        ) : null}
      </Box>

      {expanded && hasDetail ? (
        <Flex direction="column" gap="2" mt="3">
          {drag && hasDetail && drag.column === 'left' ? (
            <Text size="1" color="gray" as="div">
              Drag items or groups to the right to ignore them.
            </Text>
          ) : drag && hasDetail && drag.column === 'right' ? (
            <Text size="1" color="gray" as="div">
              Drag back to the left to include them in this sync.
            </Text>
          ) : null}
          {hasEquipment ? (
            <CollapsibleBox
              title="Equipment"
              icon={<Package width={16} height={16} />}
              countLabel={equipmentSummary || undefined}
              hasContent={hasEquipment}
              defaultExpanded={!!drag && hasEquipment}
              leading={
                drag ? (
                  <DragHandle
                    id={`${drag.column}:${drag.side}:equipment`}
                    node={{
                      side: drag.side,
                      equipmentKeys,
                      crewKeys: [],
                      transportKeys: [],
                      label: 'Equipment',
                    }}
                    disabled={drag.disabled}
                  />
                ) : undefined
              }
            >
              {groups.map((group) => (
                <OfferGroupBlock
                  key={group.id}
                  group={group}
                  sectionKey={title}
                  drag={drag}
                />
              ))}
              <UngroupedBlock
                items={ungrouped}
                title={ungroupedTitle}
                drag={drag}
              />
            </CollapsibleBox>
          ) : null}

          {hasCrew ? (
            <CollapsibleBox
              title="Crew"
              icon={<Community width={16} height={16} />}
              countLabel={crewSummary || undefined}
              hasContent={hasCrew}
              leading={
                drag ? (
                  <DragHandle
                    id={`${drag.column}:${drag.side}:crew-section`}
                    node={{
                      side: drag.side,
                      equipmentKeys: [],
                      crewKeys,
                      transportKeys: [],
                      label: 'Crew',
                    }}
                    disabled={drag.disabled}
                  />
                ) : undefined
              }
            >
              {groupCrewByCategory(crewRows).map((group) => (
                <CrewCategoryBlock
                  key={group.category}
                  category={group.category}
                  roles={group.roles}
                  drag={drag}
                />
              ))}
            </CollapsibleBox>
          ) : null}

          {hasTransport ? (
            <CollapsibleBox
              title="Transport"
              icon={<Truck width={16} height={16} />}
              countLabel={transportSummary || extraSummary || undefined}
              hasContent={hasTransport}
              leading={
                drag ? (
                  <DragHandle
                    id={`${drag.column}:${drag.side}:transport`}
                    node={{
                      side: drag.side,
                      equipmentKeys: [],
                      crewKeys: [],
                      transportKeys,
                      label: 'Transport',
                    }}
                    disabled={drag.disabled}
                  />
                ) : undefined
              }
            >
              {vehicleRows.map((vehicle) => (
                <Flex key={vehicle.key} align="center" gap="2">
                  {drag ? (
                    <DragHandle
                      id={`${drag.column}:${drag.side}:vehicle:${vehicle.key}`}
                      node={{
                        side: drag.side,
                        equipmentKeys: [],
                        crewKeys: [],
                        transportKeys: [vehicle.key],
                        label: vehicle.name,
                      }}
                      disabled={drag.disabled}
                    />
                  ) : null}
                  <Text size="2" weight="medium" as="div">
                    {vehicle.name}
                  </Text>
                </Flex>
              ))}
              {compact.vehicleNames.length > 0 && vehicleRows.length === 0
                ? compact.vehicleNames.map((name) => (
                    <Text key={name} size="2" weight="medium" as="div">
                      {name}
                    </Text>
                  ))
                : null}
              {extraSummary ? (
                <Text size="1" color="gray" as="div">
                  {extraSummary}
                </Text>
              ) : null}
            </CollapsibleBox>
          ) : null}
        </Flex>
      ) : null}
    </Box>
  )
}
