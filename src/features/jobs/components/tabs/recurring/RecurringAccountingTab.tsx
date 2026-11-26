import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  SegmentedControl,
  Table,
  Text,
} from '@radix-ui/themes'
import {
  CheckCircle,
  NavArrowLeft,
  NavArrowRight,
  XmarkCircle,
} from 'iconoir-react'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { setJobMoneyVerified } from '../../../api/moneyQueries'
import {
  recurringJobAccountingSummaryQuery,
  updateRecurringJobAccountingMode,
} from '../../../api/recurringJobQueries'
import {
  canVerifyJobAccounting,
  getSeriesAccountingStatus,
} from '../../../utils/seriesAccountingStatus'
import {
  JOB_MONEY_VERIFY_STATUS_HINT,
  isJobStatusEligibleForMoneyVerify,
} from '../../../utils/moneyVerifyStatus'
import { getJobStatusColor } from '../../../utils/statusColors'
import RecurringAccountingAutofillDialog from '../../dialogs/RecurringAccountingAutofillDialog'
import RecurringCombinedMoneyPanel from './RecurringCombinedMoneyPanel'
import type {
  RecurringAccountingMode,
  RecurringJobAccountingEntry,
  RecurringJobDetail,
} from '../../../types'

type Props = {
  detail: RecurringJobDetail
  onSelectJob: (jobId: string, tab?: string) => void
  onOpenSeriesInvoice?: () => void
}

type VerifyFilter = 'all' | 'unverified' | 'verified'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatJobDate(dateString: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatJobLabel(job: { job_title: string; jobnr: number | null }) {
  if (job.jobnr != null) {
    return `${job.job_title} (#${String(job.jobnr).padStart(6, '0')})`
  }
  return job.job_title
}

function monthKey(dateString: string | null): string | null {
  if (!dateString) return null
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
  })
}

