import InspectorSkeleton from './InspectorSkeleton'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/InspectorSkeleton',
  component: InspectorSkeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Loading skeleton for the job/entity inspector panel (header, tabs, form fields).',
      },
    },
  },
} satisfies Meta<typeof InspectorSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
