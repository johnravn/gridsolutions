import { useState } from 'react'
import { Text } from '@radix-ui/themes'
import CompanyLogoUpload from './CompanyLogoUpload'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/CompanyLogoUpload',
  component: CompanyLogoUpload,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Dual light/dark company logo upload. Stores separate assets under a shared path prefix. Uses mocked Supabase storage in Storybook.',
      },
    },
  },
} satisfies Meta<typeof CompanyLogoUpload>

export default meta
type Story = StoryObj<typeof meta>

function ControlledCompanyLogoUpload(
  props: Omit<
    React.ComponentProps<typeof CompanyLogoUpload>,
    'currentLightLogoPath' | 'currentDarkLogoPath' | 'onUploadComplete'
  > & {
    initialLight?: string | null
    initialDark?: string | null
  },
) {
  const { initialLight = null, initialDark = null, ...rest } = props
  const [light, setLight] = useState<string | null>(initialLight)
  const [dark, setDark] = useState<string | null>(initialDark)
  return (
    <div>
      <CompanyLogoUpload
        {...rest}
        currentLightLogoPath={light}
        currentDarkLogoPath={dark}
        onUploadComplete={(l, d) => {
          setLight(l)
          setDark(d)
        }}
      />
      <Text as="p" size="1" color="gray" mt="2">
        Light: {light ?? '—'} · Dark: {dark ?? '—'}
      </Text>
    </div>
  )
}

export const Empty: Story = {
  render: () => (
    <ControlledCompanyLogoUpload uploadPathPrefix="companies/demo" />
  ),
}

export const WithLogos: Story = {
  render: () => (
    <ControlledCompanyLogoUpload
      uploadPathPrefix="companies/demo"
      initialLight="companies/demo/logo-light.png"
      initialDark="companies/demo/logo-dark.png"
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <ControlledCompanyLogoUpload
      uploadPathPrefix="companies/demo"
      initialLight="companies/demo/logo-light.png"
      initialDark="companies/demo/logo-dark.png"
      disabled
    />
  ),
}
