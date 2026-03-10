import * as React from 'react'
import { Box, Flex, Spinner, Text } from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { WarningTriangle } from 'iconoir-react'
import { DashboardCard } from '@features/home/components/DashboardCard'
import {
  crewConflictsQuery,
  vehicleConflictsQuery,
  type CrewConflictRow,
  type VehicleConflictRow,
} from '../api/queries'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
}

export function ConflictsSection({
  crewConflicts,
  vehicleConflicts,
  loading,
}: {
  crewConflicts: CrewConflictRow[]
  vehicleConflicts: VehicleConflictRow[]
  loading: boolean
}) {
  const navigate = useNavigate()
  const hasAny = crewConflicts.length > 0 || vehicleConflicts.length > 0

  if (!hasAny && !loading) return null

  return (
    <DashboardCard
      title="Scheduling conflicts"
      icon={<WarningTriangle width={18} height={18} />}
      notFullHeight
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : (
        <Flex direction="column" gap="4">
          {crewConflicts.length > 0 && (
            <Box>
              <Text size="2" weight="medium" color="red" mb="2" as="div">
                Crew double-booked
              </Text>
              <Flex direction="column" gap="2">
                {crewConflicts.map((row, i) => (
                  <Box
                    key={`${row.user_id}-${row.period_id_1}-${row.period_id_2}-${i}`}
                    p="2"
                    style={{
                      borderRadius: 8,
                      backgroundColor: 'var(--red-a2)',
                      border: '1px solid var(--red-a4)',
                    }}
                  >
                    <Text size="2" weight="medium" as="div">
                      {row.user_display_name ?? 'Unknown'}
                    </Text>
                    <Flex gap="2" wrap="wrap" mt="1">
                      {row.job_id_1 && (
                        <Text
                          size="1"
                          color="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() =>
                            navigate({ to: '/jobs', search: { jobId: row.job_id_1 } })
                          }
                        >
                          {row.job_title_1 ?? 'Job'} ({formatPeriod(row.start_1, row.end_1)})
                        </Text>
                      )}
                      <Text size="1" color="gray">
                        and
                      </Text>
                      {row.job_id_2 && (
                        <Text
                          size="1"
                          color="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() =>
                            navigate({ to: '/jobs', search: { jobId: row.job_id_2 } })
                          }
                        >
                          {row.job_title_2 ?? 'Job'} ({formatPeriod(row.start_2, row.end_2)})
                        </Text>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Box>
          )}
          {vehicleConflicts.length > 0 && (
            <Box>
              <Text size="2" weight="medium" color="red" mb="2" as="div">
                Vehicle double-booked
              </Text>
              <Flex direction="column" gap="2">
                {vehicleConflicts.map((row, i) => (
                  <Box
                    key={`${row.vehicle_id}-${row.period_id_1}-${row.period_id_2}-${i}`}
                    p="2"
                    style={{
                      borderRadius: 8,
                      backgroundColor: 'var(--red-a2)',
                      border: '1px solid var(--red-a4)',
                    }}
                  >
                    <Text size="2" weight="medium" as="div">
                      {row.vehicle_name ?? 'Unknown vehicle'}
                    </Text>
                    <Flex gap="2" wrap="wrap" mt="1">
                      {row.job_id_1 && (
                        <Text
                          size="1"
                          color="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() =>
                            navigate({ to: '/jobs', search: { jobId: row.job_id_1 } })
                          }
                        >
                          {row.job_title_1 ?? 'Job'} ({formatPeriod(row.start_1, row.end_1)})
                        </Text>
                      )}
                      <Text size="1" color="gray">
                        and
                      </Text>
                      {row.job_id_2 && (
                        <Text
                          size="1"
                          color="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() =>
                            navigate({ to: '/jobs', search: { jobId: row.job_id_2 } })
                          }
                        >
                          {row.job_title_2 ?? 'Job'} ({formatPeriod(row.start_2, row.end_2)})
                        </Text>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Box>
          )}
        </Flex>
      )}
    </DashboardCard>
  )
}
