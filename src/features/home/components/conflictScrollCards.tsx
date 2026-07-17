import * as React from 'react'
import { Card, Flex, Link, Text } from '@radix-ui/themes'
import { Link as RouterLink } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import {
  splitCrewConflicts,
  splitEquipmentConflicts,
  splitVehicleConflicts,
} from '@features/conflicts/utils/conflictCategories'
import { HorizontalScrollCard } from './HorizontalCardScroller'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
}

export function countConflictItems(
  crewConflicts: Array<CrewConflictRow>,
  vehicleConflicts: Array<VehicleConflictRow>,
  equipmentConflicts: Array<EquipmentConflictRow>,
) {
  const crew = splitCrewConflicts(crewConflicts)
  const vehicles = splitVehicleConflicts(vehicleConflicts)
  const equipment = splitEquipmentConflicts(equipmentConflicts)
  return (
    crew.unresolved.length +
    crew.forced.length +
    vehicles.unresolved.length +
    vehicles.forced.length +
    equipment.unresolved.length +
    equipment.forced.length
  )
}

function ConflictJobLink({
  jobId,
  children,
}: {
  jobId: string
  children: React.ReactNode
}) {
  return (
    <Link asChild size="1" underline="hover" weight="medium" color="blue">
      <RouterLink
        to="/jobs"
        search={{ jobId, recurringJobId: undefined, tab: undefined }}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </RouterLink>
    </Link>
  )
}

function JobPairLinks({
  row,
}: {
  row: {
    job_id_1: string | null
    job_id_2: string | null
    job_title_1: string | null
    job_title_2: string | null
    start_1: string
    end_1: string
    start_2: string
    end_2: string
  }
}) {
  return (
    <Flex gap="2" wrap="wrap" align="center" mt="1">
      {row.job_id_1 && (
        <ConflictJobLink jobId={row.job_id_1}>
          {row.job_title_1 ?? 'Job'} ({formatPeriod(row.start_1, row.end_1)})
        </ConflictJobLink>
      )}
      <Text size="1" color="gray">
        and
      </Text>
      {row.job_id_2 && (
        <ConflictJobLink jobId={row.job_id_2}>
          {row.job_title_2 ?? 'Job'} ({formatPeriod(row.start_2, row.end_2)})
        </ConflictJobLink>
      )}
    </Flex>
  )
}

export type ConflictCardItem =
  | {
      kind: 'crew'
      key: string
      tone: 'red' | 'amber'
      row: CrewConflictRow
    }
  | {
      kind: 'vehicle'
      key: string
      tone: 'red' | 'amber'
      row: VehicleConflictRow
    }
  | {
      kind: 'equipment'
      key: string
      tone: 'red' | 'amber'
      row: EquipmentConflictRow
    }

export function buildConflictCards(
  crewConflicts: Array<CrewConflictRow>,
  vehicleConflicts: Array<VehicleConflictRow>,
  equipmentConflicts: Array<EquipmentConflictRow>,
): Array<ConflictCardItem> {
  const crew = splitCrewConflicts(crewConflicts)
  const vehicles = splitVehicleConflicts(vehicleConflicts)
  const equipment = splitEquipmentConflicts(equipmentConflicts)
  const items: Array<ConflictCardItem> = []

  const pushCrew = (rows: Array<CrewConflictRow>, tone: 'red' | 'amber') => {
    rows.forEach((row, i) => {
      items.push({
        kind: 'crew',
        key: `crew-${tone}-${row.user_id}-${row.period_id_1}-${row.period_id_2}-${i}`,
        tone,
        row,
      })
    })
  }
  const pushVehicle = (
    rows: Array<VehicleConflictRow>,
    tone: 'red' | 'amber',
  ) => {
    rows.forEach((row, i) => {
      items.push({
        kind: 'vehicle',
        key: `vehicle-${tone}-${row.vehicle_id}-${row.period_id_1}-${row.period_id_2}-${i}`,
        tone,
        row,
      })
    })
  }
  const pushEquipment = (
    rows: Array<EquipmentConflictRow>,
    tone: 'red' | 'amber',
  ) => {
    rows.forEach((row, i) => {
      const ids = [...(row.job_ids ?? [])].sort().join('|')
      items.push({
        kind: 'equipment',
        key: `equipment-${tone}-${row.item_id}-${ids}-${row.start_at}-${i}`,
        tone,
        row,
      })
    })
  }

  pushCrew(crew.unresolved, 'red')
  pushVehicle(vehicles.unresolved, 'red')
  pushEquipment(equipment.unresolved, 'red')
  pushCrew(crew.forced, 'amber')
  pushVehicle(vehicles.forced, 'amber')
  pushEquipment(equipment.forced, 'amber')

  return items
}

export function ConflictScrollCard({
  item,
  minWidth,
  fillHeight,
}: {
  item: ConflictCardItem
  minWidth?: number
  fillHeight?: boolean
}) {
  const border = item.tone === 'red' ? 'var(--red-a4)' : 'var(--amber-a4)'
  const labelColor = item.tone === 'red' ? 'red' : 'amber'

  return (
    <HorizontalScrollCard
      minWidth={minWidth}
      style={
        fillHeight ? { height: '100%', alignSelf: 'stretch' } : undefined
      }
    >
      <Card
        size="2"
        style={{
          height: fillHeight ? '100%' : '100%',
          border: `1px solid ${border}`,
        }}
      >
        <Flex direction="column" gap="2">
          {item.kind === 'crew' && (
            <>
              <Text size="1" weight="medium" color={labelColor} as="div">
                {item.tone === 'red' ? 'Unresolved' : 'Forced'} · Crew
              </Text>
              <Text size="2" weight="bold" as="div">
                {item.row.user_display_name ?? 'Unknown'}
              </Text>
              <JobPairLinks row={item.row} />
            </>
          )}
          {item.kind === 'vehicle' && (
            <>
              <Text size="1" weight="medium" color={labelColor} as="div">
                {item.tone === 'red' ? 'Unresolved' : 'Forced'} · Vehicle
              </Text>
              <Text size="2" weight="bold" as="div">
                {item.row.vehicle_name ?? 'Unknown'}
              </Text>
              <JobPairLinks row={item.row} />
            </>
          )}
          {item.kind === 'equipment' && (
            <>
              <Text size="1" weight="medium" color={labelColor} as="div">
                {item.tone === 'red' ? 'Unresolved' : 'Forced'} · Equipment
              </Text>
              <Text size="2" weight="bold" as="div">
                {item.row.item_name ?? 'Unknown'} ({item.row.total_reserved}/
                {item.row.capacity} booked)
              </Text>
              <Text size="1" color="gray" as="div">
                {formatPeriod(item.row.start_at, item.row.end_at)}
              </Text>
              {(item.row.job_ids ?? []).length > 0 && (
                <Flex gap="1" wrap="wrap" align="center">
                  {(item.row.job_ids ?? []).map((jobId, jobIndex) => (
                    <React.Fragment key={jobId}>
                      {jobIndex > 0 && (
                        <Text size="1" color="gray">
                          ·
                        </Text>
                      )}
                      <ConflictJobLink jobId={jobId}>
                        {item.row.job_titles?.[jobIndex]?.trim() ||
                          `Job ${jobIndex + 1}`}
                      </ConflictJobLink>
                    </React.Fragment>
                  ))}
                </Flex>
              )}
            </>
          )}
        </Flex>
      </Card>
    </HorizontalScrollCard>
  )
}
