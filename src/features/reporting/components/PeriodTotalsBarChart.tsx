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
import { Card, Flex, Text } from '@radix-ui/themes'
import { formatCurrency } from '../utils/format'
import { periodTotalsChartDomains } from '../utils/periodTotals'
import type { PeriodTotals } from '../utils/periodTotals'

const CHART_HEIGHT = 440

const FILL = {
  expenses: 'var(--red-9)',
  income: 'var(--green-9)',
  jobs: 'var(--orange-9)',
  profit: 'var(--blue-9)',
} as const

function formatMoneyTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`
  return String(value)
}

type TooltipEntry = {
  name?: string
  value?: number
  dataKey?: string | number
  color?: string
}

function TotalsTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<TooltipEntry>
}) {
  if (!active || !payload?.length) return null
  return (
    <Flex
      direction="column"
      gap="1"
      style={{
        background: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: 'var(--shadow-3)',
      }}
    >
      <Text size="2" weight="medium">
        Period totals
      </Text>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? '')
        const isJobs = key === 'job_count'
        return (
          <Text
            key={key}
            size="1"
            style={{ color: entry.color, display: 'block' }}
          >
            {entry.name}:{' '}
            {isJobs
              ? String(entry.value ?? 0)
              : formatCurrency(Number(entry.value ?? 0))}
          </Text>
        )
      })}
    </Flex>
  )
}

export function PeriodTotalsBarChart({ totals }: { totals: PeriodTotals }) {
  const hasAny =
    totals.income !== 0 ||
    totals.expenses !== 0 ||
    totals.profit !== 0 ||
    totals.job_count !== 0
  if (!hasAny) return null

  const data = [
    {
      label: 'Total',
      expenses: totals.expenses,
      income: totals.income,
      job_count: totals.job_count,
      profit: totals.profit,
    },
  ]
  const { money: moneyDomain, jobs: jobsDomain } =
    periodTotalsChartDomains(totals)

  return (
    <Card size="3" style={{ flex: '1 1 280px', minWidth: 260, maxWidth: 420 }}>
      <Flex justify="between" align="center" wrap="wrap" gap="2" mb="2">
        <Text size="1" color="gray">
          Period totals
        </Text>
        <Text size="1" color="gray">
          NOK left · Jobs right
        </Text>
      </Flex>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
            tickMargin={8}
            height={28}
          />
          <YAxis
            yAxisId="money"
            domain={moneyDomain}
            tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
            tickFormatter={formatMoneyTick}
            width={48}
          />
          <YAxis
            yAxisId="jobs"
            orientation="right"
            domain={jobsDomain}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
            tickFormatter={(value: number) => (value < 0 ? '' : String(value))}
            width={36}
            label={{
              value: 'Jobs',
              angle: 90,
              position: 'insideRight',
              offset: 8,
              style: { fill: 'var(--gray-10)', fontSize: 11 },
            }}
          />
          <Tooltip content={<TotalsTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 4 }} />
          {/* Order: Expenses, Income, Jobs, Profit — matches the request. */}
          <Bar
            yAxisId="money"
            dataKey="expenses"
            name="Expenses"
            fill={FILL.expenses}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            yAxisId="money"
            dataKey="income"
            name="Income"
            fill={FILL.income}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            yAxisId="jobs"
            dataKey="job_count"
            name="Jobs"
            fill={FILL.jobs}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            yAxisId="money"
            dataKey="profit"
            name="Profit"
            fill={FILL.profit}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

export const PERIOD_TOTALS_CHART_HEIGHT = CHART_HEIGHT
