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
import ThemeToggle from '@shared/theme/ThemeToggle'

export type ProfilePersonalizationFormSlice = {
  animatedBackground: boolean
  backgroundIntensity: number
  backgroundShapeType: 'circles' | 'triangles' | 'rectangles'
  backgroundSpeed: number
  dailyInspirationType: 'quote' | 'bibleverse'
}

export default function ProfilePersonalizationTab({
  form,
  patchForm,
  saveProfile,
  isSaving,
}: {
  form: ProfilePersonalizationFormSlice
  patchForm: (patch: Partial<ProfilePersonalizationFormSlice>) => void
  saveProfile: () => Promise<unknown>
  isSaving: boolean
}) {
  const motionOn = form.animatedBackground

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
          Theme, optional moving background, and what appears in the inspiration
          card on your home screen.
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
              Moving background
            </Text>
            <Text size="2" color="gray" mb="3" style={{ display: 'block' }}>
              Turn on motion background to show animated shapes behind the app.
              When it is off (default), the background stays solid and the
              controls below are disabled.
            </Text>

            <PreferenceRow
              label="Motion background"
              description="Enables the animated layer and the intensity, shape, and speed options underneath."
              checked={motionOn}
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
                    if (isSaving || !motionOn) return
                    patchForm({
                      backgroundIntensity: 0.1,
                      backgroundShapeType: 'circles',
                      backgroundSpeed: 0.5,
                    })
                    try {
                      await saveProfile()
                    } catch {
                      /* mutation onError */
                    }
                  }}
                  disabled={!motionOn || isSaving}
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
                    if (!isSaving && motionOn) {
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
                  disabled={!motionOn || isSaving}
                  style={{ flex: 1 }}
                />
                <Text
                  size="2"
                  color={!motionOn ? 'gray' : undefined}
                  style={{
                    minWidth: 40,
                    textAlign: 'right',
                    opacity: !motionOn ? 0.5 : 1,
                  }}
                >
                  {Math.round(form.backgroundIntensity * 100)}%
                </Text>
              </Flex>
            </Flex>

            <Separator size="4" my="4" />

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Shape type
              </Text>
              <Flex gap="2" wrap="wrap">
                {(['circles', 'triangles', 'rectangles'] as const).map(
                  (shape) => (
                    <Button
                      key={shape}
                      size="2"
                      variant={
                        form.backgroundShapeType === shape ? 'solid' : 'soft'
                      }
                      onClick={async () => {
                        if (isSaving || !motionOn) return
                        patchForm({ backgroundShapeType: shape })
                        try {
                          await saveProfile()
                        } catch {
                          /* mutation onError */
                        }
                      }}
                      disabled={!motionOn || isSaving}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {shape}
                    </Button>
                  ),
                )}
              </Flex>
            </Flex>

            <Separator size="4" my="4" />

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Animation speed
              </Text>
              <Flex gap="3" align="center">
                <Slider
                  value={[form.backgroundSpeed]}
                  onValueChange={([value]) => {
                    patchForm({ backgroundSpeed: value })
                  }}
                  onValueCommit={async () => {
                    if (!isSaving && motionOn) {
                      try {
                        await saveProfile()
                      } catch {
                        /* mutation onError */
                      }
                    }
                  }}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  disabled={!motionOn || isSaving}
                  style={{ flex: 1 }}
                />
                <Text
                  size="2"
                  color={!motionOn ? 'gray' : undefined}
                  style={{
                    minWidth: 50,
                    textAlign: 'right',
                    opacity: !motionOn ? 0.5 : 1,
                  }}
                >
                  {form.backgroundSpeed.toFixed(1)}x
                </Text>
              </Flex>
              <Text
                size="1"
                color="gray"
                style={{ opacity: !motionOn ? 0.5 : 1 }}
              >
                {form.backgroundSpeed < 1.0
                  ? 'Slower'
                  : form.backgroundSpeed > 1.0
                    ? 'Faster'
                    : 'Normal'}
              </Text>
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
                patchForm({
                  dailyInspirationType: v as 'quote' | 'bibleverse',
                })
                try {
                  await saveProfile()
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
