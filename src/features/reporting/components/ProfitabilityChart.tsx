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
import { Card, Text } from '@radix-ui/themes'
import { formatCurrency } from '../utils/format'

export type ProfitabilityChartRow = {
  name: string
  income: number
  expenses: number
  profit: number
}

export function ProfitabilityChart({
  data,
  caption,
}: {
  data: Array<ProfitabilityChartRow>
  caption?: string
}) {
  if (data.length === 0) return null
  return (
    <Card size="3">
      {caption ? (
        <Text size="1" color="gray" mb="2" as="div">
          {caption}
        </Text>
      ) : null}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
          <YAxis
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend />
          <Bar dataKey="income" fill="var(--green-9)" name="Income" />
          <Bar dataKey="expenses" fill="var(--red-9)" name="Expenses" />
          <Bar dataKey="profit" fill="var(--blue-9)" name="Profit" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