export default function RecurringAccountingTab({
  detail,
  onSelectJob,
  onOpenSeriesInvoice,
}: Props) {
  const { companyId } = useCompany()
  const { userId, companyRole, isGlobalSuperuser } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { success, error: showError } = useToast()
  const qc = useQueryClient()
  const [verifyFilter, setVerifyFilter] = React.useState<VerifyFilter>('all')
  const [periodKey, setPeriodKey] = React.useState<string | 'all'>('all')
  const [focusJobId, setFocusJobId] = React.useState<string | null>(null)
  const [selectedJobIds, setSelectedJobIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [autofillOpen, setAutofillOpen] = React.useState(false)

  const accountingMode: RecurringAccountingMode =
    detail.accounting_mode === 'combined' ? 'combined' : 'per_job'

  const setModeMutation = useMutation({
    mutationFn: async (mode: RecurringAccountingMode) => {
      await updateRecurringJobAccountingMode({
        id: detail.id,
        accountingMode: mode,
      })
    },
    onSuccess: (_data, mode) => {
      success(
        mode === 'combined'
          ? 'Combined accounting enabled'
          : 'Per-job accounting enabled',
        mode === 'combined'
          ? 'Series ledger is active. Child job Accounting is turned off.'
          : 'Each job keeps its own Accounting again.',
      )
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs-detail', detail.id],
      })
      void qc.invalidateQueries({
        queryKey: ['company', companyId, 'recurring-jobs-index'],
      })
    },
    onError: (e: unknown) => {
      showError(
        'Could not change accounting mode',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const { data: accountingSummary = [], isLoading } = useQuery({
    ...recurringJobAccountingSummaryQuery({ recurringJobId: detail.id }),
    enabled: accountingMode === 'per_job',
  })

  const {
    activeJobs,
    verifiedCount,
    unverifiedCount,
    withLedgerCount,
    incomeTotal,
    expenseTotal,
    netTotal,
    seriesFullyVerified,
  } = getSeriesAccountingStatus(detail.jobs, accountingSummary)

  const periodOptions = React.useMemo(() => {
    const keys = new Set<string>()
    for (const entry of accountingSummary) {
      if (entry.archived) continue
      const key = monthKey(entry.start_at)
      if (key) keys.add(key)
    }
    return [...keys].sort()
  }, [accountingSummary])

  const filteredEntries = React.useMemo(() => {
    return accountingSummary.filter((entry) => {
      if (entry.archived) return false
      const verified = entry.money_verified_at != null
      if (verifyFilter === 'verified' && !verified) return false
      if (verifyFilter === 'unverified' && verified) return false
      if (periodKey !== 'all') {
        const key = monthKey(entry.start_at)
        if (key !== periodKey) return false
      }
      return true
    })
  }, [accountingSummary, verifyFilter, periodKey])

  React.useEffect(() => {
    if (filteredEntries.length === 0) {
      setFocusJobId(null)
      return
    }
    if (
      !focusJobId ||
      !filteredEntries.some((entry) => entry.job_id === focusJobId)
    ) {
      setFocusJobId(filteredEntries[0]?.job_id ?? null)
    }
  }, [filteredEntries, focusJobId])

  const focusIndex = filteredEntries.findIndex(
    (entry) => entry.job_id === focusJobId,
  )
  const focusEntry =
    focusIndex >= 0 ? filteredEntries[focusIndex] : filteredEntries[0]

  const verifiableUnverified = React.useMemo(() => {
    return accountingSummary.filter((entry) => {
      if (entry.archived || entry.money_verified_at != null) return false
      if (!isJobStatusEligibleForMoneyVerify(entry.status)) return false
      return canVerifyJobAccounting({
        userId,
        isGlobalSuperuser,
        companyRole,
        projectLeadUserId: entry.project_lead_user_id,
      })
    })
  }, [accountingSummary, userId, isGlobalSuperuser, companyRole])

  const selectedEntries = React.useMemo(
    () =>
      accountingSummary.filter(
        (entry) => !entry.archived && selectedJobIds.has(entry.job_id),
      ),
    [accountingSummary, selectedJobIds],
  )

  const allFilteredSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selectedJobIds.has(entry.job_id))

  const toggleJobSelected = (jobId: string, checked: boolean) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(jobId)
      else next.delete(jobId)
      return next
    })
  }

  const toggleSelectFiltered = (checked: boolean) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      for (const entry of filteredEntries) {
        if (checked) next.add(entry.job_id)
        else next.delete(entry.job_id)
      }
      return next
    })
  }

  const bulkVerify = useMutation({
    mutationFn: async (entries: Array<RecurringJobAccountingEntry>) => {
      if (!userId) throw new Error('Not signed in')
      for (const entry of entries) {
        await setJobMoneyVerified({
          jobId: entry.job_id,
          verified: true,
          userId,
        })
      }
      return entries.length
    },
    onSuccess: (count) => {
      success(
        count === 1 ? '1 job verified' : `${count} jobs verified`,
        'Verified Accounting is included in Reporting totals.',
      )
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs-accounting', detail.id],
      })
      void qc.invalidateQueries({ queryKey: ['reporting'] })
      void qc.invalidateQueries({
        queryKey: ['home', companyId, 'jobs-accounting-unverified'],
      })
      void qc.invalidateQueries({
        queryKey: ['company', companyId, 'jobs-index-infinite'],
      })
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs-detail', detail.id],
      })
    },
    onError: (err: Error) => {
      showError('Bulk verify failed', err.message)
    },
  })

  const openJobAccounting = (jobId: string) => {
    setFocusJobId(jobId)
    onSelectJob(jobId, 'money')
  }

  const goRelative = (delta: number) => {
    if (filteredEntries.length === 0) return
    const current = focusIndex >= 0 ? focusIndex : 0
    const next =
      (current + delta + filteredEntries.length) % filteredEntries.length
    const nextEntry = filteredEntries[next]
    if (!nextEntry) return
    setFocusJobId(nextEntry.job_id)
    onSelectJob(nextEntry.job_id, 'money')
  }

  const modeSelector = (
    <Card>
      <Flex justify="between" align="start" gap="3" wrap="wrap">
        <Box style={{ minWidth: 0, flex: '1 1 240px' }}>
          <Heading size="4" mb="1">
            Accounting mode
          </Heading>
          <Text size="2" color="gray">
            {accountingMode === 'combined'
              ? 'One ledger for the whole series. Child job Accounting tabs are deactivated.'
              : 'Each occurrence keeps its own Accounting. Use this tab for rollup, bulk verify, and autofill.'}
          </Text>
        </Box>
        <SegmentedControl.Root
          size="2"
          value={accountingMode}
          disabled={!canWrite || setModeMutation.isPending}
          onValueChange={(value) => {
            if (!canWrite || setModeMutation.isPending) return
            if (value !== 'per_job' && value !== 'combined') return
            if (value === accountingMode) return
            setModeMutation.mutate(value)
          }}
        >
          <SegmentedControl.Item value="per_job">Per job</SegmentedControl.Item>
          <SegmentedControl.Item value="combined">
            Combined
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Flex>
    </Card>
  )

  if (accountingMode === 'combined') {
    return (
      <Flex direction="column" gap="4">
        <Heading size="3">Accounting</Heading>
        {modeSelector}
        <RecurringCombinedMoneyPanel
          recurringJobId={detail.id}
          onOpenSeriesInvoice={onOpenSeriesInvoice}
        />
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="4">
      <Heading size="3">Accounting</Heading>
      {modeSelector}

      <Card>
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Box>
            <Heading size="4" mb="1">
              Series verification
            </Heading>
            <Text size="2" color="gray">
              {activeJobs.length === 0
                ? 'No jobs in this series yet.'
                : `${verifiedCount} of ${activeJobs.length} job${activeJobs.length !== 1 ? 's' : ''} verified${unverifiedCount > 0 ? ` · ${unverifiedCount} open` : ''}.`}
            </Text>
            {activeJobs.length > 0 ? (
              <Text size="2" color="gray" mt="1" style={{ display: 'block' }}>
                Ledger: {formatCurrency(incomeTotal)} income ·{' '}
                {formatCurrency(expenseTotal)} expense ·{' '}
                {formatCurrency(netTotal)} net
                {withLedgerCount > 0
                  ? ` · ${withLedgerCount} job${withLedgerCount !== 1 ? 's' : ''} with lines`
                  : ''}
              </Text>
            ) : null}
          </Box>
          <Box>
            {seriesFullyVerified ? (
              <Flex align="center" gap="2">
                <CheckCircle width={24} height={24} color="var(--green-9)" />
                <Text size="3" weight="medium" color="green">
                  Fully verified
                </Text>
              </Flex>
            ) : (
              <Flex align="center" gap="2">
                <XmarkCircle width={24} height={24} color="var(--orange-9)" />
                <Text size="3" weight="medium" color="orange">
                  {unverifiedCount > 0
                    ? `${unverifiedCount} need verification`
                    : 'Not fully verified'}
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
      </Card>

      <Card>
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ minWidth: 0, flex: '1 1 240px' }}>
            <Heading size="4" mb="1">
              Bulk verify
            </Heading>
            <Text size="2" color="gray">
              Mark every unverified occurrence you lead (or manage) as verified
              for Reporting when status is Invoiced, Paid, or Canceled.
            </Text>
            <Text size="1" color="gray" mt="1" style={{ display: 'block' }}>
              {JOB_MONEY_VERIFY_STATUS_HINT}
            </Text>
          </Box>
          {canWrite ? (
            <Button
              size="2"
              color="green"
              disabled={
                verifiableUnverified.length === 0 || bulkVerify.isPending
              }
              onClick={() => bulkVerify.mutate(verifiableUnverified)}
            >
              {verifiableUnverified.length === 0
                ? 'Nothing to verify'
                : `Verify ${verifiableUnverified.length} job${verifiableUnverified.length !== 1 ? 's' : ''}…`}
            </Button>
          ) : null}
        </Flex>
      </Card>

      <Card>
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ minWidth: 0, flex: '1 1 240px' }}>
            <Heading size="4" mb="1">
              Autofill
            </Heading>
            <Text size="2" color="gray">
              Copy fixed income/expense lines or crew-rate expenses onto all or
              selected occurrences — preview before writing.
            </Text>
          </Box>
          {canWrite ? (
            <Flex gap="2" wrap="wrap">
              <Button
                size="2"
                variant="soft"
                disabled={filteredEntries.length === 0}
                onClick={() => {
                  toggleSelectFiltered(true)
                }}
              >
                Select filtered
              </Button>
              <Button
                size="2"
                disabled={selectedEntries.length === 0}
                onClick={() => setAutofillOpen(true)}
              >
                Autofill
                {selectedEntries.length > 0
                  ? ` (${selectedEntries.length})…`
                  : '…'}
              </Button>
            </Flex>
          ) : null}
        </Flex>
      </Card>

      <Flex direction="column" gap="3">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Heading size="4">Occurrences</Heading>
          <Flex align="center" gap="2" wrap="wrap">
            <SegmentedControl.Root
              size="1"
              value={verifyFilter}
              onValueChange={(value) => setVerifyFilter(value as VerifyFilter)}
            >
              <SegmentedControl.Item value="all">All</SegmentedControl.Item>
              <SegmentedControl.Item value="unverified">
                Unverified
              </SegmentedControl.Item>
              <SegmentedControl.Item value="verified">
                Verified
              </SegmentedControl.Item>
            </SegmentedControl.Root>
            <Flex align="center" gap="1">
              <Button
                size="1"
                variant="soft"
                color="gray"
                disabled={filteredEntries.length < 2}
                onClick={() => goRelative(-1)}
                title="Previous occurrence Accounting"
              >
                <NavArrowLeft width={14} height={14} />
              </Button>
              <Button
                size="1"
                variant="soft"
                color="gray"
                disabled={filteredEntries.length < 2}
                onClick={() => goRelative(1)}
                title="Next occurrence Accounting"
              >
                <NavArrowRight width={14} height={14} />
              </Button>
            </Flex>
          </Flex>
        </Flex>

        {periodOptions.length > 1 ? (
          <Flex gap="2" wrap="wrap" align="center">
            <Text size="1" color="gray">
              Period
            </Text>
            <Button
              size="1"
              variant={periodKey === 'all' ? 'solid' : 'soft'}
              color="violet"
              onClick={() => setPeriodKey('all')}
            >
              All months
            </Button>
            {periodOptions.map((key) => (
              <Button
                key={key}
                size="1"
                variant={periodKey === key ? 'solid' : 'soft'}
                color="violet"
                onClick={() => setPeriodKey(key)}
              >
                {formatMonthKey(key)}
              </Button>
            ))}
          </Flex>
        ) : null}

        {isLoading ? (
          <Text size="2" color="gray">
            Loading accounting…
          </Text>
        ) : filteredEntries.length === 0 ? (
          <Box
            p="4"
            style={{
              border: '2px dashed var(--gray-a6)',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <Text size="3" color="gray">
              No occurrences match this filter
            </Text>
          </Box>
        ) : (
          <Box className="mobile-hscroll">
            <Table.Root size="2" variant="surface" style={{ minWidth: 760 }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell style={{ width: 36 }}>
                    <Checkbox
                      checked={
                        allFilteredSelected
                          ? true
                          : selectedJobIds.size > 0 &&
                              filteredEntries.some((e) =>
                                selectedJobIds.has(e.job_id),
                              )
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) =>
                        toggleSelectFiltered(checked === true)
                      }
                      aria-label="Select all filtered occurrences"
                    />
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Verified</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                    Income
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                    Expense
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                    Net
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                    Actions
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredEntries.map((entry) => {
                  const verified = entry.money_verified_at != null
                  const net = entry.income_total - entry.expense_total
                  const isFocus = entry.job_id === focusEntry?.job_id
                  const isChecked = selectedJobIds.has(entry.job_id)
                  return (
                    <Table.Row
                      key={entry.job_id}
                      style={
                        isFocus
                          ? { backgroundColor: 'var(--violet-a2)' }
                          : undefined
                      }
                    >
                      <Table.Cell>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            toggleJobSelected(entry.job_id, checked === true)
                          }
                          aria-label={`Select ${formatJobLabel(entry)}`}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="medium">
                          {formatJobLabel(entry)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatJobDate(entry.start_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={getJobStatusColor(entry.status)}
                          variant="soft"
                          size="1"
                        >
                          {makeWordPresentable(entry.status)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {verified ? (
                          <Badge color="green" variant="soft" size="1">
                            Verified
                          </Badge>
                        ) : (
                          <Badge color="red" variant="soft" size="1">
                            Not verified
                          </Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text size="2">
                          {formatCurrency(entry.income_total)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text size="2">
                          {formatCurrency(entry.expense_total)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text size="2" weight="medium">
                          {formatCurrency(net)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => openJobAccounting(entry.job_id)}
                        >
                          Open Accounting
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Flex>

      {onOpenSeriesInvoice ? (
        <Card>
          <Flex justify="between" align="start" gap="3" wrap="wrap">
            <Box>
              <Heading size="4" mb="1">
                Invoicing
              </Heading>
              <Text size="2" color="gray">
                After verification, create or review Conta invoices for one or
                more occurrences from the series Invoice tab.
              </Text>
            </Box>
            <Button size="2" variant="soft" onClick={onOpenSeriesInvoice}>
              Open Invoice tab
            </Button>
          </Flex>
        </Card>
      ) : null}

      <RecurringAccountingAutofillDialog
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        recurringJobId={detail.id}
        selectedEntries={selectedEntries}
      />
    </Flex>
  )
}
