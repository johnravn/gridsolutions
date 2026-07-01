import { useState } from 'react'
import DateTimePicker from './DateTimePicker'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/Pickers/DateTimePicker',
  component: DateTimePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Grid-based date and time picker with 5-minute precision. Returns ISO strings (or HH:MM when `timeOnly`). Wrapped in a popover for compact forms.',
      },
    },
  },
} satisfies Meta<typeof DateTimePicker>

export default meta
type Story = StoryObj<typeof meta>

function ControlledDateTimePicker(
  props: Omit<
    React.ComponentProps<typeof DateTimePicker>,
    'value' | 'onChange'
  > & {
    initialValue?: string
  },
) {
  const { initialValue = '', ...rest } = props
  const [value, setValue] = useState(initialValue)
  return <DateTimePicker {...rest} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: () => <ControlledDateTimePicker label="Start time" />,
}

export const WithValue: Story = {
  render: () => (
    <ControlledDateTimePicker
      label="Event start"
      initialValue="2026-07-15T14:30:00.000Z"
    />
  ),
}

export const DateOnly: Story = {
  render: () => (
    <ControlledDateTimePicker label="Date" dateOnly initialValue="2026-07-15" />
  ),
}

export const TimeOnly: Story = {
  render: () => (
    <ControlledDateTimePicker label="Time" timeOnly initialValue="14:30" />
  ),
}

export const NorwegianLocale: Story = {
  render: () => (
    <ControlledDateTimePicker
      label="Starttid"
      locale="nb"
      initialValue="2026-07-15T14:30:00.000Z"
    />
  ),
}

export const Invalid: Story = {
  render: () => <ControlledDateTimePicker label="Required field" invalid />,
}

export const Disabled: Story = {
  render: () => (
    <ControlledDateTimePicker
      label="Locked"
      disabled
      initialValue="2026-07-15T14:30:00.000Z"
    />
  ),
}

export const IconButton: Story = {
  render: () => (
    <ControlledDateTimePicker
      iconButton
      initialValue="2026-07-15T14:30:00.000Z"
    />
  ),
}
