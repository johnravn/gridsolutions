import { Box, Card, Text } from '@radix-ui/themes'
import {
  AnimatedBackground,
  GEOMETRIC_BACKGROUND_PRESETS,
  type GeometricBackgroundPreset,
} from './AnimatedBackground'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/AnimatedBackground',
  component: AnimatedBackground,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Neutral geometric SVG backdrops (grid-slash, prism-bands, circuit, facet). Used on auth and optional app-shell personalization.',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AnimatedBackground>

export default meta
type Story = StoryObj<typeof meta>

function BackgroundDemo({
  preset,
  intensity = 0.85,
}: {
  preset?: GeometricBackgroundPreset
  intensity?: number
}) {
  const label =
    GEOMETRIC_BACKGROUND_PRESETS.find((p) => p.id === preset)?.label ??
    'Grid Slash (default)'

  return (
    <Box style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}>
      <Box style={{ position: 'absolute', inset: 0 }}>
        <AnimatedBackground
          preset={preset}
          intensity={intensity}
          subtleMotion
        />
      </Box>
      <Box style={{ position: 'relative', padding: 48 }}>
        <Card size="3" style={{ maxWidth: 360 }}>
          <Text size="3" weight="bold">
            {label}
          </Text>
          <Text as="p" size="2" color="gray" mt="2">
            Canvas preset — sharp neutral geometry, no soft circles.
          </Text>
        </Card>
      </Box>
    </Box>
  )
}

export const Default: Story = {
  render: () => <BackgroundDemo />,
}

export const GridSlash: Story = {
  render: () => <BackgroundDemo preset="grid-slash" />,
}

export const PrismBands: Story = {
  render: () => <BackgroundDemo preset="prism-bands" />,
}

export const Circuit: Story = {
  render: () => <BackgroundDemo preset="circuit" />,
}

export const Facet: Story = {
  render: () => <BackgroundDemo preset="facet" intensity={0.75} />,
}
