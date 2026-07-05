import { Box, Flex, Skeleton, Text } from '@radix-ui/themes'
import { Community, Package, Truck } from 'iconoir-react'
import type { JobBookingSummary } from '../utils/bookingSummary'

export function JobBookingRecap({
  summary,
  loading,
  emptyMessage = 'No equipment, vehicles, or extra crew booked yet',
  layout = 'stacked',
}: {
  summary: JobBookingSummary
  loading?: boolean
  emptyMessage?: string
  layout?: 'stacked' | 'inline'
}) {
  if (loading) {
    return (
      <Skeleton>
        <Box style={{ width: '100%', height: 16 }} />
      </Skeleton>
    )
  }

  const hasAny =
    summary.hasEquipment || summary.hasVehicles || summary.crewLabels.length > 0

  if (!hasAny) {
    return (
      <Text size="1" color="gray">
        {emptyMessage}
      </Text>
    )
  }

  const equipmentText = summary.equipmentByCategory
    .filter((row) => row.quantity > 0)
    .map((row) => `${row.quantity}× ${row.categoryName}`)
    .join(' · ')

  if (layout === 'inline') {
    return (
      <Flex gap="3" wrap="wrap" align="center" width="100%">
        {summary.hasEquipment && (
          <Flex align="center" gap="1" style={{ minWidth: 0 }}>
            <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
              <Package width={16} height={16} />
            </Box>
            <Text size="1" color="gray" style={{ minWidth: 0 }}>
              {equipmentText}
            </Text>
          </Flex>
        )}
        {summary.hasVehicles && (
          <Flex align="center" gap="1" style={{ minWidth: 0 }}>
            <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
              <Truck width={16} height={16} />
            </Box>
            <Text size="1" color="gray" style={{ minWidth: 0 }}>
              {summary.vehicleNames.join(' · ')}
            </Text>
          </Flex>
        )}
        {summary.crewLabels.length > 0 && (
          <Flex align="center" gap="1" style={{ minWidth: 0 }}>
            <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
              <Community width={16} height={16} />
            </Box>
            <Text size="1" color="gray" style={{ minWidth: 0 }}>
              {summary.crewLabels.join(', ')}
            </Text>
          </Flex>
        )}
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="2" mt="1">
      {(summary.hasEquipment || summary.hasVehicles) && (
        <Flex gap="3" wrap="wrap" align="center">
          {summary.hasEquipment && (
            <Flex align="center" gap="1" style={{ minWidth: 0 }}>
              <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
                <Package width={16} height={16} />
              </Box>
              <Text size="1" color="gray" style={{ minWidth: 0 }}>
                {equipmentText}
              </Text>
            </Flex>
          )}
          {summary.hasVehicles && (
            <Flex align="center" gap="1" style={{ minWidth: 0 }}>
              <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
                <Truck width={16} height={16} />
              </Box>
              <Text size="1" color="gray" style={{ minWidth: 0 }}>
                {summary.vehicleNames.join(' · ')}
              </Text>
            </Flex>
          )}
        </Flex>
      )}
      {summary.crewLabels.length > 0 && (
        <Flex align="start" gap="1" style={{ minWidth: 0 }}>
          <Box
            style={{
              flexShrink: 0,
              color: 'var(--accent-11)',
              marginTop: 2,
            }}
          >
            <Community width={16} height={16} />
          </Box>
          <Text size="1" color="gray" style={{ minWidth: 0 }}>
            Crew: {summary.crewLabels.join(', ')}
          </Text>
        </Flex>
      )}
    </Flex>
  )
}
