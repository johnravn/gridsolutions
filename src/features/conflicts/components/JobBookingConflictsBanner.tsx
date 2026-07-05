import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Flex, Text } from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { WarningTriangle } from 'iconoir-react'
import { jobBookingConflictsQuery } from '../api/queries'
import {
  splitCrewConflicts,
  splitEquipmentConflicts,
  splitVehicleConflicts,
} from '../utils/conflictCategories'
import { formatEquipmentConflictJobs } from '../utils/mergeEquipmentConflicts'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
}

export function JobBookingConflictsBanner({
  jobId,
  isProjectLead,
  onNavigateSubTab,
}: {
  jobId: string
  isProjectLead?: boolean
  onNavigateSubTab?: (tab: 'crew' | 'equipment' | 'transport') => void
}) {
  const { data, isLoading } = useQuery({
    ...jobBookingConflictsQuery({ jobId }),
    enabled: !!jobId,
  })

  const { unresolved, forced } = React.useMemo(() => {
    const crew = splitCrewConflicts(data?.crew ?? [])
    const vehicles = splitVehicleConflicts(data?.vehicles ?? [])
    const equipment = splitEquipmentConflicts(data?.equipment ?? [])
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
  }, [data])

  const unresolvedCount =
    unresolved.crew.length +
    unresolved.vehicles.length +
    unresolved.equipment.length
  const forcedCount =
    forced.crew.length + forced.vehicles.length + forced.equipment.length

  if (isLoading || (unresolvedCount === 0 && forcedCount === 0)) {
    return null
  }

  const title = isProjectLead
    ? 'Your job has scheduling conflicts'
    : 'This job has scheduling conflicts'

  return (
    <Flex direction="column" gap="2" mb="3">
      <Text size="2" weight="bold" as="div">
        {title}
      </Text>

      {unresolvedCount > 0 && (
        <ConflictCallout
          tone="red"
          label={`Unresolved conflicts (${unresolvedCount})`}
          onNavigateSubTab={onNavigateSubTab}
          crew={unresolved.crew}
          vehicles={unresolved.vehicles}
          equipment={unresolved.equipment}
        />
      )}

      {forcedCount > 0 && (
        <ConflictCallout
          tone="amber"
          label={`Forced overlaps (${forcedCount})`}
          onNavigateSubTab={onNavigateSubTab}
          crew={forced.crew}
          vehicles={forced.vehicles}
          equipment={forced.equipment}
        />
      )}
    </Flex>
  )
}

function ConflictCallout({
  tone,
  label,
  onNavigateSubTab,
  crew,
  vehicles,
  equipment,
}: {
  tone: 'red' | 'amber'
  label: string
  onNavigateSubTab?: (tab: 'crew' | 'equipment' | 'transport') => void
  crew: Array<{
    user_display_name: string | null
    job_title_1: string | null
    job_title_2: string | null
    start_1: string
    end_1: string
    start_2: string
    end_2: string
  }>
  vehicles: Array<{
    vehicle_name: string | null
    job_title_1: string | null
    job_title_2: string | null
    start_1: string
    end_1: string
    start_2: string
    end_2: string
  }>
  equipment: Array<{
    item_name: string | null
    capacity: number
    total_reserved: number
    start_at: string
    end_at: string
    job_ids?: Array<string> | null
    job_titles?: Array<string> | null
  }>
}) {
  const bg = tone === 'red' ? 'var(--red-a2)' : 'var(--amber-a2)'
  const border = tone === 'red' ? 'var(--red-a5)' : 'var(--amber-a5)'
  const color = tone === 'red' ? 'red' : 'amber'

  return (
    <Box
      p="3"
      style={{
        borderRadius: 8,
        backgroundColor: bg,
        border: `1px solid ${border}`,
      }}
    >
      <Flex align="center" gap="2" mb="2">
        <WarningTriangle width={16} height={16} />
        <Text size="2" weight="medium" color={color}>
          {label}
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        {crew.length > 0 && (
          <Box>
            <Text
              size="1"
              color="blue"
              style={{ cursor: onNavigateSubTab ? 'pointer' : undefined }}
              onClick={() => onNavigateSubTab?.('crew')}
            >
              Crew ({crew.length})
            </Text>
            {crew.slice(0, 3).map((row, i) => (
              <Text key={i} size="1" color="gray" as="div">
                {row.user_display_name ?? 'Crew'}: {row.job_title_1 ?? 'Job'} (
                {formatPeriod(row.start_1, row.end_1)}) and{' '}
                {row.job_title_2 ?? 'Job'} (
                {formatPeriod(row.start_2, row.end_2)})
              </Text>
            ))}
          </Box>
        )}

        {vehicles.length > 0 && (
          <Box>
            <Text
              size="1"
              color="blue"
              style={{ cursor: onNavigateSubTab ? 'pointer' : undefined }}
              onClick={() => onNavigateSubTab?.('transport')}
            >
              Transport ({vehicles.length})
            </Text>
            {vehicles.slice(0, 3).map((row, i) => (
              <Text key={i} size="1" color="gray" as="div">
                {row.vehicle_name ?? 'Vehicle'}: {row.job_title_1 ?? 'Job'} (
                {formatPeriod(row.start_1, row.end_1)}) and{' '}
                {row.job_title_2 ?? 'Job'} (
                {formatPeriod(row.start_2, row.end_2)})
              </Text>
            ))}
          </Box>
        )}

        {equipment.length > 0 && (
          <Box>
            <Text
              size="1"
              color="blue"
              style={{ cursor: onNavigateSubTab ? 'pointer' : undefined }}
              onClick={() => onNavigateSubTab?.('equipment')}
            >
              Equipment ({equipment.length})
            </Text>
            {equipment.slice(0, 3).map((row, i) => (
              <Text key={i} size="1" color="gray" as="div">
                {row.item_name ?? 'Item'}: {row.total_reserved}/{row.capacity}{' '}
                booked ({formatPeriod(row.start_at, row.end_at)}) — also on{' '}
                {formatEquipmentConflictJobs(row)}
              </Text>
            ))}
          </Box>
        )}
      </Flex>
    </Box>
  )
}
