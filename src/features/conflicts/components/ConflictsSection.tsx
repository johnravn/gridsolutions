import * as React from 'react'
import { Box, Flex, Link, Select, Spinner, Text } from '@radix-ui/themes'
import { Link as RouterLink } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { WarningTriangle } from 'iconoir-react'
import { DashboardCard } from '@features/home/components/DashboardCard'
import {
  splitCrewConflicts,
  splitEquipmentConflicts,
  splitVehicleConflicts,
} from '../utils/conflictCategories'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '../api/queries'

export type ConflictDaysFilter = '7' | '14' | '30' | '90'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
}

function ConflictDaysSelect({
  value,
  onChange,
}: {
  value: ConflictDaysFilter
  onChange: (value: ConflictDaysFilter) => void
}) {
  return (
    <Select.Root
      size="1"
      value={value}
      onValueChange={(v) => onChange(v as ConflictDaysFilter)}
    >
      <Select.Trigger />
      <Select.Content>
        <Select.Item value="7">Next 7 days</Select.Item>
        <Select.Item value="14">Next 14 days</Select.Item>
        <Select.Item value="30">Next 30 days</Select.Item>
        <Select.Item value="90">Next 90 days</Select.Item>
      </Select.Content>
    </Select.Root>
  )
}

export function ConflictsSection({
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  loading,
  daysFilter,
  onDaysFilterChange,
  rangeLabel,
}: {
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  loading: boolean
  daysFilter: ConflictDaysFilter
  onDaysFilterChange: (value: ConflictDaysFilter) => void
  rangeLabel: string
}) {
  const { unresolved, forced } = React.useMemo(() => {
    const crew = splitCrewConflicts(crewConflicts)
    const vehicles = splitVehicleConflicts(vehicleConflicts)
    const equipment = splitEquipmentConflicts(equipmentConflicts)
    return {
      unresolved: {
        crew: crew.unresolved,
        vehicles: vehicles.unresolved,
        equipment: equipment.unresolved,
      },
      forced: {
        crew: crew.forced,
        vehicles: vehicles.forced,
        equipment: equipment.forced,
      },
    }
  }, [crewConflicts, vehicleConflicts, equipmentConflicts])

  const unresolvedCount =
    unresolved.crew.length +
    unresolved.vehicles.length +
    unresolved.equipment.length
  const forcedCount =
    forced.crew.length + forced.vehicles.length + forced.equipment.length

  return (
    <DashboardCard
      title="Scheduling conflicts"
      icon={<WarningTriangle width={18} height={18} />}
      subtitle={rangeLabel}
      notFullHeight
      headerAction={
        <ConflictDaysSelect value={daysFilter} onChange={onDaysFilterChange} />
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : unresolvedCount === 0 && forcedCount === 0 ? (
        <Text size="2" color="gray">
          No conflicts in this period
        </Text>
      ) : (
        <Flex direction="column" gap="4">
          {unresolvedCount > 0 && (
            <ConflictGroup
              title={`Unresolved (${unresolvedCount})`}
              tone="red"
              crew={unresolved.crew}
              vehicles={unresolved.vehicles}
              equipment={unresolved.equipment}
            />
          )}
          {forcedCount > 0 && (
            <ConflictGroup
              title={`Forced overlaps (${forcedCount})`}
              tone="amber"
              crew={forced.crew}
              vehicles={forced.vehicles}
              equipment={forced.equipment}
            />
          )}
        </Flex>
      )}
    </DashboardCard>
  )
}

function ConflictGroup({
  title,
  tone,
  crew,
  vehicles,
  equipment,
}: {
  title: string
  tone: 'red' | 'amber'
  crew: Array<CrewConflictRow>
  vehicles: Array<VehicleConflictRow>
  equipment: Array<EquipmentConflictRow>
}) {
  const bg = tone === 'red' ? 'var(--red-a2)' : 'var(--amber-a2)'
  const border = tone === 'red' ? 'var(--red-a4)' : 'var(--amber-a4)'
  const headingColor = tone === 'red' ? 'red' : 'amber'

  return (
    <Box>
      <Text size="2" weight="medium" color={headingColor} mb="2" as="div">
        {title}
      </Text>
      <Flex direction="column" gap="2">
        {crew.map((row, i) => (
          <Box
            key={`crew-${row.user_id}-${row.period_id_1}-${row.period_id_2}-${i}`}
            p="2"
            style={{
              borderRadius: 8,
              backgroundColor: bg,
              border: `1px solid ${border}`,
            }}
          >
            <Text size="2" weight="medium" as="div">
              Crew: {row.user_display_name ?? 'Unknown'}
            </Text>
            <JobPairLinks row={row} />
          </Box>
        ))}
        {vehicles.map((row, i) => (
          <Box
            key={`vehicle-${row.vehicle_id}-${row.period_id_1}-${row.period_id_2}-${i}`}
            p="2"
            style={{
              borderRadius: 8,
              backgroundColor: bg,
              border: `1px solid ${border}`,
            }}
          >
            <Text size="2" weight="medium" as="div">
              Vehicle: {row.vehicle_name ?? 'Unknown'}
            </Text>
            <JobPairLinks row={row} />
          </Box>
        ))}
        {equipment.map((row, i) => (
          <Box
            key={`equipment-${row.item_id}-${jobIdsKey(row.job_ids)}-${row.start_at}-${i}`}
            p="2"
            style={{
              borderRadius: 8,
              backgroundColor: bg,
              border: `1px solid ${border}`,
            }}
          >
            <Text size="2" weight="medium" as="div">
              Equipment: {row.item_name ?? 'Unknown'} ({row.total_reserved}/
              {row.capacity} booked)
            </Text>
            <Text size="1" color="gray" as="div">
              {formatPeriod(row.start_at, row.end_at)}
            </Text>
            {(row.job_ids ?? []).length > 0 && (
              <Flex gap="1" wrap="wrap" align="center" mt="1">
                <Text size="1" color="gray">
                  Also booked on
                </Text>
                {(row.job_ids ?? []).map((jobId, jobIndex) => (
                  <React.Fragment key={jobId}>
                    {jobIndex > 0 && (
                      <Text size="1" color="gray">
                        and
                      </Text>
                    )}
                    <ConflictJobLink jobId={jobId}>
                      {row.job_titles?.[jobIndex]?.trim() ||
                        `Job ${jobIndex + 1}`}
                    </ConflictJobLink>
                  </React.Fragment>
                ))}
              </Flex>
            )}
          </Box>
        ))}
      </Flex>
    </Box>
  )
}

function jobIdsKey(ids: Array<string> | null | undefined): string {
  return [...(ids ?? [])].sort().join('|')
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
        search={{ jobId, tab: undefined }}
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
