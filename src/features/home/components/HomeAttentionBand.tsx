import * as React from 'react'
import { Badge, Box, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { CalendarCheck, LotOfCash, Message } from 'iconoir-react'
import DashboardCardSkeleton from '@shared/ui/components/DashboardCardSkeleton'
import {
  ConflictScrollCard,
  buildConflictCards,
  countConflictItems,
} from './conflictScrollCards'
import { HorizontalCardScroller } from './HorizontalCardScroller'
import { InvoiceScrollContent } from './JobsReadyToInvoiceSection'
import { MattersScrollContent } from './MattersSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { ReactNode } from 'react'
import type { HomeJobReadyToInvoice, HomeMatter } from '../types'

function AccentIconBadge({ children }: { children: ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="28px"
      height="28px"
      style={{
        borderRadius: 8,
        background: 'var(--accent-3)',
        color: 'var(--accent-11)',
        flexShrink: 0,
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}

function ClearColumnIcon({ children }: { children: ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="44px"
      height="44px"
      style={{
        borderRadius: 12,
        background: 'var(--green-a3)',
        color: 'var(--green-11)',
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}

function ColumnClearState({
  icon,
  message,
}: {
  icon: ReactNode
  message: string
}) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      style={{ flex: 1, minHeight: 0, textAlign: 'center' }}
    >
      <ClearColumnIcon>{icon}</ClearColumnIcon>
      <Text size="2" weight="medium">
        {message}
      </Text>
    </Flex>
  )
}

function AttentionColumn({
  title,
  icon,
  count,
  children,
  showSeparator,
}: {
  title: string
  icon: ReactNode
  count: number
  children: ReactNode
  showSeparator: boolean
}) {
  return (
    <Flex
      direction="column"
      gap="2"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        paddingRight: showSeparator ? 'var(--space-3)' : undefined,
      }}
    >
      <Flex align="center" gap="2" style={{ flexShrink: 0, minWidth: 0 }}>
        <AccentIconBadge>{icon}</AccentIconBadge>
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          <Heading size="3" weight="bold" trim="both">
            {title}
          </Heading>
          {count > 0 ? (
            <Badge
              size="1"
              radius="full"
              highContrast
              style={{
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                fontSize: 'var(--font-size-1)',
                flexShrink: 0,
              }}
            >
              {count > 99 ? '99+' : count}
            </Badge>
          ) : null}
        </Flex>
      </Flex>

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>

      {showSeparator && (
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            right: 0,
            width: 1,
            background: 'var(--gray-a5)',
            zIndex: 2,
          }}
        />
      )}
    </Flex>
  )
}

export function HomeAttentionBand({
  showMatters,
  showInvoices,
  showConflicts,
  unreadMatters,
  mattersLoading,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  conflictsSettled,
  getInitials,
  getAvatarUrl,
}: {
  showMatters: boolean
  showInvoices: boolean
  showConflicts: boolean
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  conflictsSettled: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const conflictCards = React.useMemo(
    () =>
      buildConflictCards(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )
  const conflictCount = React.useMemo(
    () =>
      countConflictItems(crewConflicts, vehicleConflicts, equipmentConflicts),
    [crewConflicts, vehicleConflicts, equipmentConflicts],
  )

  const mattersCount = unreadMatters.filter((m) => m.created_by).length
  const invoiceCount = jobsReadyToInvoice.length

  type ColumnKey = 'matters' | 'invoices' | 'conflicts'
  const columns: Array<ColumnKey> = []
  if (showMatters) columns.push('matters')
  if (showInvoices) columns.push('invoices')
  if (showConflicts) columns.push('conflicts')

  if (columns.length === 0) return null

  const mattersFilled = !mattersLoading && mattersCount > 0
  const invoicesFilled = !jobsReadyToInvoiceLoading && invoiceCount > 0
  const conflictsFilled = conflictsSettled && conflictCount > 0

  return (
    <Card
      size="3"
      style={{
        height: '100%',
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Flex
        align="stretch"
        gap="3"
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
      >
        {columns.map((key, index) => {
          const showSeparator = index < columns.length - 1

          if (key === 'matters') {
            return (
              <AttentionColumn
                key={key}
                title="Matters"
                icon={<Message width={16} height={16} />}
                count={mattersCount}
                showSeparator={showSeparator}
              >
                {mattersFilled ? (
                  <MattersScrollContent
                    matters={unreadMatters}
                    loading={false}
                    getInitials={getInitials}
                    getAvatarUrl={getAvatarUrl}
                    fillHeight
                    fadeRight={showSeparator}
                    cardMinWidth={200}
                  />
                ) : mattersLoading ? (
                  <DashboardCardSkeleton rowCount={2} compact />
                ) : (
                  <ColumnClearState
                    icon={<Message width={22} height={22} />}
                    message="All matters read"
                  />
                )}
              </AttentionColumn>
            )
          }

          if (key === 'invoices') {
            return (
              <AttentionColumn
                key={key}
                title="Ready to invoice"
                icon={<LotOfCash width={16} height={16} />}
                count={invoiceCount}
                showSeparator={showSeparator}
              >
                {invoicesFilled ? (
                  <InvoiceScrollContent
                    jobs={jobsReadyToInvoice}
                    loading={false}
                    fillHeight
                    fadeRight={showSeparator}
                    cardMinWidth={200}
                  />
                ) : jobsReadyToInvoiceLoading ? (
                  <DashboardCardSkeleton rowCount={2} compact />
                ) : (
                  <ColumnClearState
                    icon={<LotOfCash width={22} height={22} />}
                    message="Nothing waiting to invoice"
                  />
                )}
              </AttentionColumn>
            )
          }

          return (
            <AttentionColumn
              key={key}
              title="Conflicts"
              icon={<CalendarCheck width={16} height={16} />}
              count={conflictCount}
              showSeparator={showSeparator}
            >
              {!conflictsSettled ? (
                <DashboardCardSkeleton rowCount={2} compact />
              ) : conflictsFilled ? (
                <HorizontalCardScroller
                  bleed={false}
                  fillHeight
                  fadeRight={showSeparator}
                >
                  {conflictCards.map((item) => (
                    <ConflictScrollCard
                      key={item.key}
                      item={item}
                      minWidth={200}
                      fillHeight
                    />
                  ))}
                </HorizontalCardScroller>
              ) : (
                <ColumnClearState
                  icon={<CalendarCheck width={22} height={22} />}
                  message="No scheduling conflicts"
                />
              )}
            </AttentionColumn>
          )
        })}
      </Flex>
    </Card>
  )
}
