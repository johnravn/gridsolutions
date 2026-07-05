import PageSkeleton from './PageSkeleton'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/PageSkeleton',
  component: PageSkeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Full-page loading skeleton matching the list + inspector layout. Uses the same 1024px breakpoint as index pages (side-by-side on large screens, stacked on mobile).',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PageSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ListOnly: Story = {
  args: {
    columns: '1fr',
    showInspector: false,
  },
}

export const WideInspector: Story = {
  args: {
    columns: '2fr 3fr',
    showTableRows: 12,
  },
}

export const NoHeader: Story = {
  args: {
    showHeader: false,
  },
}
