import { useState } from 'react'
import DatePicker from './DatePicker'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/Pickers/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Date-only picker using a calendar grid. Returns ISO date strings (YYYY-MM-DD).',
      },
    },
  },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

function ControlledDatePicker(
  props: Omit<React.ComponentProps<typeof DatePicker>, 'value' | 'onChange'> & {
    initialValue?: string
  },
) {
  const { initialValue = '', ...rest } = props
  const [value, setValue] = useState(initialValue)
  return <DatePicker {...rest} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: () => <ControlledDatePicker label="Date" />,
}

export const WithValue: Story = {
  render: () => (
    <ControlledDatePicker label="Due date" initialValue="2026-08-01" />
  ),
}

export const NorwegianLocale: Story = {
  render: () => (
    <ControlledDatePicker label="Dato" locale="nb" initialValue="2026-08-01" />
  ),
}

export const Invalid: Story = {
  render: () => <ControlledDatePicker label="Date" invalid />,
}

export const Disabled: Story = {
  render: () => (
    <ControlledDatePicker label="Date" disabled initialValue="2026-08-01" />
  ),
}

export const IconButton: Story = {
  render: () => <ControlledDatePicker iconButton initialValue="2026-08-01" />,
}
