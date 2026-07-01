import { useState } from 'react'
import { SearchableSelect } from './SearchableSelect'
import type { Meta, StoryObj } from '@storybook/react-vite'

const sampleOptions = [
  { value: 'acme', label: 'Acme Corp', description: 'Oslo' },
  { value: 'beta', label: 'Beta Industries', description: 'Bergen' },
  { value: 'gamma', label: 'Gamma AS', description: 'Trondheim' },
  { value: 'delta', label: 'Delta Solutions', description: 'Stavanger' },
  { value: 'echo', label: 'Echo Media', description: 'Tromsø' },
]

const meta = {
  title: 'Shared/SearchableSelect',
  component: SearchableSelect,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Fuzzy-search dropdown with portal rendering. Use `preventDialogCloseOnSearchableSelect` when inside Radix dialogs.',
      },
    },
  },
  argTypes: {
    filterLocally: {
      description: 'When false, parent handles filtering via onInputChange.',
    },
  },
} satisfies Meta<typeof SearchableSelect>

export default meta
type Story = StoryObj<typeof meta>

function ControlledSelect(
  props: Omit<
    React.ComponentProps<typeof SearchableSelect>,
    'value' | 'onValueChange' | 'options'
  > & {
    initialValue?: string
    options?: typeof sampleOptions
  },
) {
  const { initialValue = '', options = sampleOptions, ...rest } = props
  const [value, setValue] = useState(initialValue)
  return (
    <SearchableSelect
      {...rest}
      options={options}
      value={value}
      onValueChange={setValue}
    />
  )
}

export const Default: Story = {
  render: () => (
    <ControlledSelect placeholder="Search customers…" style={{ width: 280 }} />
  ),
}

export const WithSelection: Story = {
  render: () => (
    <ControlledSelect
      placeholder="Search customers…"
      initialValue="beta"
      style={{ width: 280 }}
    />
  ),
}

export const Loading: Story = {
  render: () => (
    <ControlledSelect placeholder="Searching…" loading style={{ width: 280 }} />
  ),
}

export const ServerFiltered: Story = {
  render: () => {
    const [value, setValue] = useState('')
    const [query, setQuery] = useState('')
    const filtered = sampleOptions.filter((o) =>
      o.label.toLowerCase().includes(query.toLowerCase()),
    )
    return (
      <SearchableSelect
        options={filtered}
        value={value}
        onValueChange={setValue}
        filterLocally={false}
        onInputChange={setQuery}
        placeholder="Type to filter (server mode)…"
        style={{ width: 280 }}
      />
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <ControlledSelect
      placeholder="Disabled"
      disabled
      initialValue="acme"
      style={{ width: 280 }}
    />
  ),
}
