// src/features/company/components/GrayColorPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import type { RadixGrayColor } from '../api/queries'

const GRAY_COLORS: Array<{ value: RadixGrayColor; label: string }> = [
  { value: 'gray', label: 'Gray' },
  { value: 'mauve', label: 'Mauve' },
  { value: 'slate', label: 'Slate' },
  { value: 'sage', label: 'Sage' },
  { value: 'olive', label: 'Olive' },
  { value: 'sand', label: 'Sand' },
]

export default function GrayColorPicker({
  value,
  onChange,
}: {
  value: RadixGrayColor
  onChange: (grayColor: RadixGrayColor) => void
}) {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">
        Gray color
      </Text>
      <Grid columns="6" gap="1.5" style={{ maxWidth: '100%' }}>
        {GRAY_COLORS.map((color) => {
          const isSelected = value === color.value
          return (
            <GrayColorSwatch
              key={color.value}
              color={color.value}
              label={color.label}
              isSelected={isSelected}
              onClick={() => onChange(color.value)}
            />
          )
        })}
      </Grid>
    </Box>
  )
}

function GrayColorSwatch({
  color,
  label,
  isSelected,
  onClick,
}: {
  color: RadixGrayColor
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  // Map Radix gray color names to CSS color values for preview
  const colorMap: Record<RadixGrayColor, string> = {
    gray: '#6f6e77',
    mauve: '#8e8c99',
    slate: '#637394',
    sage: '#738573',
    olive: '#7d7d6f',
    sand: '#9e8f86',
  }

  const colorValue = colorMap[color] || colorMap.gray

  return (
    <Flex direction="column" align="center" gap="0.5">
      <button
        type="button"
        onClick={onClick}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: colorValue,
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
        aria-label={`Select ${label} gray color`}
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
