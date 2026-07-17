import * as React from 'react'
import { Badge, Box, Card, Flex, Spinner, Text } from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { LotOfCash, Message, WarningTriangle } from 'iconoir-react'
import {
  ConflictScrollCard,
  buildConflictCards,
  countConflictItems,
} from './conflictScrollCards'
import { HomeBottomSheet } from './HomeBottomSheet'
import { HomeDisclosureRow } from './HomeDisclosureRow'
import {
  HorizontalCardScroller,
  HorizontalScrollCard,
} from './HorizontalCardScroller'
import { MattersScrollContent } from './MattersSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { HomeJobReadyToInvoice, HomeMatter } from '../types'

export type HomeAttentionSheet = 'matters' | 'conflicts' | 'invoice' | null

function formatJobWhen(startAt: string | null, endAt: string | null): string {
  if (startAt) {
    return format(new Date(startAt), 'd. MMM yyyy', { locale: nb })
  }
  if (endAt) {
    return format(new Date(endAt), 'd. MMM yyyy', { locale: nb })
  }
  return '—'
}

function SheetClearState({ message }: { message: string }) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      py="6"
      style={{ textAlign: 'center' }}
    >
      <Text size="3" weight="medium">
        {message}
      </Text>
    </Flex>
  )
}

export function HomeAttentionSummary({
  canVisitJobs,
  showMatters,
  showConflicts,
  unreadMatters,
  mattersLoading,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
  getInitials,
  getAvatarUrl,
}: {
  canVisitJobs: boolean
  showMatters: boolean
  /** Profile preference — row always shown when true, including count 0. */
  showConflicts: boolean
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()
  const [sheet, setSheet] = React.useState<HomeAttentionSheet>(null)

  const conflictCount = React.useMemo(
    () =>
      countConflictItems(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )

  const mattersCount = unreadMatters.filter((m) => m.created_by).length
  const invoiceCount = jobsReadyToInvoice.length
  const showMattersRow = showMatters
  const showConflictsRow = showConflicts
  const showInvoiceRow = canVisitJobs

  const conflictCards = React.useMemo(
    () =>
      buildConflictCards(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )

  if (!showMattersRow && !showConflictsRow && !showInvoiceRow) {
    return null
  }

  const rows: Array<'matters' | 'invoice' | 'conflicts'> = []
  if (showMattersRow) rows.push('matters')
  if (showInvoiceRow) rows.push('invoice')
  if (showConflictsRow) rows.push('conflicts')

  return (
    <>
      <Flex direction="column" gap="2">
        {rows.map((key) => {
          if (key === 'matters') {
            return (
              <Card
                key={key}
                size="2"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                <HomeDisclosureRow
                  icon={<Message width={18} height={18} />}
                  label="Matters"
                  count={mattersCount}
                  loading={mattersLoading}
                  tone={mattersCount > 0 ? 'accent' : 'green'}
                  onClick={() => setSheet('matters')}
                />
              </Card>
            )
          }
          if (key === 'invoice') {
            return (
              <Card
                key={key}
                size="2"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                <HomeDisclosureRow
                  icon={<LotOfCash width={18} height={18} />}
                  label="Ready to invoice"
                  count={invoiceCount}
                  loading={jobsReadyToInvoiceLoading}
                  tone={invoiceCount > 0 ? 'orange' : 'green'}
                  onClick={() => setSheet('invoice')}
                />
              </Card>
            )
          }
          return (
            <Card key={key} size="2" style={{ padding: 0, overflow: 'hidden' }}>
              <HomeDisclosureRow
                icon={<WarningTriangle width={18} height={18} />}
                label="Scheduling conflicts"
                count={conflictCount}
                tone={conflictCount > 0 ? 'red' : 'green'}
                onClick={() => setSheet('conflicts')}
              />
            </Card>
          )
        })}
      </Flex>

      <HomeBottomSheet
        open={sheet === 'matters'}
        onOpenChange={(open) => setSheet(open ? 'matters' : null)}
        title="Matters"
      >
        <MattersScrollContent
          matters={unreadMatters}
          loading={mattersLoading}
          getInitials={getInitials}
          getAvatarUrl={getAvatarUrl}
          fillHeight={false}
          emptyFallback={<SheetClearState message="All matters read" />}
        />
      </HomeBottomSheet>

      <HomeBottomSheet
        open={sheet === 'conflicts'}
        onOpenChange={(open) => setSheet(open ? 'conflicts' : null)}
        title="Scheduling conflicts"
      >
        {conflictCards.length === 0 ? (
          <SheetClearState message="No scheduling conflicts" />
        ) : (
          <HorizontalCardScroller>
            {conflictCards.map((item) => (
              <ConflictScrollCard key={item.key} item={item} />
            ))}
          </HorizontalCardScroller>
        )}
      </HomeBottomSheet>

      <HomeBottomSheet
        open={sheet === 'invoice'}
        onOpenChange={(open) => setSheet(open ? 'invoice' : null)}
        title="Ready to invoice"
      >
        {jobsReadyToInvoiceLoading ? (
          <Flex align="center" justify="center" py="6">
            <Spinner size="3" />
          </Flex>
        ) : jobsReadyToInvoice.length === 0 ? (
          <SheetClearState message="Nothing waiting to invoice" />
        ) : (
          <HorizontalCardScroller>
            {jobsReadyToInvoice.map((job) => {
              const customerLabel =
                job.customer?.name?.trim() || 'No customer linked'
              return (
                <HorizontalScrollCard key={job.id}>
                  <Card
                    size="2"
                    style={{ height: '100%', cursor: 'pointer' }}
                    onClick={() => {
                      setSheet(null)
                      navigate({
                        to: '/jobs',
                        search: {
                          jobId: job.id,
                          recurringJobId: undefined,
                          tab: 'invoice',
                        },
                      })
                    }}
                  >
                    <Flex direction="column" gap="2">
                      <Flex align="center" gap="2">
                        <Box
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: 'var(--orange-9)',
                            flexShrink: 0,
                          }}
                        />
                        <Text size="3" weight="bold" as="div">
                          {job.title}
                        </Text>
                      </Flex>
                      <Flex gap="2" align="center" wrap="wrap">
                        {job.jobnr != null && (
                          <Badge size="1" color="gray" variant="soft">
                            #{job.jobnr}
                          </Badge>
                        )}
                        <Text size="2" color="gray">
                          {customerLabel}
                        </Text>
                      </Flex>
                      <Text size="2" color="gray">
                        {formatJobWhen(job.start_at, job.end_at)}
                      </Text>
                    </Flex>
                  </Card>
                </HorizontalScrollCard>
              )
            })}
          </HorizontalCardScroller>
        )}
      </HomeBottomSheet>
    </>
  )
}
