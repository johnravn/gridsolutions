import { Badge, Box, Button, Flex, Spinner, Text } from '@radix-ui/themes'
import { LotOfCash } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { DashboardCard } from './DashboardCard'
import type { HomeJobReadyToInvoice } from '../types'

function formatJobWhen(startAt: string | null, endAt: string | null): string {
  if (startAt) {
    const s = new Date(startAt)
    return format(s, 'd. MMM yyyy', { locale: nb })
  }
  if (endAt) {
    const e = new Date(endAt)
    return format(e, 'd. MMM yyyy', { locale: nb })
  }
  return '—'
}

export function JobsReadyToInvoiceSection({
  jobs,
  loading,
}: {
  jobs: Array<HomeJobReadyToInvoice>
  loading: boolean
}) {
  const navigate = useNavigate()

  return (
    <DashboardCard
      title="Ready to invoice"
      icon={<LotOfCash width={18} height={18} />}
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() =>
            navigate({
              to: '/jobs',
              search: { jobId: undefined, tab: undefined },
            })
          }
        >
          Jobs
        </Button>
      }
      notFullHeight
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : jobs.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No completed jobs waiting for invoice
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2">
          {jobs.slice(0, 5).map((job) => {
            const customerLabel =
              job.customer?.name?.trim() || 'No customer linked'
            return (
              <div
                key={job.id}
                style={{
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'background-color 0.15s',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() =>
                  navigate({
                    to: '/jobs',
                    search: { jobId: job.id, tab: 'invoice' },
                  })
                }
              >
                <Flex gap="2" align="start">
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: 'var(--orange-9)',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="2" weight="bold" as="div">
                      {job.title}
                    </Text>
                    <Flex gap="2" align="center" wrap="wrap" mt="1">
                      {job.jobnr != null && (
                        <>
                          <Badge size="1" color="gray" variant="soft">
                            #{job.jobnr}
                          </Badge>
                          <Text size="1" color="gray">
                            •
                          </Text>
                        </>
                      )}
                      <Text size="1" color="gray">
                        {customerLabel}
                      </Text>
                      <Text size="1" color="gray">
                        •
                      </Text>
                      <Text size="1" color="gray">
                        {formatJobWhen(job.start_at, job.end_at)}
                      </Text>
                    </Flex>
                  </Box>
                </Flex>
              </div>
            )
          })}
        </Flex>
      )}
    </DashboardCard>
  )
}
