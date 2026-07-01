import { useState } from 'react'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/PhoneInputField',
  component: PhoneInputField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'E.164 phone input with Radix-styled field shim. Defaults to Norway (+47).',
      },
    },
  },
} satisfies Meta<typeof PhoneInputField>

export default meta
type Story = StoryObj<typeof meta>

function ControlledPhone(
  props: Omit<
    React.ComponentProps<typeof PhoneInputField>,
    'value' | 'onChange'
  > & {
    initialValue?: string
  },
) {
  const { initialValue, ...rest } = props
  const [value, setValue] = useState<string | undefined>(initialValue)
  return <PhoneInputField {...rest} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: () => <ControlledPhone />,
}

export const WithValue: Story = {
  render: () => <ControlledPhone initialValue="+4798765432" />,
}

export const SwedishDefault: Story = {
  render: () => (
    <ControlledPhone defaultCountry="SE" placeholder="Swedish number" />
  ),
}

export const Disabled: Story = {
  render: () => <ControlledPhone disabled initialValue="+4798765432" />,
}
