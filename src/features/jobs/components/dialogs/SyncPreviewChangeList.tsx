import * as React from 'react'
import { Badge, Box, Flex, Text } from '@radix-ui/themes'
import {
  Community,
  NavArrowDown,
  NavArrowRight,
  Package,
  Truck,
} from 'iconoir-react'
import { JobBookingRecap } from '../JobBookingRecap'
import type { JobBookingSummary } from '../../utils/bookingSummary'
import type {
  SyncPreviewCompact,
  SyncPreviewCrew,
  SyncPreviewItem,
  SyncPreviewLine,
  SyncPreviewOfferGroup,
} from '../../utils/offerBookingDiff'

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

function ExpandHeader({
  expanded,
  title,
  countLabel,
  icon,
  disabled = false,
}: {
  expanded: boolean
  title: string
  countLabel?: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Flex align="center" gap="2" wrap="wrap">
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
}: {
  title: string
  countLabel?: string
  icon?: React.ReactNode
  hasContent: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = React.useState(false)
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
}: {
  item: SyncPreviewItem
  nested?: boolean
}) {
  return (
    <Box pl={nested ? '4' : '0'} py="1">
      <Text size="2" weight="medium" as="div">
        {item.name}
      </Text>
      <Text size="1" color="gray" as="div">
        {itemMeta(item)}
      </Text>
    </Box>
  )
}

function InventoryGroupLine({
  line,
  sectionKey,
}: {
  line: Extract<SyncPreviewLine, { kind: 'group' }>
  sectionKey: string
}) {
  const [expanded, setExpanded] = React.useState(false)

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
}: {
  group: SyncPreviewOfferGroup
  sectionKey: string
}) {
  return (
    <CollapsibleBox title={group.name} hasContent={group.lines.length > 0}>
      {group.lines.map((line) =>
        line.kind === 'direct' ? (
          <PreviewItemRow key={line.item.key} item={line.item} />
        ) : (
          <InventoryGroupLine
            key={`${sectionKey}:${line.group_id}`}
            line={line}
            sectionKey={`${sectionKey}:${group.id}`}
          />
        ),
      )}
    </CollapsibleBox>
  )
}

function UngroupedBlock({
  items,
  title,
}: {
  items: Array<SyncPreviewItem>
  title: string
}) {
  if (items.length === 0) return null

  return (
    <CollapsibleBox
      title={title}
      countLabel={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      hasContent
    >
      {items.map((item) => (
        <PreviewItemRow key={item.key} item={item} />
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

function CrewRoleBlock({ row }: { row: SyncPreviewCrew }) {
  return (
    <CollapsibleBox
      title={row.title}
      countLabel={row.quantity > 1 ? `${row.quantity}×` : undefined}
      hasContent
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
}: {
  category: string
  roles: Array<SyncPreviewCrew>
}) {
  const totalQuantity = roles.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <CollapsibleBox
      title={category}
      countLabel={totalQuantity > 0 ? `${totalQuantity}×` : undefined}
      hasContent={roles.length > 0}
    >
      {roles.map((row) => (
        <CrewRoleBlock key={row.key} row={row} />
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
}: {
  title: string
  compact: SyncPreviewCompact
  groups: Array<SyncPreviewOfferGroup>
  ungrouped: Array<SyncPreviewItem>
  ungroupedTitle: string
  extraSummary?: string | null
  crew?: Array<SyncPreviewCrew>
}) {
  const [expanded, setExpanded] = React.useState(false)
  const summary = asBookingSummary(compact)
  const crewRows = crew ?? []
  const hasEquipment = groups.length > 0 || ungrouped.length > 0
  const hasCrew = crewRows.length > 0
  const hasTransport = compact.vehicleNames.length > 0 || !!extraSummary
  const hasDetail = hasEquipment || hasCrew || hasTransport

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
          <CollapsibleBox
            title="Equipment"
            icon={<Package width={16} height={16} />}
            countLabel={equipmentSummary || 'None'}
            hasContent={hasEquipment}
          >
            {groups.map((group) => (
              <OfferGroupBlock
                key={group.id}
                group={group}
                sectionKey={title}
              />
            ))}
            <UngroupedBlock items={ungrouped} title={ungroupedTitle} />
          </CollapsibleBox>

          <CollapsibleBox
            title="Crew"
            icon={<Community width={16} height={16} />}
            countLabel={crewSummary || 'None'}
            hasContent={hasCrew}
          >
            {groupCrewByCategory(crewRows).map((group) => (
              <CrewCategoryBlock
                key={group.category}
                category={group.category}
                roles={group.roles}
              />
            ))}
          </CollapsibleBox>

          <CollapsibleBox
            title="Transport"
            icon={<Truck width={16} height={16} />}
            countLabel={transportSummary || extraSummary || 'None'}
            hasContent={hasTransport}
          >
            {compact.vehicleNames.map((name) => (
              <Text key={name} size="2" weight="medium" as="div">
                {name}
              </Text>
            ))}
            {extraSummary ? (
              <Text size="1" color="gray" as="div">
                {extraSummary}
              </Text>
            ) : null}
          </CollapsibleBox>
        </Flex>
      ) : null}
    </Box>
  )
}
