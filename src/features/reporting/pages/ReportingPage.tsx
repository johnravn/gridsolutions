import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Text,
} from '@radix-ui/themes'
import ChartSkeleton from '@shared/ui/components/ChartSkeleton'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  reportCustomerProfitabilityQuery,
  reportInvoicePipelineQuery,
  reportJobProfitabilityQuery,
  reportMonthlyTrendQuery,
  reportUtilizationQuery,
} from '../api/queries'
import { CustomerProfitabilityTable } from '../components/CustomerProfitabilityTable'
import { DateRangeControl } from '../components/DateRangeControl'
import { ExportCsvButton } from '../components/ExportCsvButton'
import { InvoicePipelineSection } from '../components/InvoicePipelineSection'
import { JobProfitabilityTable } from '../components/JobProfitabilityTable'
import { MonthlyTrendSection } from '../components/MonthlyTrendSection'
import { ProfitabilityChart } from '../components/ProfitabilityChart'
import { ReportError } from '../components/ReportError'
import { SegmentTabs } from '../components/SegmentTabs'
import { SummaryKpis } from '../components/SummaryKpis'
import { UtilizationTable } from '../components/UtilizationTable'
import { dateRangeFromIndex } from '../utils/dates'
import { formatHours, formatPercent } from '../utils/format'
import { financialKpis } from '../utils/kpis'
import { MARGIN_THRESHOLDS, filterLowMarginJobs } from '../utils/margin'
import type { MarginThreshold, ReportSegment } from '../types'

