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
          'Multi-step range picker: select start/end dates, then hours and minutes. Supports all-day ranges, per-minute precision via `minuteStep`, and an `inline` one-line trigger on large screens (stacked on small screens).',
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

export const DateOnly: Story = {
  render: () => (
    <ControlledRangePicker
      label="Period"
      dateOnly
      initialStart="2026-07-01T00:00:00.000Z"
      initialEnd="2026-07-15T23:59:59.999Z"
    />
  ),
}

export const DateOnlyOptionalEnd: Story = {
  render: () => (
    <ControlledRangePicker
      label="Period"
      dateOnly
      optionalEnd
      initialStart="2026-07-01T00:00:00.000Z"
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

export const Inline: Story = {
  render: () => (
    <ControlledRangePicker
      label="Crew period"
      inline
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}

/** Click Start or End on the closed trigger — each opens focused on that bound. */
export const ClickEitherBound: Story = {
  name: 'Click either Start or End',
  parameters: {
    docs: {
      description: {
        story:
          'With a filled range, Start and End are separate hit targets even while closed. Click End to refine end (keeps start); the next calendar click then sets start (SAS-style alternate). Unpinned picking also alternates: start → end → start…',
      },
    },
  },
  render: () => (
    <ControlledRangePicker
      label="Job period"
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}

/** Empty period — first calendar click sets start, second sets end, then cycles. */
export const AlternateClicks: Story = {
  name: 'Alternate start / end clicks',
  parameters: {
    docs: {
      description: {
        story:
          'SAS-inspired flow: open empty → click a day (start) → click another (end) → click again to start a new period. No need to tap Start/End between picks unless you want to pin a bound.',
      },
    },
  },
  render: () => <ControlledRangePicker label="Job period" />,
}

export const ClickEitherBoundDateOnly: Story = {
  name: 'Click either bound (date only)',
  render: () => (
    <ControlledRangePicker
      label="Period"
      dateOnly
      initialStart="2026-07-01T00:00:00.000Z"
      initialEnd="2026-07-15T23:59:59.999Z"
    />
  ),
}

export const ClickEitherBoundInline: Story = {
  name: 'Click either bound (inline)',
  render: () => (
    <ControlledRangePicker
      label="Crew period"
      inline
      initialStart="2026-07-01T08:00:00.000Z"
      initialEnd="2026-07-05T17:00:00.000Z"
    />
  ),
}
