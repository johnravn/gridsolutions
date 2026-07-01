import { useState } from 'react'
import { SegmentedControl } from './SegmentedControl'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/Pickers/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Low-level tab-style control used inside date/time pickers. Not typically used standalone in forms.',
      },
    },
  },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

const segments = [
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
]

function ControlledSegmentedControl() {
  const [activeId, setActiveId] = useState('date')
  return (
    <SegmentedControl
      segments={segments}
      activeId={activeId}
      onChange={setActiveId}
    />
  )
}

export const Default: Story = {
  render: () => <ControlledSegmentedControl />,
}

export const ThreeSegments: Story = {
  render: () => {
    const [activeId, setActiveId] = useState('dates')
    return (
      <SegmentedControl
        segments={[
          { id: 'dates', label: 'Dates' },
          { id: 'hours', label: 'Hours' },
          { id: 'minutes', label: 'Minutes' },
        ]}
        activeId={activeId}
        onChange={setActiveId}
      />
    )
  },
}
