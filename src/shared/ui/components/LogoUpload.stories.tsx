import { useState } from 'react'
import { Text } from '@radix-ui/themes'
import LogoUpload from './LogoUpload'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Shared/LogoUpload',
  component: LogoUpload,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single logo upload with 2:1 aspect ratio validation. Uploads to Supabase `logos` bucket. Uses mocked storage in Storybook.',
      },
    },
  },
} satisfies Meta<typeof LogoUpload>

export default meta
type Story = StoryObj<typeof meta>

function ControlledLogoUpload(
  props: Omit<
    React.ComponentProps<typeof LogoUpload>,
    'currentLogoPath' | 'onUploadComplete'
  > & {
    initialPath?: string | null
  },
) {
  const { initialPath = null, ...rest } = props
  const [path, setPath] = useState<string | null>(initialPath)
  return (
    <div>
      <LogoUpload {...rest} currentLogoPath={path} onUploadComplete={setPath} />
      {path && (
        <Text as="p" size="1" color="gray" mt="2">
          Stored path: {path}
        </Text>
      )}
    </div>
  )
}

export const Empty: Story = {
  render: () => <ControlledLogoUpload uploadPath="companies/demo/logo.jpg" />,
}

export const WithExistingLogo: Story = {
  render: () => (
    <ControlledLogoUpload
      uploadPath="companies/demo/logo.jpg"
      initialPath="companies/demo/logo.jpg"
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <ControlledLogoUpload
      uploadPath="companies/demo/logo.jpg"
      initialPath="companies/demo/logo.jpg"
      disabled
    />
  ),
}
