import { useState } from 'react'
import DateTimeRangePicker from './DateTimeRangePicker'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/Pickers/DateTimeRangePicker',
  component: DateTimeRangePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-step range picker: select start/end dates, then hours and minutes. Supports all-day ranges and per-minute precision via `minuteStep`.',
      },
    },
  },
} satisfies Meta<typeof DateTimeRangePicker>

export default meta
type Story = StoryObj<typeof meta>

function ControlledRangePicker(
  props: Omit<
    React.ComponentProps<typeof DateTimeRangePicker>,
    'startAt' | 'endAt' | 'onChange'
  > & {
    initialStart?: string
    initialEnd?: string
  },
) {
  const { initialStart = '', initialEnd = '', ...rest } = props
  const [startAt, setStartAt] = useState(initialStart)
  const [endAt, setEndAt] = useState(initialEnd)
  return (
    <DateTimeRangePicker
      {...rest}
      startAt={startAt}
      endAt={endAt}
      onChange={({ startAt: s, endAt: e }) => {
        setStartAt(s)
        setEndAt(e)
      }}
    />
  )
}

export const Default: Story = {
  render: () => <ControlledRangePicker label="Job period" />,
}

export const WithValue: Story = {
  render: () => (
    <ControlledRangePicker
      label="Rental period"
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}

export const NorwegianLocale: Story = {
  render: () => (
    <ControlledRangePicker
      label="Periode"
      locale="nb"
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}

export const PerMinutePrecision: Story = {
  render: () => (
    <ControlledRangePicker
      label="Exact times"
      minuteStep={1}
      initialStart="2026-07-01T08:15:00.000Z"
      initialEnd="2026-07-01T10:45:00.000Z"
    />
  ),
}

export const Invalid: Story = {
  render: () => <ControlledRangePicker label="Period" invalid />,
}

export const Disabled: Story = {
  render: () => (
    <ControlledRangePicker
      label="Period"
      disabled
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}
