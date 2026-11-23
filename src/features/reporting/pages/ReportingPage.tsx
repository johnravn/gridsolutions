import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Card, Flex, SegmentedControl, Text } from '@radix-ui/themes'
import ChartSkeleton from '@shared/ui/components/ChartSkeleton'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  reportInvoicePipelineQuery,
  reportJobProfitabilityQuery,
  reportMonthlyTrendQuery,
  reportUtilizationQuery,
} from '../api/queries'
import { aggregateCustomerProfitabilityFromJobs } from '../utils/customers'
import { CustomerProfitabilityTable } from '../components/CustomerProfitabilityTable'
import { DateRangeControl } from '../components/DateRangeControl'
import { ExportCsvButton } from '../components/ExportCsvButton'
import {
  PROJECT_LEAD_FILTER_ALL,
  ProjectLeadControl,
} from '../components/ProjectLeadControl'
import { InvoicePipelineSection } from '../components/InvoicePipelineSection'
import {
  JOB_MONTHLY_CHART_HEIGHT,
  JobMonthlyProfitabilityChart,
} from '../components/JobMonthlyProfitabilityChart'
import {
  PERIOD_TOTALS_CHART_HEIGHT,
  PeriodTotalsBarChart,
} from '../components/PeriodTotalsBarChart'
import { JobProfitabilityTable } from '../components/JobProfitabilityTable'
import { MonthlyTrendSection } from '../components/MonthlyTrendSection'
import { ProfitabilityChart } from '../components/ProfitabilityChart'
import { ReportError } from '../components/ReportError'
import { ReportingBasisNotice } from '../components/ReportingBasisNotice'
import { SegmentTabs } from '../components/SegmentTabs'
import { SummaryKpis } from '../components/SummaryKpis'
import { UtilizationTable } from '../components/UtilizationTable'
import { dateRangeFromMonthYears } from '../utils/dates'
import { formatHours, formatPercent } from '../utils/format'
import { financialKpis } from '../utils/kpis'
import { MARGIN_THRESHOLDS, filterLowMarginJobs } from '../utils/margin'
import {
  filterAccountingUnverifiedJobs,
  filterIncompleteMoneyJobs,
} from '../utils/incompleteness'
import { aggregateJobsByMonth } from '../utils/monthlyJobs'
import { aggregatePeriodTotals } from '../utils/periodTotals'
import { yearRangeToMonthYears } from '../utils/periodPicker'
import { projectLeadUserIdFromFilter } from '../utils/projectLeadFilter'
import type { MonthYear } from '../utils/dates'
import type { MarginThreshold, ReportSegment } from '../types'

function defaultCalendarYearRange(now = new Date()): {
  from: MonthYear
  to: MonthYear
} {
  const year = now.getFullYear()
  return yearRangeToMonthYears(year, year)
}

