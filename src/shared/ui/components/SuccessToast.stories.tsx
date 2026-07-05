import { useState } from 'react'
import { Button } from '@radix-ui/themes'
import { SuccessToast } from './SuccessToast'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/SuccessToast',
  component: SuccessToast,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Standalone success toast using Radix Toast primitives. Auto-dismisses after 3 seconds.',
      },
    },
  },
} satisfies Meta<typeof SuccessToast>

export default meta
type Story = StoryObj<typeof meta>

function ToastDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show success toast</Button>
      <SuccessToast
        open={open}
        onOpenChange={setOpen}
        title="Saved"
        description="Your changes were saved successfully."
      />
    </>
  )
}

export const Default: Story = {
  render: () => <ToastDemo />,
}

export const TitleOnly: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show toast</Button>
        <SuccessToast open={open} onOpenChange={setOpen} title="Done!" />
      </>
    )
  },
}
