import { Button, DropdownMenu } from '@radix-ui/themes'
import { NavArrowDown } from 'iconoir-react'

export type InspectorMobileTabOption = { value: string; label: string }

/** Full-width tab picker for phone inspectors (replaces wrapped tab strips). */
export function InspectorMobileTabSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<InspectorMobileTabOption>
  onChange: (value: string) => void
}) {
  const current =
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? 'Tab'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          variant="soft"
          color="gray"
          size="3"
          aria-label={`Tab: ${current}`}
          style={{
            width: '100%',
            minHeight: 44,
            justifyContent: 'space-between',
          }}
        >
          {current}
          <NavArrowDown width={18} height={18} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start"
        style={{
          minWidth: 'var(--radix-dropdown-menu-trigger-width)',
          maxHeight: 'min(70vh, 400px)',
          overflowY: 'auto',
        }}
      >
        {options.map((opt) => (
          <DropdownMenu.Item
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            style={{ minHeight: 44, paddingTop: 12, paddingBottom: 12 }}
          >
            {opt.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
