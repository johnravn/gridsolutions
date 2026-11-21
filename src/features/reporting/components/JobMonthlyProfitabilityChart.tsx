import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, Flex, Text } from '@radix-ui/themes'
import {
  
  ChartTypeSelector
} from '@shared/ui/components/IncomeExpensesChart'
import { formatCurrency } from '../utils/format'
import type {ChartType} from '@shared/ui/components/IncomeExpensesChart';
import type { MonthlyJobProfitabilityPoint } from '../utils/monthlyJobs'

const JOB_CHART_TYPES: Array<ChartType> = ['composed', 'area', 'line']

const CHART_HEIGHT = 440

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
  payload?: MonthlyJobProfitabilityPoint
}

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<TooltipEntry>
}) {
  if (!active || !payload?.length) return null
  const label = payload[0]?.payload?.month_label ?? ''
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
        {label}
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

function MoneyAxes() {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
      <XAxis
        dataKey="month_label"
        tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
        tickMargin={8}
        height={36}
        interval="preserveStartEnd"
      />
      <YAxis
        yAxisId="money"
        tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
        tickFormatter={formatMoneyTick}
        width={48}
      />
      <YAxis
        yAxisId="jobs"
        orientation="right"
        allowDecimals={false}
        tick={{ fontSize: 12, fill: 'var(--gray-11)' }}
        width={36}
        label={{
          value: 'Jobs',
          angle: 90,
          position: 'insideRight',
          offset: 8,
          style: { fill: 'var(--gray-10)', fontSize: 11 },
        }}
      />
      <Tooltip content={<MonthlyTooltip />} />
      <Legend wrapperStyle={{ paddingTop: 4 }} />
    </>
  )
}

function renderSeries(mode: ChartType) {
  const income = 'var(--green-9)'
  const expenses = 'var(--red-9)'
  const profit = 'var(--blue-9)'
  const jobs = 'var(--orange-9)'

  if (mode === 'line') {
    return (
      <>
        <Line
          yAxisId="money"
          type="monotone"
          dataKey="income"
          name="Income"
          stroke={income}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="money"
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke={expenses}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="money"
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke={profit}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="jobs"
          type="monotone"
          dataKey="job_count"
          name="Jobs"
          stroke={jobs}
          strokeWidth={2.5}
          strokeDasharray="4 3"
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </>
    )
  }

  if (mode === 'area') {
    return (
      <>
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="income"
          name="Income"
          stroke={income}
          fill={income}
          fillOpacity={0.35}
        />
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke={expenses}
          fill={expenses}
          fillOpacity={0.35}
        />
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke={profit}
          fill={profit}
          fillOpacity={0.3}
        />
        <Line
          yAxisId="jobs"
          type="monotone"
          dataKey="job_count"
          name="Jobs"
          stroke={jobs}
          strokeWidth={2.5}
          strokeDasharray="4 3"
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </>
    )
  }

  // composed (default): money as bars, jobs as a bar on the secondary axis
  return (
    <>
      <Bar
        yAxisId="money"
        dataKey="income"
        name="Income"
        fill={income}
        radius={[3, 3, 0, 0]}
        maxBarSize={28}
      />
      <Bar
        yAxisId="money"
        dataKey="expenses"
        name="Expenses"
        fill={expenses}
        radius={[3, 3, 0, 0]}
        maxBarSize={28}
      />
      <Bar
        yAxisId="money"
        dataKey="profit"
        name="Profit"
        fill={profit}
        radius={[3, 3, 0, 0]}
        maxBarSize={28}
      />
      <Bar
        yAxisId="jobs"
        dataKey="job_count"
        name="Jobs"
        fill={jobs}
        radius={[3, 3, 0, 0]}
        maxBarSize={18}
      />
    </>
  )
}

export function JobMonthlyProfitabilityChart({
  data,
}: {
  data: Array<MonthlyJobProfitabilityPoint>
}) {
  const [chartType, setChartType] = React.useState<ChartType>('composed')

  if (data.length === 0) return null

  const hasAny = data.some(
    (d) =>
      d.income !== 0 || d.expenses !== 0 || d.profit !== 0 || d.job_count !== 0,
  )
  if (!hasAny) return null

  const mode: ChartType = JOB_CHART_TYPES.includes(chartType)
    ? chartType
    : 'composed'

  const commonProps = {
    data,
    margin: { top: 12, right: 12, left: 4, bottom: 4 },
    barCategoryGap: '18%' as const,
  }

  let chart: React.ReactElement
  if (mode === 'line') {
    chart = (
      <LineChart {...commonProps}>
        <MoneyAxes />
        {renderSeries(mode)}
      </LineChart>
    )
  } else if (mode === 'area') {
    chart = (
      <AreaChart {...commonProps}>
        <MoneyAxes />
        {renderSeries(mode)}
      </AreaChart>
    )
  } else {
    chart = (
      <ComposedChart {...commonProps}>
        <MoneyAxes />
        {renderSeries('composed')}
      </ComposedChart>
    )
  }

  return (
    <Card size="3">
      <Flex justify="between" align="center" wrap="wrap" gap="2" mb="2">
        <Text size="1" color="gray">
          Monthly income, expenses, profit, and job count
        </Text>
        <ChartTypeSelector
          chartType={mode}
          onChartTypeChange={setChartType}
          types={JOB_CHART_TYPES}
        />
      </Flex>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {chart}
      </ResponsiveContainer>
    </Card>
  )
}

export const JOB_MONTHLY_CHART_HEIGHT = CHART_HEIGHT
