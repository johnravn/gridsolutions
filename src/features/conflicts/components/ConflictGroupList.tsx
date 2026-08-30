import * as React from 'react'
import { Badge, Box, Flex, Text } from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { groupConflictsForDisplay } from '../utils/groupConflictsForDisplay'
import { ConflictCard } from './ConflictCard'
import type { OverlapConflict } from '../api/overlapChecks'

function ConflictGroupBlock({
  groupId,
  groupName,
  quantity,
  items,
  jobPeriodStart,
  jobPeriodEnd,
}: {
  groupId: string
  groupName: string
  quantity: number
  items: Array<OverlapConflict>
  jobPeriodStart?: string
  jobPeriodEnd?: string
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <Box
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--gray-a1)',
      }}
    >
      <Box
        p="2"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded((value) => !value)
          }
        }}
        style={{
          background: 'var(--gray-a2)',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--gray-a5)' : 'none',
        }}
      >
        <Flex align="center" gap="2">
          {expanded ? (
            <NavArrowDown width={16} height={16} />
          ) : (
            <NavArrowRight width={16} height={16} />
          )}
          <Text size="2" weight="medium">
            {groupName}
          </Text>
          <Badge color="pink" variant="soft">
            Group
          </Badge>
          <Text size="1" color="gray">
            {quantity}×
          </Text>
        </Flex>
      </Box>
      {expanded ? (
        <Flex direction="column" gap="2" p="2">
          {items.map((conflict, index) => (
            <ConflictCard
              key={`${groupId}:${conflict.itemId ?? conflict.itemName ?? ''}:${conflict.startAt}-${conflict.endAt}-${index}`}
              conflict={conflict}
              jobPeriodStart={jobPeriodStart}
              jobPeriodEnd={jobPeriodEnd}
            />
          ))}
        </Flex>
      ) : null}
    </Box>
  )
}

export function ConflictGroupList({
  conflicts,
  jobPeriodStart,
  jobPeriodEnd,
}: {
  conflicts: Array<OverlapConflict>
  jobPeriodStart?: string
  jobPeriodEnd?: string
}) {
  const entries = groupConflictsForDisplay(conflicts)

  return (
    <Flex direction="column" gap="2">
      {entries.map((entry, index) =>
        entry.kind === 'group' ? (
          <ConflictGroupBlock
            key={entry.groupId}
            groupId={entry.groupId}
            groupName={entry.groupName}
            quantity={entry.quantity}
            items={entry.items}
            jobPeriodStart={jobPeriodStart}
            jobPeriodEnd={jobPeriodEnd}
          />
        ) : (
          <ConflictCard
            key={`${entry.conflict.startAt}-${entry.conflict.endAt}-${entry.conflict.itemName ?? ''}-${index}`}
            conflict={entry.conflict}
            jobPeriodStart={jobPeriodStart}
            jobPeriodEnd={jobPeriodEnd}
          />
        ),
      )}
    </Flex>
  )
}