export default function ReportingPage() {
  const { companyId } = useCompany()
  const [segment, setSegment] = React.useState<ReportSegment>('jobs')
  const [rangeIndex, setRangeIndex] = React.useState(1)
  const [marginThreshold, setMarginThreshold] =
    React.useState<MarginThreshold>(15)

  const { fromDate, toDate } = React.useMemo(
    () => dateRangeFromIndex(rangeIndex),
    [rangeIndex],
  )

  const jobsQuery = useQuery({
    ...reportJobProfitabilityQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled:
      !!companyId &&
      (segment === 'jobs' ||
        segment === 'customers' ||
        segment === 'low-margin'),
  })

  const customersQuery = useQuery({
    ...reportCustomerProfitabilityQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled: !!companyId && segment === 'customers',
  })

  const utilizationQuery = useQuery({
    ...reportUtilizationQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled: !!companyId && segment === 'utilization',
  })

  const monthlyQuery = useQuery({
    ...reportMonthlyTrendQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled: !!companyId && segment === 'monthly',
  })

  const invoiceQuery = useQuery({
    ...reportInvoicePipelineQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled: !!companyId && segment === 'invoice',
  })

  const jobRows = jobsQuery.data ?? []
  const customerRows = customersQuery.data ?? []
  const utilizationRows = utilizationQuery.data ?? []
  const monthlyRows = monthlyQuery.data ?? []
  const invoiceData = invoiceQuery.data

  const lowMarginRows = React.useMemo(
    () => filterLowMarginJobs(jobRows, marginThreshold),
    [jobRows, marginThreshold],
  )

  const chartData = React.useMemo(() => {
    if (segment === 'customers') {
      return customerRows.slice(0, 10).map((r) => ({
        name: r.customer_name ?? 'No customer',
        income: r.income,
        expenses: r.expenses,
        profit: r.profit,
      }))
    }
    if (segment === 'jobs' || segment === 'low-margin') {
      const src =
        segment === 'low-margin'
          ? lowMarginRows.slice(0, 10)
          : [...jobRows].sort((a, b) => b.profit - a.profit).slice(0, 10)
      return src.map((r) => ({
        name: `#${r.job_number}`,
        income: r.income,
        expenses: r.expenses,
        profit: r.profit,
      }))
    }
    return []
  }, [segment, jobRows, customerRows, lowMarginRows])

  if (!companyId) {
    return <PageSkeleton columns="1fr" showInspector={false} />
  }

  const jobsLoading = jobsQuery.isLoading
  const customersLoading = customersQuery.isLoading
  const utilizationLoading = utilizationQuery.isLoading
  const monthlyLoading = monthlyQuery.isLoading
  const invoiceLoading = invoiceQuery.isLoading

  return (
    <Box p="4">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between" wrap="wrap" gap="3">
          <Heading size="6">Reporting</Heading>
          <DateRangeControl rangeIndex={rangeIndex} onChange={setRangeIndex} />
        </Flex>

        <SegmentTabs value={segment} onChange={setSegment} />

        {segment === 'jobs' && (
          <>
            {jobsQuery.isError ? (
              <ReportError
                message={
                  jobsQuery.error instanceof Error
                    ? jobsQuery.error.message
                    : undefined
                }
                onRetry={() => void jobsQuery.refetch()}
              />
            ) : (
              <>
                <Flex justify="between" align="center" wrap="wrap" gap="2">
                  {!jobsLoading && jobRows.length > 0 ? (
                    <SummaryKpis items={financialKpis(jobRows)} />
                  ) : (
                    <Box />
                  )}
                  <ExportCsvButton
                    filename={`job-profitability-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Job #',
                      'Title',
                      'Customer',
                      'Start',
                      'End',
                      'Income',
                      'Expenses',
                      'Profit',
                      'Margin %',
                    ]}
                    rows={jobRows.map((r) => [
                      r.job_number,
                      r.title,
                      r.customer_name,
                      r.start_at,
                      r.end_at,
                      r.income,
                      r.expenses,
                      r.profit,
                      r.margin_pct,
                    ])}
                    disabled={jobsLoading}
                  />
                </Flex>
                {jobsLoading ? (
                  <Card size="3">
                    <ChartSkeleton />
                  </Card>
                ) : (
                  <ProfitabilityChart
                    data={chartData}
                    caption={
                      jobRows.length > 10 ? 'Top 10 jobs by profit' : undefined
                    }
                  />
                )}
                <JobProfitabilityTable rows={jobRows} loading={jobsLoading} />
              </>
            )}
          </>
        )}

        {segment === 'customers' && (
          <>
            {customersQuery.isError ? (
              <ReportError
                message={
                  customersQuery.error instanceof Error
                    ? customersQuery.error.message
                    : undefined
                }
                onRetry={() => void customersQuery.refetch()}
              />
            ) : (
              <>
                <Flex justify="between" align="center" wrap="wrap" gap="2">
                  {!customersLoading && customerRows.length > 0 ? (
                    <SummaryKpis items={financialKpis(customerRows)} />
                  ) : (
                    <Box />
                  )}
                  <ExportCsvButton
                    filename={`customer-profitability-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Customer',
                      'Jobs',
                      'Income',
                      'Expenses',
                      'Profit',
                      'Margin %',
                    ]}
                    rows={customerRows.map((r) => [
                      r.customer_name,
                      r.job_count,
                      r.income,
                      r.expenses,
                      r.profit,
                      r.margin_pct,
                    ])}
                    disabled={customersLoading}
                  />
                </Flex>
                {customersLoading ? (
                  <Card size="3">
                    <ChartSkeleton />
                  </Card>
                ) : (
                  <ProfitabilityChart
                    data={chartData}
                    caption={
                      customerRows.length > 10
                        ? 'Top 10 customers by profit'
                        : undefined
                    }
                  />
                )}
                <CustomerProfitabilityTable
                  rows={customerRows}
                  loading={customersLoading}
                />
              </>
            )}
          </>
        )}

        {segment === 'utilization' && (
          <>
            {utilizationQuery.isError ? (
              <ReportError
                message={
                  utilizationQuery.error instanceof Error
                    ? utilizationQuery.error.message
                    : undefined
                }
                onRetry={() => void utilizationQuery.refetch()}
              />
            ) : (
              <>
                <Flex justify="between" align="center" wrap="wrap" gap="2">
                  {!utilizationLoading && utilizationRows.length > 0 ? (
                    <SummaryKpis
                      items={[
                        {
                          label: 'Total booked',
                          value: formatHours(
                            utilizationRows.reduce(
                              (s, r) => s + r.booked_hours,
                              0,
                            ),
                          ),
                        },
                        {
                          label: 'People',
                          value: String(utilizationRows.length),
                        },
                        {
                          label: 'Avg utilization',
                          value: formatPercent(
                            utilizationRows.length > 0
                              ? Math.round(
                                  (utilizationRows.reduce(
                                    (s, r) => s + (r.utilization_pct ?? 0),
                                    0,
                                  ) /
                                    utilizationRows.length) *
                                    100,
                                ) / 100
                              : null,
                          ),
                          hint: 'Assumes 7.5h weekdays',
                        },
                      ]}
                    />
                  ) : (
                    <Box />
                  )}
                  <ExportCsvButton
                    filename={`utilization-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Person',
                      'Booked hours',
                      'Capacity hours',
                      'Utilization %',
                    ]}
                    rows={utilizationRows.map((r) => [
                      r.display_name ?? r.user_id,
                      r.booked_hours,
                      r.capacity_hours,
                      r.utilization_pct,
                    ])}
                    disabled={utilizationLoading}
                  />
                </Flex>
                <UtilizationTable
                  rows={utilizationRows}
                  loading={utilizationLoading}
                />
              </>
            )}
          </>
        )}

        {segment === 'low-margin' && (
          <>
            {jobsQuery.isError ? (
              <ReportError
                message={
                  jobsQuery.error instanceof Error
                    ? jobsQuery.error.message
                    : undefined
                }
                onRetry={() => void jobsQuery.refetch()}
              />
            ) : (
              <>
                <Flex align="center" justify="between" wrap="wrap" gap="2">
                  <Flex direction="column" gap="2">
                    <Text size="2" color="gray">
                      Jobs below the selected margin threshold, lowest first.
                    </Text>
                    <SegmentedControl.Root
                      value={String(marginThreshold)}
                      onValueChange={(v) =>
                        setMarginThreshold(Number(v) as MarginThreshold)
                      }
                    >
                      {MARGIN_THRESHOLDS.map((t) => (
                        <SegmentedControl.Item
                          key={t.value}
                          value={String(t.value)}
                        >
                          {t.label}
                        </SegmentedControl.Item>
                      ))}
                    </SegmentedControl.Root>
                  </Flex>
                  <ExportCsvButton
                    filename={`low-margin-${marginThreshold}-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Job #',
                      'Title',
                      'Customer',
                      'Income',
                      'Expenses',
                      'Profit',
                      'Margin %',
                    ]}
                    rows={lowMarginRows.map((r) => [
                      r.job_number,
                      r.title,
                      r.customer_name,
                      r.income,
                      r.expenses,
                      r.profit,
                      r.margin_pct,
                    ])}
                    disabled={jobsLoading}
                  />
                </Flex>
                {!jobsLoading && lowMarginRows.length > 0 ? (
                  <SummaryKpis items={financialKpis(lowMarginRows)} />
                ) : null}
                {jobsLoading ? (
                  <Card size="3">
                    <ChartSkeleton />
                  </Card>
                ) : (
                  <ProfitabilityChart
                    data={chartData}
                    caption={
                      lowMarginRows.length > 10
                        ? '10 lowest margin jobs'
                        : undefined
                    }
                  />
                )}
                <JobProfitabilityTable
                  rows={lowMarginRows}
                  loading={jobsLoading}
                />
              </>
            )}
          </>
        )}

        {segment === 'monthly' && (
          <>
            {monthlyQuery.isError ? (
              <ReportError
                message={
                  monthlyQuery.error instanceof Error
                    ? monthlyQuery.error.message
                    : undefined
                }
                onRetry={() => void monthlyQuery.refetch()}
              />
            ) : (
              <>
                <Flex justify="between" align="center" wrap="wrap" gap="2">
                  {!monthlyLoading && monthlyRows.length > 0 ? (
                    <SummaryKpis items={financialKpis(monthlyRows)} />
                  ) : (
                    <Box />
                  )}
                  <ExportCsvButton
                    filename={`monthly-pnl-${fromDate}-${toDate}.csv`}
                    headers={['Month', 'Income', 'Expenses', 'Profit']}
                    rows={monthlyRows.map((r) => [
                      r.month_label,
                      r.income,
                      r.expenses,
                      r.profit,
                    ])}
                    disabled={monthlyLoading}
                  />
                </Flex>
                <MonthlyTrendSection
                  rows={monthlyRows}
                  loading={monthlyLoading}
                />
              </>
            )}
          </>
        )}

        {segment === 'invoice' && (
          <>
            {invoiceQuery.isError ? (
              <ReportError
                message={
                  invoiceQuery.error instanceof Error
                    ? invoiceQuery.error.message
                    : undefined
                }
                onRetry={() => void invoiceQuery.refetch()}
              />
            ) : (
              <>
                <Flex justify="end">
                  <ExportCsvButton
                    filename={`invoice-pipeline-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Job #',
                      'Title',
                      'Customer',
                      'Status',
                      'Bucket',
                      'Start',
                      'End',
                      'Income',
                    ]}
                    rows={(invoiceData?.jobs ?? []).map((r) => [
                      r.job_number,
                      r.title,
                      r.customer_name,
                      r.status,
                      r.bucket,
                      r.start_at,
                      r.end_at,
                      r.income,
                    ])}
                    disabled={invoiceLoading}
                  />
                </Flex>
                <InvoicePipelineSection
                  summaries={invoiceData?.summaries ?? []}
                  jobs={invoiceData?.jobs ?? []}
                  loading={invoiceLoading}
                />
              </>
            )}
          </>
        )}
      </Flex>
    </Box>
  )
}
