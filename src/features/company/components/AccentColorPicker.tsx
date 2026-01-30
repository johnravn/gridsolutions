// src/features/company/components/AccentColorPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import type { RadixAccentColor } from '../api/queries'

const RADIX_COLORS: Array<{ value: RadixAccentColor; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'purple', label: 'Purple' },
  { value: 'violet', label: 'Violet' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'amber', label: 'Amber' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'pink', label: 'Pink' },
  { value: 'iris', label: 'Iris' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'teal', label: 'Teal' },
  { value: 'jade', label: 'Jade' },
  { value: 'grass', label: 'Grass' },
  { value: 'mint', label: 'Mint' },
  { value: 'lime', label: 'Lime' },
  { value: 'sky', label: 'Sky' },
  { value: 'tomato', label: 'Tomato' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'plum', label: 'Plum' },
  { value: 'gold', label: 'Gold' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'brown', label: 'Brown' },
  { value: 'gray', label: 'Gray' },
]

export default function AccentColorPicker({
  value,
  onChange,
}: {
  value: RadixAccentColor
  onChange: (color: RadixAccentColor) => void
}) {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">
        Accent color
      </Text>
      <Grid columns="6" gap="1.5" style={{ maxWidth: '100%' }}>
        {RADIX_COLORS.map((color) => {
          const isSelected = value === color.value
          return (
            <ColorSwatch
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

function ColorSwatch({
  color,
  label,
  isSelected,
  onClick,
}: {
  color: RadixAccentColor
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  // Map Radix color names to CSS color values for preview
  const colorMap: Record<RadixAccentColor, string> = {
    blue: '#3e63dd',
    green: '#30a46c',
    purple: '#8e4ec6',
    violet: '#6e56cf',
    red: '#e5484d',
    orange: '#f76808',
    amber: '#f59e0b',
    yellow: '#f5d90a',
    pink: '#d6409f',
    iris: '#5b5bd6',
    indigo: '#3451b2',
    cyan: '#0891b2',
    teal: '#12a594',
    jade: '#00a972',
    grass: '#46a758',
    mint: '#00c897',
    lime: '#65a30d',
    sky: '#0284c7',
    tomato: '#f23d3d',
    ruby: '#e54666',
    plum: '#ab4aba',
    gold: '#f7c948',
    bronze: '#cd7f32',
    brown: '#ad7f58',
    gray: '#6f6e77',
  }

  const colorValue = colorMap[color] || colorMap.blue

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
        aria-label={`Select ${label} color`}
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
