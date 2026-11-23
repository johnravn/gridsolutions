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
          'Subtle fine-grid lattice only (no decorative geometry). Used on auth and optional app-shell personalization.',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AnimatedBackground>

export default meta
type Story = StoryObj<typeof meta>

function BackgroundDemo({ intensity = 0.35 }: { intensity?: number }) {
  return (
    <Box style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}>
      <Box style={{ position: 'absolute', inset: 0 }}>
        <AnimatedBackground intensity={intensity} subtleMotion />
      </Box>
      <Box style={{ position: 'relative', padding: 48 }}>
        <Card size="3" style={{ maxWidth: 360 }}>
          <Text size="3" weight="bold">
            Subtle grid
          </Text>
          <Text as="p" size="2" color="gray" mt="2">
            Lattice only — no polygons, bands, or circuit art.
          </Text>
        </Card>
      </Box>
    </Box>
  )
}

export const Default: Story = {
  render: () => <BackgroundDemo />,
}

export const RecommendedIntensity: Story = {
  render: () => <BackgroundDemo intensity={0.35} />,
}

export const FullIntensity: Story = {
  render: () => <BackgroundDemo intensity={1} />,
}
