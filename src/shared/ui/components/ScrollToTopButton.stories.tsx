import { useRef } from 'react'
import { Box, Card, Text } from '@radix-ui/themes'
import ScrollToTopButton from './ScrollToTopButton'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/ScrollToTopButton',
  component: ScrollToTopButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Floating button on small screens when the inspector is in view. Scrolls the list container back to top.',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ScrollToTopButton>

export default meta
type Story = StoryObj<typeof meta>

function ScrollDemo() {
  const listRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLDivElement>(null)

  return (
    <Box
      style={{
        height: 500,
        overflow: 'auto',
        border: '1px solid var(--gray-6)',
        borderRadius: 8,
        position: 'relative',
      }}
    >
      <Box ref={listRef} p="4">
        <Text size="4" weight="bold" mb="3" as="div">
          List section
        </Text>
        {Array.from({ length: 8 }, (_, i) => (
          <Card key={i} mb="2" size="1">
            <Text size="2">List item {i + 1}</Text>
          </Card>
        ))}
      </Box>
      <Box
        ref={inspectorRef}
        p="4"
        style={{ borderTop: '1px solid var(--gray-6)', minHeight: 300 }}
      >
        <Text size="4" weight="bold" mb="3" as="div">
          Inspector section
        </Text>
        <Text size="2" color="gray">
          Scroll down until this section is visible — the floating button
          appears (visible=true in this demo).
        </Text>
      </Box>
      <ScrollToTopButton
        listRef={listRef}
        inspectorRef={inspectorRef}
        visible
      />
    </Box>
  )
}

export const Default: Story = {
  render: () => <ScrollDemo />,
}
