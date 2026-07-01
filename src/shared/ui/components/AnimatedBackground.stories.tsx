import { Box, Card, Text } from '@radix-ui/themes'
import { AnimatedBackground } from './AnimatedBackground'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/AnimatedBackground',
  component: AnimatedBackground,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Floating geometric shapes behind translucent cards. Used on auth and marketing surfaces.',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AnimatedBackground>

export default meta
type Story = StoryObj<typeof meta>

function BackgroundDemo(
  props: React.ComponentProps<typeof AnimatedBackground>,
) {
  return (
    <Box style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}>
      <Box style={{ position: 'absolute', inset: 0 }}>
        <AnimatedBackground {...props} />
      </Box>
      <Box style={{ position: 'relative', padding: 48 }}>
        <Card size="3" style={{ maxWidth: 360 }}>
          <Text size="3" weight="bold">
            Content on top
          </Text>
          <Text as="p" size="2" color="gray" mt="2">
            Cards use translucent styling from app styles when the light theme
            is active.
          </Text>
        </Card>
      </Box>
    </Box>
  )
}

export const Default: Story = {
  render: () => <BackgroundDemo />,
}

export const Triangles: Story = {
  render: () => <BackgroundDemo shapeType="triangles" />,
}

export const Rectangles: Story = {
  render: () => <BackgroundDemo shapeType="rectangles" intensity={0.6} />,
}

export const SlowMotion: Story = {
  render: () => <BackgroundDemo speed={0.5} intensity={0.8} />,
}