export default function ReportingPage() {
  const { companyId } = useCompany()
  const [segment, setSegment] = React.useState<ReportSegment>('jobs')
  const [fromMonth, setFromMonth] = React.useState<MonthYear>(
    () => defaultCalendarYearRange().from,
  )
  const [toMonth, setToMonth] = React.useState<MonthYear>(
    () => defaultCalendarYearRange().to,
  )
  const [marginThreshold, setMarginThreshold] =
    React.useState<MarginThreshold>(15)
  const [projectLeadFilter, setProjectLeadFilter] = React.useState(
    PROJECT_LEAD_FILTER_ALL,
  )

  const { fromDate, toDate } = React.useMemo(
    () => dateRangeFromMonthYears(fromMonth, toMonth),
    [fromMonth, toMonth],
  )

  const projectLeadUserId = React.useMemo(
    () => projectLeadUserIdFromFilter(projectLeadFilter),
    [projectLeadFilter],
  )

  const jobsQuery = useQuery({
    ...reportJobProfitabilityQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
      projectLeadUserId,
    }),
    enabled:
      !!companyId &&
      (segment === 'jobs' ||
        segment === 'customers' ||
        segment === 'low-margin'),
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
      projectLeadUserId,
    }),
    enabled: !!companyId && segment === 'monthly',
  })

  const invoiceQuery = useQuery({
    ...reportInvoicePipelineQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
      projectLeadUserId,
    }),
    enabled: !!companyId && segment === 'invoice',
  })

  const jobRows = React.useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
  const utilizationRows = utilizationQuery.data ?? []
  const monthlyRows = monthlyQuery.data ?? []
  const invoiceData = invoiceQuery.data

  /** KPIs / charts use verified Money only; tables keep all jobs. */
  const verifiedJobRows = React.useMemo(
    () => jobRows.filter((r) => r.money_verified),
    [jobRows],
  )

  // Derive customers from the jobs query — avoids a second identical money-totals
  // fetch when the customers segment is open.
  const customerRows = React.useMemo(
    () => aggregateCustomerProfitabilityFromJobs(jobRows),
    [jobRows],
  )

  const lowMarginRows = React.useMemo(
    () => filterLowMarginJobs(jobRows, marginThreshold),
    [jobRows, marginThreshold],
  )
  const verifiedLowMarginRows = React.useMemo(
    () => filterLowMarginJobs(verifiedJobRows, marginThreshold),
    [verifiedJobRows, marginThreshold],
  )

  const incompleteMoneyJobs = React.useMemo(
    () => filterIncompleteMoneyJobs(jobRows),
    [jobRows],
  )
  const incompleteMoneyCount = incompleteMoneyJobs.length

  const accountingUnverifiedCount = React.useMemo(
    () => filterAccountingUnverifiedJobs(jobRows).length,
    [jobRows],
  )

  const jobMonthlyChartData = React.useMemo(
    () => aggregateJobsByMonth(verifiedJobRows, fromDate, toDate),
    [verifiedJobRows, fromDate, toDate],
  )

  const periodTotals = React.useMemo(
    () => aggregatePeriodTotals(verifiedJobRows),
    [verifiedJobRows],
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
    if (segment === 'low-margin') {
      return verifiedLowMarginRows.slice(0, 10).map((r) => ({
        name: `#${r.job_number}`,
        income: r.income,
        expenses: r.expenses,
        profit: r.profit,
      }))
    }
    return []
  }, [segment, customerRows, verifiedLowMarginRows])

  if (!companyId) {
    return <PageSkeleton columns="1fr" showInspector={false} />
  }

  const jobsLoading = jobsQuery.isLoading
  const customersLoading = jobsLoading
  const utilizationLoading = utilizationQuery.isLoading
  const monthlyLoading = monthlyQuery.isLoading
  const invoiceLoading = invoiceQuery.isLoading

  return (
    <Box p="4" style={{ minWidth: 0 }}>
      <Flex direction="column" gap="4" style={{ minWidth: 0 }}>
        <Flex
          justify="between"
          align="center"
          wrap="wrap"
          gap="3"
          style={{ minWidth: 0 }}
        >
          <ReportingBasisNotice />
          <Flex align="center" gap="2" wrap="wrap" justify="end">
            <DateRangeControl
              from={fromMonth}
              to={toMonth}
              onChange={(nextFrom, nextTo) => {
                setFromMonth(nextFrom)
                setToMonth(nextTo)
              }}
            />
            <ProjectLeadControl
              companyId={companyId}
              value={projectLeadFilter}
              onChange={setProjectLeadFilter}
            />
          </Flex>
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
                    <SummaryKpis
                      items={financialKpis(verifiedJobRows, {
                        incompleteCount: incompleteMoneyCount,
                        unverifiedCount: accountingUnverifiedCount,
                      })}
                    />
                  ) : (
                    <Box />
                  )}
                  <ExportCsvButton
                    filename={`job-profitability-${fromDate}-${toDate}.csv`}
                    headers={[
                      'Job #',
                      'Title',
                      'Customer',
                      'Lead',
                      'Verified',
                      'Start',
                      'End',
                      'Income',
                      'Expenses',
                      'Profit',
                      'Margin %',
                      'Accounting incomplete',
                    ]}
                    rows={jobRows.map((r) => [
                      r.job_number,
                      r.title,
                      r.customer_name,
                      r.project_lead_name,
                      r.money_verified ? 'yes' : '',
                      r.start_at,
                      r.end_at,
                      r.income,
                      r.expenses,
                      r.profit,
                      r.margin_pct,
                      r.money_incomplete ? 'yes' : '',
                    ])}
                    disabled={jobsLoading}
                  />
                </Flex>
                {jobsLoading ? (
                  <Flex gap="3" wrap="wrap" align="stretch">
                    <Card size="3" style={{ flex: '2 1 420px', minWidth: 0 }}>
                      <ChartSkeleton height={JOB_MONTHLY_CHART_HEIGHT} />
                    </Card>
                    <Card size="3" style={{ flex: '1 1 280px', minWidth: 260 }}>
                      <ChartSkeleton height={PERIOD_TOTALS_CHART_HEIGHT} />
                    </Card>
                  </Flex>
                ) : (
                  <Flex gap="3" wrap="wrap" align="stretch">
                    <Box style={{ flex: '2 1 420px', minWidth: 0 }}>
                      <JobMonthlyProfitabilityChart
                        data={jobMonthlyChartData}
                      />
                    </Box>
                    <PeriodTotalsBarChart totals={periodTotals} />
                  </Flex>
                )}
                <JobProfitabilityTable rows={jobRows} loading={jobsLoading} />
              </>
            )}
          </>
        )}

        {segment === 'customers' && (
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
                      'Lead',
                      'Verified',
                      'Income',
                      'Expenses',
                      'Profit',
                      'Margin %',
                    ]}
                    rows={lowMarginRows.map((r) => [
                      r.job_number,
                      r.title,
                      r.customer_name,
                      r.project_lead_name,
                      r.money_verified ? 'yes' : '',
                      r.income,
                      r.expenses,
                      r.profit,
                      r.margin_pct,
                    ])}
                    disabled={jobsLoading}
                  />
                </Flex>
                {!jobsLoading && verifiedLowMarginRows.length > 0 ? (
                  <SummaryKpis
                    items={financialKpis(verifiedLowMarginRows, {
                      incompleteCount: filterIncompleteMoneyJobs(
                        verifiedLowMarginRows,
                      ).length,
                      unverifiedCount:
                        filterAccountingUnverifiedJobs(lowMarginRows).length,
                    })}
                  />
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
