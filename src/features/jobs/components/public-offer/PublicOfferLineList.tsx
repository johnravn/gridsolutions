import { Flex, Text } from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { normalizeTransportGroups } from '../../utils/transportGroups'
import type { ReactNode } from 'react'
import type {
  GroupContentEntry,
  OfferCrewItem,
  OfferDetail,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../../types'

function PublicOfferLine({
  title,
  meta,
  amount,
  nested = false,
  depth = 0,
  muted = false,
  total = false,
  expandable = false,
  expanded = false,
  onToggle,
}: {
  title: ReactNode
  meta?: ReactNode
  amount?: ReactNode
  nested?: boolean
  depth?: number
  muted?: boolean
  total?: boolean
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const paddingLeft = nested ? 12 + depth * 16 : 12

  return (
    <div
      className={[
        'public-offer-line',
        expandable ? 'public-offer-line--toggle' : '',
        total ? 'public-offer-line--total' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-expanded={expandable ? expanded : undefined}
      onClick={expandable ? onToggle : undefined}
      onKeyDown={
        expandable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggle?.()
              }
            }
          : undefined
      }
      style={{ paddingLeft }}
    >
      <div style={{ minWidth: 0 }}>
        <Flex align="center" gap="2">
          {expandable ? (
            expanded ? (
              <NavArrowDown width={16} height={16} />
            ) : (
              <NavArrowRight width={16} height={16} />
            )
          ) : null}
          <Text
            size="2"
            weight={total ? 'bold' : 'medium'}
            color={muted ? 'gray' : undefined}
          >
            {title}
          </Text>
        </Flex>
        {meta ? (
          <Text as="div" size="1" color="gray" mt="1">
            {meta}
          </Text>
        ) : null}
      </div>
      {amount != null ? (
        <Text
          size="2"
          weight={total ? 'bold' : 'medium'}
          color={muted ? 'gray' : undefined}
          style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
        >
          {amount}
        </Text>
      ) : null}
    </div>
  )
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter((part) => part && part !== '—').join(' · ')
}

function EquipmentGroupContents({
  entries,
  parentQuantity,
  showPrices,
  expandedItemGroupKeys,
  onToggleExpanded,
  rowKeyPrefix,
  depth = 0,
}: {
  entries: Array<GroupContentEntry>
  parentQuantity: number
  showPrices: boolean
  expandedItemGroupKeys: Set<string>
  onToggleExpanded: (key: string) => void
  rowKeyPrefix: string
  depth?: number
}) {
  return (
    <>
      {entries.map((entry, index) => {
        const key = `${rowKeyPrefix}-${index}`
        if (entry.type === 'item') {
          const qty = entry.quantity * parentQuantity
          return (
            <PublicOfferLine
              key={key}
              nested
              depth={depth}
              muted
              title={entry.name}
              meta={joinMeta([entry.brand_name, entry.model, `Qty ${qty}`])}
              amount={showPrices ? 'Included' : undefined}
            />
          )
        }

        const isNestedExpanded = expandedItemGroupKeys.has(key)
        const hasNested = entry.items.length > 0
        return (
          <div key={key}>
            <PublicOfferLine
              nested
              depth={depth}
              muted
              expandable={hasNested}
              expanded={isNestedExpanded}
              onToggle={() => onToggleExpanded(key)}
              title={`${entry.name} (Group)`}
              meta={`Qty ${entry.quantity * parentQuantity}`}
              amount={showPrices ? 'Included' : undefined}
            />
            {hasNested && isNestedExpanded ? (
              <EquipmentGroupContents
                entries={entry.items}
                parentQuantity={parentQuantity * entry.quantity}
                showPrices={showPrices}
                expandedItemGroupKeys={expandedItemGroupKeys}
                onToggleExpanded={onToggleExpanded}
                rowKeyPrefix={key}
                depth={depth + 1}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function EquipmentItemBlock({
  item,
  offerGroupId,
  showPrices,
  formatCurrency,
  expandedItemGroupKeys,
  onToggleExpanded,
  rowKeyPrefix,
}: {
  item: OfferEquipmentItem
  offerGroupId: string
  showPrices: boolean
  formatCurrency: (n: number) => string
  expandedItemGroupKeys: Set<string>
  onToggleExpanded: (key: string) => void
  rowKeyPrefix?: string
}) {
  const baseKey = rowKeyPrefix ?? `${offerGroupId}-${item.id}`
  const isCustomLine = !item.item && !item.group
  const isGroup = !!item.group
  const hasContents =
    isGroup && item.group_contents && item.group_contents.length > 0
  const isExpanded = Boolean(hasContents && expandedItemGroupKeys.has(baseKey))

  const title = isCustomLine
    ? item.custom_line_description?.trim() || 'Custom line'
    : isGroup
      ? `${item.group?.name ?? 'Group'} (Group)`
      : item.item?.name || 'Unknown Item'

  const brand = isCustomLine
    ? item.custom_line_brand?.trim() || null
    : (item.item?.brand?.name ?? null)
  const model = isCustomLine
    ? item.custom_line_model?.trim() || null
    : (item.item?.model ?? null)

  return (
    <div>
      <PublicOfferLine
        expandable={Boolean(hasContents)}
        expanded={isExpanded}
        onToggle={() => onToggleExpanded(baseKey)}
        title={title}
        muted={isCustomLine && !item.custom_line_description}
        meta={joinMeta([brand, model, `Qty ${item.quantity}`])}
        amount={showPrices ? formatCurrency(item.total_price) : undefined}
      />
      {isGroup && isExpanded && item.group_contents ? (
        <EquipmentGroupContents
          entries={item.group_contents}
          parentQuantity={item.quantity}
          showPrices={showPrices}
          expandedItemGroupKeys={expandedItemGroupKeys}
          onToggleExpanded={onToggleExpanded}
          rowKeyPrefix={baseKey}
        />
      ) : null}
    </div>
  )
}

export function PublicOfferEquipmentLines({
  items,
  offerGroupId,
  showPrices,
  formatCurrency,
  expandedItemGroupKeys,
  onToggleExpanded,
  groupTotal,
}: {
  items: Array<OfferEquipmentItem>
  offerGroupId: string
  showPrices: boolean
  formatCurrency: (n: number) => string
  expandedItemGroupKeys: Set<string>
  onToggleExpanded: (key: string) => void
  groupTotal: number
}) {
  return (
    <div className="public-offer-lines">
      {items.map((item) => (
        <EquipmentItemBlock
          key={item.id}
          item={item}
          offerGroupId={offerGroupId}
          showPrices={showPrices}
          formatCurrency={formatCurrency}
          expandedItemGroupKeys={expandedItemGroupKeys}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
      <PublicOfferLine
        total
        title="Total"
        amount={formatCurrency(groupTotal)}
      />
    </div>
  )
}

export function PublicOfferCrewLines({
  items,
  formatCurrency,
  formatDateTimeShort,
  formatDuration,
}: {
  items: Array<OfferCrewItem>
  formatCurrency: (n: number) => string
  formatDateTimeShort: (dateString: string | null) => string
  formatDuration: (startString: string, endString: string) => string
}) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0)

  return (
    <div className="public-offer-lines">
      {items.map((item) => (
        <PublicOfferLine
          key={item.id}
          title={item.role_title}
          meta={joinMeta([
            `${item.crew_count}×`,
            formatDuration(item.start_date, item.end_date),
            formatDateTimeShort(item.start_date),
          ])}
          amount={formatCurrency(item.total_price)}
        />
      ))}
      <PublicOfferLine total title="Total" amount={formatCurrency(total)} />
    </div>
  )
}

function formatVehicleCategory(
  category: OfferTransportItem['vehicle_category'],
): string {
  if (!category) return '—'
  const map: Record<string, string> = {
    passenger_car_small: 'Passenger Car - Small',
    passenger_car_medium: 'Passenger Car - Medium',
    passenger_car_big: 'Passenger Car - Big',
    van_small: 'Van - Small',
    van_medium: 'Van - Medium',
    van_big: 'Van - Big',
    C1: 'C1',
    C1E: 'C1E',
    C: 'C',
    CE: 'CE',
  }
  return map[category] || category
}

function formatTransportDays(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  )
    return '–'
  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  )
  return `${days} day${days !== 1 ? 's' : ''}`
}

export function PublicOfferTransportLines({
  offer,
  showPrices,
  formatCurrency,
  formatDateTimeShort,
}: {
  offer: Pick<OfferDetail, 'transport_groups' | 'transport_items'>
  showPrices: boolean
  formatCurrency: (n: number) => string
  formatDateTimeShort: (dateString: string | null) => string
}) {
  const groups = normalizeTransportGroups(offer)
  const transportTotal = groups.reduce(
    (sum, group) =>
      sum +
      group.items.reduce((itemSum, item) => itemSum + item.total_price, 0),
    0,
  )

  return (
    <Flex direction="column" gap="4">
      {groups.map((group) => {
        const groupTotal = group.items.reduce(
          (sum, item) => sum + item.total_price,
          0,
        )
        return (
          <div key={group.id}>
            <Flex justify="between" align="center" mb="2">
              <Text size="3" weight="medium">
                {group.group_name || 'Transport'}
              </Text>
              {showPrices ? (
                <Text weight="medium">{formatCurrency(groupTotal)}</Text>
              ) : null}
            </Flex>
            <div className="public-offer-lines">
              {group.items.map((item) => (
                <PublicOfferLine
                  key={item.id}
                  title={formatVehicleCategory(item.vehicle_category)}
                  meta={joinMeta([
                    item.distance_km != null ? `${item.distance_km} km` : null,
                    formatDateTimeShort(item.start_date),
                    formatTransportDays(item.start_date, item.end_date),
                  ])}
                  amount={
                    showPrices ? formatCurrency(item.total_price) : undefined
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
      <PublicOfferLine
        total
        title="Total"
        amount={formatCurrency(transportTotal)}
      />
    </Flex>
  )
}
