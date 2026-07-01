import { useState } from 'react'
import { IncomeExpensesChart } from './IncomeExpensesChart'
import type { Meta, StoryObj } from '@storybook/react-vite'

const sampleData = [
  { month: 'Jan', income: 120000, expenses: 80000 },
  { month: 'Feb', income: 135000, expenses: 92000 },
  { month: 'Mar', income: 98000, expenses: 75000 },
  { month: 'Apr', income: 150000, expenses: 110000 },
  { month: 'May', income: 142000, expenses: 88000 },
  { month: 'Jun', income: 168000, expenses: 95000 },
]

const meta = {
  title: 'Shared/IncomeExpensesChart',
  component: IncomeExpensesChart,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Recharts-based income vs expenses chart. Uses Radix theme colors and respects dark mode.',
      },
    },
  },
} satisfies Meta<typeof IncomeExpensesChart>

export default meta
type Story = StoryObj<typeof meta>

export const BarChart: Story = {
  args: {
    data: sampleData,
    chartType: 'bar',
    height: 320,
  },
}

export const LineChart: Story = {
  args: {
    data: sampleData,
    chartType: 'line',
    height: 320,
  },
}

export const AreaChart: Story = {
  args: {
    data: sampleData,
    chartType: 'area',
    height: 320,
  },
}

export const ComposedChart: Story = {
  args: {
    data: sampleData.map((d) => ({
      ...d,
      result: d.income - d.expenses,
    })),
    chartType: 'composed',
    height: 320,
  },
}

export const InteractiveTypeSwitcher: Story = {
  render: () => {
    const [chartType, setChartType] = useState<
      'bar' | 'line' | 'area' | 'composed'
    >('bar')
    return (
      <IncomeExpensesChart
        data={sampleData}
        chartType={chartType}
        onChartTypeChange={setChartType}
        height={320}
      />
    )
  },
}
