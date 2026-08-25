// src/shared/ui/components/IncomeExpensesChart.tsx
import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { useTheme } from '@app/hooks/useTheme'
import { Box, Button, Flex, Text } from '@radix-ui/themes'

type ChartData = {
  month: string
  income: number
  expenses: number
  result?: number
}

type ChartType = 'bar' | 'line' | 'area' | 'composed'

type IncomeExpensesChartProps = {
  data: Array<ChartData>
  height?: number
  chartType?: ChartType
  onChartTypeChange?: (type: ChartType) => void
}

/**
 * Chart component that displays income vs expenses by month
 * Automatically uses Radix UI theme colors
 */
export function IncomeExpensesChart({
  data,
  height,
  chartType: controlledChartType,
  onChartTypeChange: _onChartTypeChange,
}: IncomeExpensesChartProps) {
  void _onChartTypeChange
  const { isDark } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = React.useState(height || 300)
  const [internalChartType, _setInternalChartType] =
    React.useState<ChartType>('area')
  void _setInternalChartType

  // Use controlled chartType if provided, otherwise use internal state
  const chartType = controlledChartType ?? internalChartType

  // Update chart height based on container size when no height prop is provided
  React.useEffect(() => {
    if (height !== undefined) {
      // Use provided height
      setChartHeight(height)
      return
    }

    const updateHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight
        if (containerHeight > 0) {
          setChartHeight(containerHeight)
        }
      }
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [height])

  // Get colors from Radix CSS variables
  const getThemeColor = (variable: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(variable).trim()
    return value || fallback
  }

  // Theme-aware colors
  const textColor = isDark ? '#ffffff' : '#000000'
  const gridColor = isDark
    ? getThemeColor('--gray-6', '#2e2e2e')
    : getThemeColor('--gray-4', '#e5e5e5')

  // Get Radix colors
  const greenBase = getThemeColor('--green-9', '#30a46c')
  const redBase = getThemeColor('--red-9', '#e5484d')
  const blueBase = getThemeColor('--blue-9', '#3e63dd')

  // Convert hex/rgb to rgba with 0.7 opacity
  const hexToRgba = (color: string, alpha: number): string => {
    // If it's already rgba or rgb, handle it
    if (color.startsWith('rgba') || color.startsWith('rgb(')) {
      if (color.startsWith('rgba')) {
        return color.replace(/[\d.]+\)$/g, `${alpha})`)
      } else {
        return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
      }
    }
    // If it's hex
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    // Fallback - return as-is if we can't parse
    return color
  }

  // Income color - Radix green with transparency
  const incomeColor = hexToRgba(greenBase, 0.7)

  // Expenses color - Radix red with transparency
  const expensesColor = hexToRgba(redBase, 0.7)

  // Result (net profit) color - Radix blue with transparency
  const resultColor = hexToRgba(blueBase, 0.7)

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{
      name: string
      value: number
      dataKey: string
      color: string
      payload?: ChartData
    }>
  }) => {
    if (!active || !payload || payload.length === 0) return null

    const getLabel = (dataKey: string): string => {
      switch (dataKey) {
        case 'income':
          return 'Income'
        case 'expenses':
          return 'Expenses'
        case 'result':
          return 'Net Profit'
        default:
          return dataKey
      }
    }

    return (
      <Box
        style={{
          background: isDark
            ? 'rgba(0, 0, 0, 0.9)'
            : 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${gridColor}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
          {payload[0]?.payload?.month || ''}
        </Text>
        {payload.map((entry, index) => (
          <Text
            key={index}
            size="1"
            style={{
              color: entry.color,
              display: 'block',
              marginBottom: '4px',
            }}
          >
            {getLabel(entry.dataKey)}: {formatCurrency(entry.value)}
          </Text>
        ))}
      </Box>
    )
  }

  // Calculate result (net profit) for each data point
  const dataWithResult = React.useMemo(() => {
    return data.map((item) => ({
      ...item,
      result: item.income - item.expenses,
    }))
  }, [data])

  if (data.length === 0) {
    return (
      <Box
        py="6"
        style={{
          border: `2px dashed ${gridColor}`,
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <Text size="2" color="gray">
          No data available
        </Text>
      </Box>
    )
  }

  const renderChart = () => {
    const commonProps = {
      data: dataWithResult,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    }

    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="month"
          stroke={textColor}
          tick={{ fill: textColor, fontSize: 12 }}
        />
        <YAxis
          stroke={textColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
            return value.toString()
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: textColor }} iconType="square" />
      </>
    )

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonAxis}
            <Line
              type="monotone"
              dataKey="income"
              stroke={incomeColor}
              strokeWidth={3}
              name="Income"
              dot={{ fill: incomeColor, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke={expensesColor}
              strokeWidth={3}
              name="Expenses"
              dot={{ fill: expensesColor, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonAxis}
            <Area
              type="monotone"
              dataKey="income"
              stroke={incomeColor}
              fill={incomeColor}
              name="Income"
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={expensesColor}
              fill={expensesColor}
              name="Expenses"
              fillOpacity={0.7}
            />
          </AreaChart>
        )

      case 'composed':
        return (
          <ComposedChart {...commonProps} barCategoryGap="10%">
            {commonAxis}
            <Bar
              dataKey="income"
              fill={incomeColor}
              name="Income"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
            <Bar
              dataKey="expenses"
              fill={expensesColor}
              name="Expenses"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
            <Line
              type="monotone"
              dataKey="result"
              stroke={resultColor}
              strokeWidth={3}
              name="Net Profit"
              dot={{ fill: resultColor, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        )

      case 'bar':
      default:
        return (
          <BarChart {...commonProps} barCategoryGap="10%">
            {commonAxis}
            <Bar
              dataKey="income"
              fill={incomeColor}
              name="Income"
              radius={[4, 4, 0, 0]}
              barSize={40}
            />
            <Bar
              dataKey="expenses"
              fill={expensesColor}
              name="Expenses"
              radius={[4, 4, 0, 0]}
              barSize={40}
            />
          </BarChart>
        )
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    >
      <ResponsiveContainer width="100%" height={chartHeight}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}

// Export chart type selector as separate component
export function ChartTypeSelector({
  chartType,
  onChartTypeChange,
}: {
  chartType: ChartType
  onChartTypeChange: (type: ChartType) => void
}) {
  return (
    <Flex gap="1" align="center" wrap="wrap">
      <Button
        variant={chartType === 'bar' ? 'solid' : 'soft'}
        size="1"
        onClick={() => onChartTypeChange('bar')}
      >
        Bar
      </Button>
      <Button
        variant={chartType === 'line' ? 'solid' : 'soft'}
        size="1"
        onClick={() => onChartTypeChange('line')}
      >
        Line
      </Button>
      <Button
        variant={chartType === 'area' ? 'solid' : 'soft'}
        size="1"
        onClick={() => onChartTypeChange('area')}
      >
        Area
      </Button>
      <Button
        variant={chartType === 'composed' ? 'solid' : 'soft'}
        size="1"
        onClick={() => onChartTypeChange('composed')}
      >
        Composed
      </Button>
    </Flex>
  )
}
