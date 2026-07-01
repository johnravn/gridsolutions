import { useState } from 'react'
import { Text } from '@radix-ui/themes'
import { NorwayZipCodeField } from './NorwayZipCodeField'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/NorwayZipCodeField',
  component: NorwayZipCodeField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Norwegian postal code input with debounced city lookup via norwegian-postalcodes-mapper.',
      },
    },
  },
} satisfies Meta<typeof NorwayZipCodeField>

export default meta
type Story = StoryObj<typeof meta>

function ControlledZip() {
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('')
  return (
    <div style={{ maxWidth: 200 }}>
      <NorwayZipCodeField
        value={zip}
        onChange={setZip}
        autoCompleteCity={setCity}
      />
      {city && (
        <Text as="p" size="2" color="gray" mt="2">
          City: {city}
        </Text>
      )}
    </div>
  )
}

export const Default: Story = {
  render: () => <ControlledZip />,
}

export const Prefilled: Story = {
  render: () => {
    const [zip, setZip] = useState('0361')
    const [city, setCity] = useState('')
    return (
      <div style={{ maxWidth: 200 }}>
        <NorwayZipCodeField
          value={zip}
          onChange={setZip}
          autoCompleteCity={setCity}
        />
        {city && (
          <Text as="p" size="2" color="gray" mt="2">
            City: {city}
          </Text>
        )}
      </div>
    )
  },
}
