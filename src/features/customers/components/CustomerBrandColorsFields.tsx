import { Box, Flex, Text, TextField } from '@radix-ui/themes'
import AccentColorPicker from '@shared/theme/AccentColorPicker'
import {
  isRadixAccentColor,
  isValidHexColor,
} from '@shared/theme/accentColorTypes'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

type Props = {
  accentColor: RadixAccentColor
  accentColorCustom: string
  onAccentColorChange: (color: RadixAccentColor) => void
  onAccentColorCustomChange: (value: string) => void
}

export function CustomerBrandColorsFields({
  accentColor,
  accentColorCustom,
  onAccentColorChange,
  onAccentColorCustomChange,
}: Props) {
  const customPreview =
    accentColorCustom && isValidHexColor(accentColorCustom)
      ? accentColorCustom
      : null

  return (
    <Box>
      <AccentColorPicker value={accentColor} onChange={onAccentColorChange} />
      <Box mt="3">
        <Text as="div" size="2" weight="bold" mb="2">
          Custom accent (optional)
        </Text>
        <Flex gap="2" align="center">
          <TextField.Root
            value={accentColorCustom}
            onChange={(e) => onAccentColorCustomChange(e.target.value)}
            placeholder="#FF5500"
            style={{ flex: 1 }}
          />
          {customPreview && (
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: customPreview,
                border: '1px solid var(--gray-a6)',
                flexShrink: 0,
              }}
            />
          )}
        </Flex>
        <Text size="1" color="gray" mt="1">
          Hex override takes precedence over the swatch above when set.
        </Text>
      </Box>
    </Box>
  )
}

export function normalizeAccentColor(
  value: string | null | undefined,
): RadixAccentColor {
  if (value && isRadixAccentColor(value)) return value
  return 'indigo'
}

export function normalizeCustomHex(value: string | null | undefined): string {
  return value ?? ''
}

export function sanitizeCustomHexInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return isValidHexColor(trimmed) ? trimmed : null
}
