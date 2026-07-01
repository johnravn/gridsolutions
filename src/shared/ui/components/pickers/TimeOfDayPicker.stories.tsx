import { useState } from 'react'
import TimeOfDayPicker from './TimeOfDayPicker'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/Pickers/TimeOfDayPicker',
  component: TimeOfDayPicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Hour-only time picker. Returns an ISO string anchored to a reference date (defaults to today).',
      },
    },
  },
} satisfies Meta<typeof TimeOfDayPicker>

export default meta
type Story = StoryObj<typeof meta>

function ControlledTimeOfDayPicker(
  props: Omit<
    React.ComponentProps<typeof TimeOfDayPicker>,
    'value' | 'onChange'
  > & {
    initialValue?: string | null
  },
) {
  const { initialValue = null, ...rest } = props
  const [value, setValue] = useState<string | null>(initialValue)
  return <TimeOfDayPicker {...rest} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: () => <ControlledTimeOfDayPicker label="Start hour" />,
}

export const WithValue: Story = {
  render: () => (
    <ControlledTimeOfDayPicker
      label="Load-in"
      initialValue="2026-07-15T09:00:00.000Z"
    />
  ),
}

export const WithReferenceDate: Story = {
  render: () => (
    <ControlledTimeOfDayPicker
      label="Call time"
      referenceDate="2026-12-24"
      initialValue="2026-12-24T18:00:00.000Z"
    />
  ),
}

export const Invalid: Story = {
  render: () => <ControlledTimeOfDayPicker label="Time" invalid />,
}

export const Disabled: Story = {
  render: () => (
    <ControlledTimeOfDayPicker
      label="Time"
      disabled
      initialValue="2026-07-15T09:00:00.000Z"
    />
  ),
}
