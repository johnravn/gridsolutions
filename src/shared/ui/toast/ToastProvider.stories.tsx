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
          'App toasts for success, error, info, and in-progress work. Desktop sits bottom-right; phone uses a top banner. Progress toasts stay until they succeed, fail, or are dismissed.',
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
      <Button
        variant="soft"
        onClick={() => {
          const handle = toast.progress('Booking items…', 'Reserving equipment')
          window.setTimeout(() => handle.update({ current: 1, total: 3 }), 400)
          window.setTimeout(() => handle.update({ current: 2, total: 3 }), 900)
          window.setTimeout(
            () => handle.success('Items reserved', '3 bookings saved'),
            1400,
          )
        }}
      >
        Progress then success
      </Button>
      <Button
        color="red"
        variant="outline"
        onClick={() => {
          const handle = toast.progress('Updating booking…')
          window.setTimeout(
            () => handle.error('Failed to update', 'Please try again.'),
            1200,
          )
        }}
      >
        Progress then error
      </Button>
    </Flex>
  )
}

export const Default: Story = {
  render: () => <ToastPlayground />,
}
