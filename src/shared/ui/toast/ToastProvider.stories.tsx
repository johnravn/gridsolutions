import { Button, Flex } from '@radix-ui/themes'
import { useToast } from './ToastProvider'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/AppToast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App toasts for success, error, and info. Desktop sits bottom-right; phone uses a top banner.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function ToastPlayground() {
  const toast = useToast()
  return (
    <Flex gap="2" wrap="wrap">
      <Button onClick={() => toast.success('Saved', 'Time entry added')}>
        Success
      </Button>
      <Button
        color="red"
        onClick={() => toast.error('Save failed', 'Please try again.')}
      >
        Error
      </Button>
      <Button variant="soft" onClick={() => toast.info('Copied to clipboard')}>
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.success(
            'Item removed',
            'You can still undo this.',
            undefined,
            () => {},
          )
        }
      >
        Success with undo
      </Button>
    </Flex>
  )
}

export const Default: Story = {
  render: () => <ToastPlayground />,
}
