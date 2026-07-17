import * as React from 'react'
import { Badge, Box, Card, Flex, Spinner, Text } from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { LotOfCash, NavArrowRight, WarningTriangle } from 'iconoir-react'
import { ConflictDaysSelect } from '@features/conflicts/components/ConflictsSection'
import {
  ConflictScrollCard,
  buildConflictCards,
  countConflictItems,
} from './conflictScrollCards'
import { HomeBottomSheet } from './HomeBottomSheet'
import {
  HorizontalCardScroller,
  HorizontalScrollCard,
} from './HorizontalCardScroller'
import type { ConflictDaysFilter } from '@features/conflicts/components/ConflictsSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { HomeJobReadyToInvoice } from '../types'

export type HomeAttentionSheet = 'conflicts' | 'invoice' | null

function formatJobWhen(startAt: string | null, endAt: string | null): string {
  if (startAt) {
    return format(new Date(startAt), 'd. MMM yyyy', { locale: nb })
  }
  if (endAt) {
    return format(new Date(endAt), 'd. MMM yyyy', { locale: nb })
  }
  return '—'
}

/** iOS Settings-style disclosure row (min ~44pt tall). */
function SummaryRow({
  icon,
  label,
  count,
  loading,
  color,
  showDivider,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  loading?: boolean
  color: 'red' | 'orange'
  showDivider?: boolean
  onClick: () => void
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        cursor: 'pointer',
        minHeight: 52,
        padding: '12px 16px',
        borderBottom: showDivider ? '1px solid var(--gray-a4)' : undefined,
      }}
    >
      <Flex align="center" gap="3" style={{ minHeight: 28 }}>
        <Flex
          align="center"
          justify="center"
          width="32px"
          height="32px"
          style={{
            borderRadius: 8,
            background: color === 'red' ? 'var(--red-a3)' : 'var(--orange-a3)',
            color: color === 'red' ? 'var(--red-11)' : 'var(--orange-11)',
            flexShrink: 0,
          }}
        >
          {icon}
        </Flex>
        <Text size="3" weight="medium" style={{ flex: 1, minWidth: 0 }}>
          {label}
        </Text>
        {loading ? (
          <Spinner size="2" />
        ) : (
          <Text
            size="3"
            color={count > 0 ? undefined : 'gray'}
            weight={count > 0 ? 'medium' : 'regular'}
            style={{
              ...(count > 0
                ? {
                    color:
                      color === 'red' ? 'var(--red-11)' : 'var(--orange-11)',
                  }
                : null),
              fontVariantNumeric: 'tabular-nums',
              minWidth: '1.5ch',
              textAlign: 'right',
            }}
          >
            {count}
          </Text>
        )}
        <Box style={{ color: 'var(--gray-8)', lineHeight: 0, flexShrink: 0 }}>
          <NavArrowRight width={18} height={18} />
        </Box>
      </Flex>
    </Box>
  )
}

export function HomeAttentionSummary({
  canVisitJobs,
  showConflicts,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  conflictDaysFilter,
  onConflictDaysFilterChange,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
}: {
  canVisitJobs: boolean
  /** Profile preference — chip always shown when true, including count 0. */
  showConflicts: boolean
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  conflictDaysFilter: ConflictDaysFilter
  onConflictDaysFilterChange: (value: ConflictDaysFilter) => void
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
}) {
  const navigate = useNavigate()
  const [sheet, setSheet] = React.useState<HomeAttentionSheet>(null)

  const conflictCount = React.useMemo(
    () =>
      countConflictItems(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )

  const invoiceCount = jobsReadyToInvoice.length
  const showConflictsRow = showConflicts
  const showInvoiceRow = canVisitJobs

  const conflictCards = React.useMemo(
    () =>
      buildConflictCards(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )

  if (!showConflictsRow && !showInvoiceRow) {
    return null
  }

  return (
    <>
      <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
        {showConflictsRow && (
          <SummaryRow
            icon={<WarningTriangle width={18} height={18} />}
            label="Scheduling conflicts"
            count={conflictCount}
            color="red"
            showDivider={showInvoiceRow}
            onClick={() => setSheet('conflicts')}
          />
        )}
        {showInvoiceRow && (
          <SummaryRow
            icon={<LotOfCash width={18} height={18} />}
            label="Ready to invoice"
            count={invoiceCount}
            loading={jobsReadyToInvoiceLoading}
            color="orange"
            onClick={() => setSheet('invoice')}
          />
        )}
      </Card>

      <HomeBottomSheet
        open={sheet === 'conflicts'}
        onOpenChange={(open) => setSheet(open ? 'conflicts' : null)}
        title="Scheduling conflicts"
        headerAction={
          <ConflictDaysSelect
            value={conflictDaysFilter}
            onChange={onConflictDaysFilterChange}
          />
        }
      >
        {conflictCards.length === 0 ? (
          <Text size="2" color="gray">
            No conflicts in this period
          </Text>
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
          <Text size="2" color="gray">
            No completed jobs waiting for invoice
          </Text>
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
                        <Text size="2" weight="bold" as="div">
                          {job.title}
                        </Text>
                      </Flex>
                      <Flex gap="2" align="center" wrap="wrap">
                        {job.jobnr != null && (
                          <Badge size="1" color="gray" variant="soft">
                            #{job.jobnr}
                          </Badge>
                        )}
                        <Text size="1" color="gray">
                          {customerLabel}
                        </Text>
                      </Flex>
                      <Text size="1" color="gray">
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
