// src/features/company/components/ScalingPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import type { RadixScaling } from '../api/queries'

const SCALING_OPTIONS: Array<{ value: RadixScaling; label: string }> = [
  { value: '90%', label: '90%' },
  { value: '95%', label: '95%' },
  { value: '100%', label: '100%' },
  { value: '105%', label: '105%' },
  { value: '110%', label: '110%' },
]

export default function ScalingPicker({
  value,
  onChange,
}: {
  value: RadixScaling
  onChange: (scaling: RadixScaling) => void
}) {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">
        Scaling
      </Text>
      <Grid columns="5" gap="1.5" style={{ maxWidth: '100%' }}>
        {SCALING_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <ScalingOption
              key={option.value}
              value={option.value}
              label={option.label}
              isSelected={isSelected}
              onClick={() => onChange(option.value)}
            />
          )
        })}
      </Grid>
    </Box>
  )
}

function ScalingOption({
  value,
  label,
  isSelected,
  onClick,
}: {
  value: RadixScaling
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  // Convert percentage to scale factor for visual preview
  const scale = parseFloat(value) / 100

  return (
    <Flex direction="column" align="center" gap="0.5">
      <button
        type="button"
        onClick={onClick}
        style={{
          width: `${32 * scale}px`,
          height: `${32 * scale}px`,
          borderRadius: 6,
          background: 'var(--gray-a3)',
          border: isSelected
            ? '2px solid var(--gray-12)'
            : '1px solid var(--gray-a6)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: isSelected
            ? '0 0 0 1px var(--gray-a3)'
            : '0 1px 2px rgba(0, 0, 0, 0.1)',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`Select ${label} scaling`}
        title={label}
      >
        <div
          style={{
            width: `${16 * scale}px`,
            height: `${16 * scale}px`,
            borderRadius: 3,
            background: 'var(--gray-9)',
          }}
        />
      </button>
      <Text
        size="1"
        color={isSelected ? undefined : 'gray'}
        style={{ fontSize: '10px' }}
      >
        {label}
      </Text>
    </Flex>
  )
}
