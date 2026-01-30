// src/features/company/components/RadiusPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import type { RadixRadius } from '../api/queries'

const RADIUS_OPTIONS: Array<{ value: RadixRadius; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'full', label: 'Full' },
]

export default function RadiusPicker({
  value,
  onChange,
}: {
  value: RadixRadius
  onChange: (radius: RadixRadius) => void
}) {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">
        Radius
      </Text>
      <Grid columns="5" gap="1.5" style={{ maxWidth: '100%' }}>
        {RADIUS_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <RadiusOption
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

function RadiusOption({
  value,
  label,
  isSelected,
  onClick,
}: {
  value: RadixRadius
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  // Map radius values to border radius pixels for preview
  const radiusMap: Record<RadixRadius, number> = {
    none: 0,
    small: 4,
    medium: 8,
    large: 12,
    full: 999,
  }

  const borderRadius = radiusMap[value]

  return (
    <Flex direction="column" align="center" gap="0.5">
      <button
        type="button"
        onClick={onClick}
        style={{
          width: 40,
          height: 40,
          borderRadius: borderRadius,
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
        }}
        aria-label={`Select ${label} radius`}
        title={label}
      />
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
