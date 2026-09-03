import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Badge, Box, Flex, Text } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { MOBILE_LIST_BOTTOM_PAD, MobilePageList } from '@app/layout/mobile'
import { IndexTableBodySkeleton } from '@shared/ui/index-table'
import {
  conflictInvolvesProjectLead,
  conflictJobsLine,
  conflictKindLabel,
  conflictListFooterLabel,
  conflictResourceName,
  conflictStatusLabel,
} from '../utils/conflictItems'
import type { ConflictCardItem } from '../utils/conflictItems'

export default function ConflictsList({
  items,
  selectedId,
  onSelect,
  loading,
  toolbarExtra,
  projectLeadJobIds,
}: {
  items: Array<ConflictCardItem>
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  toolbarExtra?: React.ReactNode
  projectLeadJobIds?: ReadonlyArray<string>
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const parentRef = React.useRef<HTMLDivElement>(null)
  const projectLeadIds = React.useMemo(
    () => new Set(projectLeadJobIds ?? []),
    [projectLeadJobIds],
  )
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
    getItemKey: (index) => items[index]?.key ?? index,
    enabled: items.length > 0 && !isMobile,
  })

  const renderItem = (
    item: ConflictCardItem,
    opts?: { fillHeight?: boolean },
  ) => {
    const isSelected = selectedId === item.key
    const isHovered = hoveredId === item.key
    const labelColor = item.tone === 'red' ? 'red' : 'amber'
    const showProjectLead = conflictInvolvesProjectLead(item, projectLeadIds)

    return (
      <Box
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        style={{
          cursor: 'pointer',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-3)',
          backgroundColor: isSelected
            ? 'var(--accent-3)'
            : isHovered
              ? 'var(--gray-2)'
              : 'transparent',
          border: isSelected
            ? '1px solid transparent'
            : isHovered
              ? '1px solid var(--gray-a6)'
              : '1px solid transparent',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          height: opts?.fillHeight ? '100%' : undefined,
        }}
        onClick={() => onSelect(item.key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(item.key)
          }
        }}
        onMouseEnter={() => setHoveredId(item.key)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <Flex align="start" justify="between" gap="2">
          <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
            <Text size="1" weight="medium" color={labelColor} as="div">
              {conflictStatusLabel(item.tone)} · {conflictKindLabel(item.kind)}
            </Text>
            <Text size="2" weight="bold" as="div">
              {conflictResourceName(item)}
            </Text>
            <Text size="1" color="gray" as="div">
              {conflictJobsLine(item)}
            </Text>
          </Flex>
          {showProjectLead ? (
            <Badge size="1" variant="soft" style={{ flexShrink: 0 }}>
              Project lead
            </Badge>
          ) : null}
        </Flex>
      </Box>
    )
  }

  const footer =
    items.length > 0 ? (
      <Flex align="center" mt="2">
        <Text size="2" color="gray">
          {conflictListFooterLabel(items.length)}
        </Text>
      </Flex>
    ) : null

  const loadingBody = (
    <Box p="3">
      <IndexTableBodySkeleton rowCount={6} rowHeight={80} />
    </Box>
  )

  if (loading) {
    return isMobile ? (
      <MobilePageList toolbar={toolbarExtra}>{loadingBody}</MobilePageList>
    ) : (
      loadingBody
    )
  }

  if (items.length === 0) {
    const empty = (
      <Box py="6">
        <Text color="gray" size="2" align="center">
          No booking conflicts.
        </Text>
      </Box>
    )
    return isMobile ? (
      <MobilePageList toolbar={toolbarExtra}>{empty}</MobilePageList>
    ) : (
      empty
    )
  }

  if (isMobile) {
    return (
      <MobilePageList toolbar={toolbarExtra}>
        <Flex
          direction="column"
          gap="2"
          style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
        >
          {items.map((item) => (
            <React.Fragment key={item.key}>{renderItem(item)}</React.Fragment>
          ))}
          {footer}
        </Flex>
      </MobilePageList>
    )
  }

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-2)',
      }}
    >
      <Box
        ref={parentRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index]
            if (!item) return null
            return (
              <div
                key={item.key}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderItem(item, { fillHeight: true })}
              </div>
            )
          })}
        </div>
      </Box>
      {footer}
    </Box>
  )
}
