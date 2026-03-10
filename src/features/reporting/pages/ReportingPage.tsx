// src/features/reporting/pages/ReportingPage.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Table,
  Text,
} from '@radix-ui/themes'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  reportJobProfitabilityQuery,
  reportCustomerProfitabilityQuery,
  reportUtilizationQuery,
} from '../api/queries'

const DATE_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: -1 },
] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('no-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type Segment = 'jobs' | 'customers' | 'utilization' | 'low-margin'

export default function ReportingPage() {
  const { companyId } = useCompany()
  const navigate = useNavigate()
  const [segment, setSegment] = React.useState<Segment>('jobs')
  const [rangeIndex, setRangeIndex] = React.useState(1)

  const { fromDate, toDate } = React.useMemo(() => {
    const to = new Date()
    const days = DATE_RANGES[rangeIndex].days
    const from = new Date(to)
    if (days === -1) {
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
    } else {
      from.setDate(from.getDate() - days)
    }
    to.setHours(23, 59, 59, 999)
    return {
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    }
  }, [rangeIndex])

  const { data: jobRows = [], isLoading: jobsLoading } = useQuery({
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

  const { data: customerRows = [], isLoading: customersLoading } = useQuery({
    ...reportCustomerProfitabilityQuery({
      companyId: companyId ?? '',
      fromDate,
      toDate,
    }),
    enabled: !!companyId && segment === 'customers',
  })

  const { data: utilizationRows = [], isLoading: utilizationLoading } =
    useQuery({
      ...reportUtilizationQuery({
        companyId: companyId ?? '',
        fromDate,
        toDate,
      }),
      enabled: !!companyId && segment === 'utilization',
    })

  const lowMarginRows = React.useMemo(() => {
    const withMargin = jobRows.filter((r) => r.margin_pct != null)
    return [...withMargin].sort(
      (a, b) => (a.margin_pct ?? 0) - (b.margin_pct ?? 0),
    )
  }, [jobRows])

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
          : jobRows.slice(0, 10)
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
    return (
      <Box p="4">
        <Text color="gray">Select a company to view reports.</Text>
      </Box>
    )
  }

  return (
    <Box p="4">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between" wrap="wrap" gap="2">
          <Flex gap="2" align="center">
            <SegmentedControl.Root
              value={DATE_RANGES[rangeIndex].label}
              onValueChange={(v) => {
                const i = DATE_RANGES.findIndex((r) => r.label === v)
                if (i >= 0) setRangeIndex(i)
              }}
            >
              {DATE_RANGES.map((r) => (
                <SegmentedControl.Item key={r.label} value={r.label}>
                  {r.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          </Flex>
        </Flex>

        <SegmentedControl.Root
          value={segment}
          onValueChange={(v) => setSegment(v as Segment)}
        >
          <SegmentedControl.Item value="jobs">
            Job profitability
          </SegmentedControl.Item>
          <SegmentedControl.Item value="customers">
            Customer profitability
          </SegmentedControl.Item>
          <SegmentedControl.Item value="utilization">
            Utilization
          </SegmentedControl.Item>
          <SegmentedControl.Item value="low-margin">
            Low margin / unprofitable
          </SegmentedControl.Item>
        </SegmentedControl.Root>

        {segment === 'jobs' && (
          <>
            {chartData.length > 0 && (
              <Card size="3">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000}k` : String(v)
                      }
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="var(--green-9)" name="Income" />
                    <Bar
                      dataKey="expenses"
                      fill="var(--red-9)"
                      name="Expenses"
                    />
                    <Bar dataKey="profit" fill="var(--blue-9)" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card size="3">
              {jobsLoading ? (
                <Text color="gray">Loading…</Text>
              ) : jobRows.length === 0 ? (
                <Text color="gray">No jobs in this period.</Text>
              ) : (
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Job #</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Dates</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Income
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Expenses
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Profit
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Margin %
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {jobRows.map((row) => (
                      <Table.Row key={row.job_id}>
                        <Table.Cell>#{row.job_number}</Table.Cell>
                        <Table.Cell>{row.title}</Table.Cell>
                        <Table.Cell>{row.customer_name ?? '—'}</Table.Cell>
                        <Table.Cell>
                          {formatDate(row.start_at)} – {formatDate(row.end_at)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.income)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.expenses)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.profit)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {row.margin_pct != null ? `${row.margin_pct}%` : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() =>
                              navigate({
                                to: '/jobs',
                                search: { jobId: row.job_id },
                              })
                            }
                          >
                            Open
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Card>
          </>
        )}

        {segment === 'customers' && (
          <>
            {chartData.length > 0 && (
              <Card size="3">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000}k` : String(v)
                      }
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="var(--green-9)" name="Income" />
                    <Bar
                      dataKey="expenses"
                      fill="var(--red-9)"
                      name="Expenses"
                    />
                    <Bar dataKey="profit" fill="var(--blue-9)" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card size="3">
              {customersLoading ? (
                <Text color="gray">Loading…</Text>
              ) : customerRows.length === 0 ? (
                <Text color="gray">No customer data in this period.</Text>
              ) : (
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Jobs</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Income
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Expenses
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Profit
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Margin %
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {customerRows.map((row, i) => (
                      <Table.Row key={row.customer_id ?? `no-customer-${i}`}>
                        <Table.Cell>{row.customer_name ?? '—'}</Table.Cell>
                        <Table.Cell>{row.job_count}</Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.income)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.expenses)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.profit)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {row.margin_pct != null ? `${row.margin_pct}%` : '—'}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Card>
          </>
        )}

        {segment === 'utilization' && (
          <Card size="3">
            {utilizationLoading ? (
              <Text color="gray">Loading…</Text>
            ) : utilizationRows.length === 0 ? (
              <Text color="gray">No crew bookings in this period.</Text>
            ) : (
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Person</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell align="end">
                      Booked hours
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {utilizationRows
                    .slice()
                    .sort((a, b) => b.booked_hours - a.booked_hours)
                    .map((row) => (
                      <Table.Row key={row.user_id}>
                        <Table.Cell>
                          {row.display_name ?? row.user_id}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {row.booked_hours.toFixed(1)} h
                        </Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table.Root>
            )}
          </Card>
        )}

        {segment === 'low-margin' && (
          <>
            <Text size="2" color="gray">
              Jobs sorted by margin (lowest first). Review unprofitable or
              low-margin jobs.
            </Text>
            {chartData.length > 0 && (
              <Card size="3">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000}k` : String(v)
                      }
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="var(--green-9)" name="Income" />
                    <Bar
                      dataKey="expenses"
                      fill="var(--red-9)"
                      name="Expenses"
                    />
                    <Bar dataKey="profit" fill="var(--blue-9)" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card size="3">
              {jobsLoading ? (
                <Text color="gray">Loading…</Text>
              ) : lowMarginRows.length === 0 ? (
                <Text color="gray">
                  No jobs with margin data in this period.
                </Text>
              ) : (
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Job #</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Income
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Expenses
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Profit
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="end">
                        Margin %
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lowMarginRows.map((row) => (
                      <Table.Row key={row.job_id}>
                        <Table.Cell>#{row.job_number}</Table.Cell>
                        <Table.Cell>{row.title}</Table.Cell>
                        <Table.Cell>{row.customer_name ?? '—'}</Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.income)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.expenses)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {formatCurrency(row.profit)}
                        </Table.Cell>
                        <Table.Cell align="end">
                          {row.margin_pct != null ? `${row.margin_pct}%` : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() =>
                              navigate({
                                to: '/jobs',
                                search: { jobId: row.job_id },
                              })
                            }
                          >
                            Open
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Card>
          </>
        )}
      </Flex>
    </Box>
  )
}
