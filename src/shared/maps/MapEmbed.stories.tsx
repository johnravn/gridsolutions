import MapEmbed from './MapEmbed'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/MapEmbed',
  component: MapEmbed,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Google Maps embed iframe. Requires `VITE_GOOGLE_MAPS_PLATFORM_API_KEY` in the environment — renders nothing without it.',
      },
    },
  },
} satisfies Meta<typeof MapEmbed>

export default meta
type Story = StoryObj<typeof meta>

export const OsloOffice: Story = {
  args: {
    query: 'Karl Johans gate 1, Oslo, Norway',
    zoom: 14,
    title: 'Oslo city center',
  },
}

export const Coordinates: Story = {
  args: {
    query: '59.9139,10.7522',
    zoom: 12,
    title: 'Oslo coordinates',
  },
}

export const MissingApiKey: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'When the API key is not set, the component returns null (check browser console in dev).',
      },
    },
  },
  render: () => (
    <div>
      <p style={{ marginBottom: 16, color: 'var(--gray-11)' }}>
        Map renders only when VITE_GOOGLE_MAPS_PLATFORM_API_KEY is configured.
      </p>
      <MapEmbed query="Oslo, Norway" />
    </div>
  ),
}
