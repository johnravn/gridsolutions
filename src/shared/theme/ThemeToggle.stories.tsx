import ThemeToggle from './ThemeToggle'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/ThemeToggle',
  component: ThemeToggle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Light / dark / system theme selector. Persists user override in localStorage.',
      },
    },
  },
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
