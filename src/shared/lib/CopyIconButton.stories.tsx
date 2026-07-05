import { Flex, Text } from '@radix-ui/themes'
import { CopyIconButton } from './CopyIconButton'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/CopyIconButton',
  component: CopyIconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Icon button that copies text to the clipboard and shows a success toast.',
      },
    },
  },
} satisfies Meta<typeof CopyIconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Flex align="center" gap="2">
      <Text size="2">job-abc-123</Text>
      <CopyIconButton text="job-abc-123" />
    </Flex>
  ),
}

export const CustomLabels: Story = {
  render: () => (
    <CopyIconButton
      text="https://gridsolutions.app/jobs/42"
      copyLabel="Copy link"
      copiedLabel="Link copied!"
    />
  ),
}
