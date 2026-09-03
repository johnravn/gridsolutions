import { Card, Flex, Text } from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { ConflictJobButtonList } from '@features/conflicts/components/JobOverlapPair'
import { formatConflictPeriod } from '@features/conflicts/utils/conflictCopy'
import {
  conflictJobButtonItems,
  conflictKindLabel,
  conflictResourceName,
  conflictStatusLabel,
} from '@features/conflicts/utils/conflictItems'
import { HorizontalScrollCard } from './HorizontalCardScroller'
import type { ConflictCardItem } from '@features/conflicts/utils/conflictItems'
import type { KeyboardEvent } from 'react'

export {
  buildConflictCards,
  countConflictItems,
  type ConflictCardItem,
} from '@features/conflicts/utils/conflictItems'

export function ConflictScrollCard({
  item,
  minWidth,
  fillHeight,
}: {
  item: ConflictCardItem
  minWidth?: number
  fillHeight?: boolean
}) {
  const navigate = useNavigate()
  const { caps } = useAuthz()
  const canOpenConflicts = canVisit(caps, 'visit:conflicts')
  const border = item.tone === 'red' ? 'var(--red-a4)' : 'var(--amber-a4)'
  const labelColor = item.tone === 'red' ? 'red' : 'amber'
  const jobs = conflictJobButtonItems(item, formatConflictPeriod)

  const openConflict = () => {
    if (!canOpenConflicts) return
    void navigate({
      to: '/conflicts',
      search: { conflictId: item.key },
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canOpenConflicts) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openConflict()
    }
  }

  return (
    <HorizontalScrollCard
      minWidth={minWidth}
      style={fillHeight ? { height: '100%', alignSelf: 'stretch' } : undefined}
    >
      <Card
        size="2"
        role={canOpenConflicts ? 'link' : undefined}
        tabIndex={canOpenConflicts ? 0 : undefined}
        aria-label={
          canOpenConflicts
            ? `Open conflict ${conflictResourceName(item)}`
            : undefined
        }
        onClick={canOpenConflicts ? openConflict : undefined}
        onKeyDown={canOpenConflicts ? onKeyDown : undefined}
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${border}`,
          cursor: canOpenConflicts ? 'pointer' : 'default',
        }}
      >
        <Flex
          direction="column"
          gap="2"
          style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        >
          <Text size="1" weight="medium" color={labelColor} as="div">
            {conflictStatusLabel(item.tone)} · {conflictKindLabel(item.kind)}
          </Text>
          <Text size="2" weight="bold" as="div">
            {conflictResourceName(item)}
          </Text>
          {item.kind === 'equipment' ? (
            <Text size="1" color="gray" as="div">
              {item.row.total_reserved}/{item.row.capacity} booked
            </Text>
          ) : null}
          <ConflictJobButtonList jobs={jobs} linkJobs />
        </Flex>
      </Card>
    </HorizontalScrollCard>
  )
}
