import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Separator,
  Slider,
  Switch,
  Text,
} from '@radix-ui/themes'
import { BIBLE_VERSION_OPTIONS } from '@shared/lib/bibleVersion'
import ThemeToggle from '@shared/theme/ThemeToggle'
import {
  DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
  GEOMETRIC_BACKGROUND_PRESETS,
} from '@shared/ui/components/AnimatedBackground'
import type { GeometricBackgroundPreset } from '@shared/ui/components/AnimatedBackground'
import type { BibleVersion } from '@shared/lib/bibleVersion'

export type ProfilePersonalizationFormSlice = {
  animatedBackground: boolean
  backgroundIntensity: number
  backgroundPreset: GeometricBackgroundPreset
  dailyInspirationType: 'quote' | 'bibleverse'
  bibleVersion: BibleVersion
}

export default function ProfilePersonalizationTab({
  form,
  patchForm,
  saveProfile,
  isSaving,
}: {
  form: ProfilePersonalizationFormSlice
  patchForm: (patch: Partial<ProfilePersonalizationFormSlice>) => void
  saveProfile: (
    patch?: Partial<ProfilePersonalizationFormSlice>,
  ) => Promise<unknown>
  isSaving: boolean
}) {
  const backgroundOn = form.animatedBackground

  return (
    <Card
      size="4"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        p="4"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        <Heading size="4" mb="2">
          Personalization
        </Heading>
        <Text size="2" color="gray" mb="4">
          Theme, optional geometric background, and what appears in the
          inspiration card on your home screen.
        </Text>

        <Flex direction="column" gap="4">
          <Box>
            <Text size="2" weight="bold" mb="3" style={{ display: 'block' }}>
              Theme
            </Text>
            <ThemeToggle />
          </Box>

          <Separator size="4" />

          <Box>
            <Text size="2" weight="bold" mb="2" style={{ display: 'block' }}>
              Background
            </Text>
            <Text size="2" color="gray" mb="3" style={{ display: 'block' }}>
              Show a sharp geometric accent layer behind the app. When off
              (default), the shell stays solid and the controls below are
              disabled.
            </Text>

            <PreferenceRow
              label="Geometric background"
              description="Enables the accent layer plus intensity and style options underneath."
              checked={backgroundOn}
              disabled={isSaving}
              onCheckedChange={async (next) => {
                if (isSaving) return
                const prev = form.animatedBackground
                patchForm({ animatedBackground: next })
                try {
                  await saveProfile()
                } catch {
                  patchForm({ animatedBackground: prev })
                }
              }}
            />

            <Separator size="4" my="4" />

            <Flex direction="column" gap="2">
              <Flex align="center" justify="between" wrap="wrap" gap="2">
                <Text size="2" weight="medium">
                  Background intensity
                </Text>
                <Button
                  size="1"
                  variant="soft"
                  onClick={async () => {
                    if (isSaving || !backgroundOn) return
                    patchForm({
                      backgroundIntensity: 0.35,
                      backgroundPreset: DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
                    })
                    try {
                      await saveProfile()
                    } catch {
                      /* mutation onError */
                    }
                  }}
                  disabled={!backgroundOn || isSaving}
                >
                  Recommended settings
                </Button>
              </Flex>
              <Flex gap="3" align="center">
                <Slider
                  value={[form.backgroundIntensity]}
                  onValueChange={([value]) => {
                    patchForm({ backgroundIntensity: value })
                  }}
                  onValueCommit={async () => {
                    if (!isSaving && backgroundOn) {
                      try {
                        await saveProfile()
                      } catch {
                        /* mutation onError */
                      }
                    }
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={!backgroundOn || isSaving}
                  style={{ flex: 1 }}
                />
                <Text
                  size="2"
                  color={!backgroundOn ? 'gray' : undefined}
                  style={{
                    minWidth: 40,
                    textAlign: 'right',
                    opacity: !backgroundOn ? 0.5 : 1,
                  }}
                >
                  {Math.round(form.backgroundIntensity * 100)}%
                </Text>
              </Flex>
            </Flex>

            <Separator size="4" my="4" />

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Style
              </Text>
              <Text
                size="1"
                color="gray"
                mb="1"
                style={{ opacity: !backgroundOn ? 0.5 : 1 }}
              >
                Sharp geometric presets — not soft circles.
              </Text>
              <Flex gap="2" wrap="wrap">
                {GEOMETRIC_BACKGROUND_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    size="2"
                    variant={
                      form.backgroundPreset === preset.id ? 'solid' : 'soft'
                    }
                    onClick={async () => {
                      if (isSaving || !backgroundOn) return
                      patchForm({ backgroundPreset: preset.id })
                      try {
                        await saveProfile()
                      } catch {
                        /* mutation onError */
                      }
                    }}
                    disabled={!backgroundOn || isSaving}
                    title={preset.description}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Flex>
            </Flex>
          </Box>

          <Separator size="4" />

          <Box>
            <Text size="2" weight="bold" mb="2" style={{ display: 'block' }}>
              Homepage inspiration
            </Text>
            <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
              What to show on your home screen (quote or Bible verse).
            </Text>
            <Select.Root
              value={form.dailyInspirationType}
              onValueChange={async (v) => {
                if (isSaving) return
                const dailyInspirationType = v as 'quote' | 'bibleverse'
                patchForm({ dailyInspirationType })
                try {
                  await saveProfile({ dailyInspirationType })
                } catch {
                  /* mutation onError */
                }
              }}
            >
              <Select.Trigger
                placeholder="Select…"
                style={{ maxWidth: 360, width: '100%' }}
              />
              <Select.Content>
                <Select.Item value="quote">Quote of the day</Select.Item>
                <Select.Item value="bibleverse">
                  Bible verse of the day
                </Select.Item>
              </Select.Content>
            </Select.Root>
            {form.dailyInspirationType === 'bibleverse' && (
              <Box mt="3">
                <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                  Bible translation for the verse of the day.
                </Text>
                <Select.Root
                  value={form.bibleVersion}
                  onValueChange={async (v) => {
                    if (isSaving) return
                    const bibleVersion = v as BibleVersion
                    patchForm({ bibleVersion })
                    try {
                      await saveProfile({ bibleVersion })
                    } catch {
                      /* mutation onError */
                    }
                  }}
                >
                  <Select.Trigger
                    placeholder="Select translation…"
                    style={{ maxWidth: 360, width: '100%' }}
                  />
                  <Select.Content>
                    {BIBLE_VERSION_OPTIONS.map((option) => (
                      <Select.Item key={option.value} value={option.value}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>
            )}
          </Box>
        </Flex>
      </Box>
    </Card>
  )
}

function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <Flex align="center" justify="between" gap="4" wrap="wrap">
      <Box style={{ flex: '1 1 240px', minWidth: 0 }}>
        <Text weight="medium" size="2">
          {label}
        </Text>
        <Text size="2" color="gray" style={{ display: 'block', marginTop: 4 }}>
          {description}
        </Text>
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </Flex>
  )
}
