// src/features/company/components/PanelBackgroundPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import type { RadixPanelBackground } from '../api/queries'

const PANEL_BACKGROUND_OPTIONS: Array<{
  value: RadixPanelBackground
  label: string
  description: string
}> = [
  { value: 'solid', label: 'Solid', description: 'Opaque backgrounds' },
  {
    value: 'translucent',
    label: 'Translucent',
    description: 'Semi-transparent backgrounds',
  },
]

export default function PanelBackgroundPicker({
  value,
  onChange,
}: {
  value: RadixPanelBackground
  onChange: (panelBackground: RadixPanelBackground) => void
}) {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">
        Panel background
      </Text>
      <Grid columns="2" gap="2" style={{ maxWidth: '100%' }}>
        {PANEL_BACKGROUND_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <PanelBackgroundOption
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              isSelected={isSelected}
              onClick={() => onChange(option.value)}
            />
          )
        })}
      </Grid>
    </Box>
  )
}

function PanelBackgroundOption({
  value,
  label,
  description,
  isSelected,
  onClick,
}: {
  value: RadixPanelBackground
  label: string
  description: string
  isSelected: boolean
  onClick: () => void
}) {
  const isTranslucent = value === 'translucent'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 6,
        background: isTranslucent
          ? 'rgba(128, 128, 128, 0.5)'
          : 'var(--gray-a3)',
        border: isSelected
          ? '2px solid var(--gray-12)'
          : '1px solid var(--gray-a6)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isSelected
          ? '0 0 0 1px var(--gray-a3)'
          : '0 1px 2px rgba(0, 0, 0, 0.1)',
        outline: 'none',
        textAlign: 'left',
        width: '100%',
      }}
      aria-label={`Select ${label} panel background`}
      title={label}
    >
      <Flex direction="column" gap="0.5" align="start">
        <Text size="2" weight="medium">
          {label}
        </Text>
        <Text size="1" color="gray" style={{ fontSize: 'var(--font-size-1)' }}>
          {description}
        </Text>
      </Flex>
    </button>
  )
}
