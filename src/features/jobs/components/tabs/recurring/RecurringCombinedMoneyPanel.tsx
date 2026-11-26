import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import { CheckCircle, Plus, Trash, XmarkCircle } from 'iconoir-react'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  
  deleteJobMoneyItem,
  recurringJobMoneyItemsQuery,
  seriesMoneyVerificationQuery,
  setSeriesMoneyVerified
} from '../../../api/moneyQueries'
import {
  SERIES_MONEY_VERIFY_STATUS_HINT,
  isSeriesEligibleForMoneyVerify,
} from '../../../utils/moneyVerifyStatus'
import MoneyItemEditDialog from '../../dialogs/MoneyItemEditDialog'
import type {JobMoneyItem} from '../../../api/moneyQueries';

type Props = {
  recurringJobId: string
  onOpenSeriesInvoice?: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatVerifiedAt(dateString: string | null | undefined) {
  if (!dateString) return null
  return new Date(dateString).toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RecurringCombinedMoneyPanel({
  recurringJobId,
  onOpenSeriesInvoice,
}: Props) {
  const { companyId } = useCompany()
  const { userId, companyRole, isGlobalSuperuser } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [editMode, setEditMode] = React.useState<'add' | 'edit'>('add')
  const [editingItem, setEditingItem] = React.useState<JobMoneyItem | null>(
    null,
  )

  const { data: items = [], isLoading } = useQuery(
    recurringJobMoneyItemsQuery(recurringJobId),
  )
  const { data: verification } = useQuery(
    seriesMoneyVerificationQuery(recurringJobId),
  )

  const moneyVerified = verification?.money_verified_at != null
  const statusAllowsVerify = isSeriesEligibleForMoneyVerify(
    verification?.child_statuses ?? [],
  )
  const canVerifyMoney =
    !!userId &&
    (isGlobalSuperuser ||
      companyRole === 'owner' ||
      companyRole === 'super_user' ||
      (!!verification?.project_lead_user_id &&
        verification.project_lead_user_id === userId))

  const incomeTotal = items
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + i.amount, 0)
  const expenseTotal = items
    .filter((i) => i.type === 'expense')
    .reduce((sum, i) => sum + i.amount, 0)
  const netTotal = incomeTotal - expenseTotal

  const verifyMutation = useMutation({
    mutationFn: async (verified: boolean) => {
      if (!userId) throw new Error('Not signed in')
      await setSeriesMoneyVerified({
        recurringJobId,
        verified,
        userId,
      })
    },
    onSuccess: (_data, verified) => {
      success(
        verified ? 'Series Accounting verified' : 'Verification cleared',
        verified
          ? 'This combined series is included in Reporting totals.'
          : 'Reporting totals will ignore this series until verified again.',
      )
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs', recurringJobId, 'money-verification'],
      })
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs-detail', recurringJobId],
      })
    },
    onError: (e: unknown) => {
      toastError(
        'Verification failed',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteJobMoneyItem,
    onSuccess: () => {
      success('Item removed')
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs', recurringJobId, 'money-items'],
      })
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to remove item',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const verifyDisabled =
    verifyMutation.isPending || (!moneyVerified && !statusAllowsVerify)

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Box>
            <Heading size="4" mb="1">
              Combined series ledger
            </Heading>
            <Text size="2" color="gray">
              Income and expenses for the whole series live here. Child job
              Accounting is turned off while Combined mode is selected.
            </Text>
            <Text size="2" color="gray" mt="1" style={{ display: 'block' }}>
              {formatCurrency(incomeTotal)} income ·{' '}
              {formatCurrency(expenseTotal)} expense ·{' '}
              {formatCurrency(netTotal)} net
              {items.length > 0
                ? ` · ${items.length} line${items.length !== 1 ? 's' : ''}`
                : ''}
            </Text>
          </Box>
          <Flex align="center" gap="2" wrap="wrap">
            {onOpenSeriesInvoice ? (
              <Button size="2" variant="soft" onClick={onOpenSeriesInvoice}>
                Series invoices
              </Button>
            ) : null}
            {moneyVerified ? (
              <Text size="2" color="gray" style={{ whiteSpace: 'nowrap' }}>
                {formatVerifiedAt(verification?.money_verified_at)}
              </Text>
            ) : null}
            {canVerifyMoney ? (
              <Flex align="center" gap="2" wrap="wrap">
                {!moneyVerified && !statusAllowsVerify ? (
                  <Text size="1" color="gray" style={{ maxWidth: 280 }}>
                    {SERIES_MONEY_VERIFY_STATUS_HINT}
                  </Text>
                ) : null}
                <Button
                  size="3"
                  variant="solid"
                  color={moneyVerified ? 'green' : 'red'}
                  disabled={verifyDisabled}
                  onClick={() => verifyMutation.mutate(!moneyVerified)}
                  aria-pressed={moneyVerified}
                >
                  {moneyVerified ? (
                    <Flex align="center" gap="2">
                      <CheckCircle width={18} height={18} />
                      Verified
                    </Flex>
                  ) : (
                    <Flex align="center" gap="2">
                      <XmarkCircle width={18} height={18} />
                      Not verified
                    </Flex>
                  )}
                </Button>
              </Flex>
            ) : moneyVerified ? (
              <Badge color="green" variant="soft" size="2">
                Verified
              </Badge>
            ) : (
              <Text size="1" color="gray">
                Project lead verifies Accounting for Reporting
              </Text>
            )}
          </Flex>
        </Flex>
      </Card>

      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Heading size="3">Income & expenses</Heading>
        {canWrite ? (
          <Button
            size="2"
            onClick={() => {
              setEditMode('add')
              setEditingItem(null)
              setEditOpen(true)
            }}
          >
            <Plus width={16} height={16} />
            Add item
          </Button>
        ) : null}
      </Flex>

      {isLoading ? (
        <Text size="2" color="gray">
          Loading ledger…
        </Text>
      ) : items.length === 0 ? (
        <Card>
          <Text size="2" color="gray">
            No income or expense lines yet. Add items here — they apply to the
            whole series, not individual jobs.
          </Text>
        </Card>
      ) : (
        <Table.Root variant="surface" size="2">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">
                Amount
              </Table.ColumnHeaderCell>
              {canWrite ? (
                <Table.ColumnHeaderCell width="1">
                  Actions
                </Table.ColumnHeaderCell>
              ) : null}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <Badge
                    color={item.type === 'income' ? 'green' : 'orange'}
                    variant="soft"
                  >
                    {item.type === 'income' ? 'Income' : 'Expense'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{item.description}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {formatDate(item.date)}
                  </Text>
                </Table.Cell>
                <Table.Cell align="right">
                  <Text size="2">{formatCurrency(item.amount)}</Text>
                </Table.Cell>
                {canWrite ? (
                  <Table.Cell>
                    <Flex gap="2">
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => {
                          setEditMode('edit')
                          setEditingItem(item)
                          setEditOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    </Flex>
                  </Table.Cell>
                ) : null}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <MoneyItemEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        recurringJobId={recurringJobId}
        companyId={companyId ?? ''}
        mode={editMode}
        existingItem={editingItem}
        onSaved={() => {
          setEditingItem(null)
        }}
      />
    </Flex>
  )
}
