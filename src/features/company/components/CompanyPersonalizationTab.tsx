// src/features/company/components/CompanyPersonalizationTab.tsx
import * as React from 'react'
import { Box, Button, Card, Flex, Heading } from '@radix-ui/themes'
import { Refresh } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { companyDetailQuery, updateCompanyTheme } from '../api/queries'
import AccentColorPicker from './AccentColorPicker'
import RadiusPicker from './RadiusPicker'
import GrayColorPicker from './GrayColorPicker'
import PanelBackgroundPicker from './PanelBackgroundPicker'
import ThemePreview from './ThemePreview'
import type {
  RadixAccentColor,
  RadixGrayColor,
  RadixPanelBackground,
  RadixRadius,
} from '../api/queries'

// Default values
const DEFAULT_ACCENT_COLOR: RadixAccentColor = 'indigo'
const DEFAULT_RADIUS: RadixRadius = 'small'
const DEFAULT_GRAY_COLOR: RadixGrayColor = 'gray'
const DEFAULT_PANEL_BACKGROUND: RadixPanelBackground = 'translucent'

// Helper to validate accent color
function getValidAccentColor(
  color: string | null | undefined,
): RadixAccentColor {
  if (!color) return DEFAULT_ACCENT_COLOR
  const validColors: Array<RadixAccentColor> = [
    'gray',
    'gold',
    'bronze',
    'brown',
    'yellow',
    'amber',
    'orange',
    'tomato',
    'red',
    'ruby',
    'pink',
    'plum',
    'purple',
    'violet',
    'iris',
    'indigo',
    'blue',
    'cyan',
    'teal',
    'jade',
    'green',
    'grass',
    'mint',
    'lime',
    'sky',
  ]
  return validColors.includes(color as RadixAccentColor)
    ? (color as RadixAccentColor)
    : DEFAULT_ACCENT_COLOR
}

export default function CompanyPersonalizationTab() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { error: toastError } = useToast()

  const { data: companyData } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  // Initialize state from company data
  const [accentColor, setAccentColor] = React.useState<RadixAccentColor>(
    getValidAccentColor(companyData?.accent_color),
  )
  const [radius, setRadius] = React.useState<RadixRadius>(
    (companyData?.theme_radius as RadixRadius | undefined) ?? DEFAULT_RADIUS,
  )
  const [grayColor, setGrayColor] = React.useState<RadixGrayColor>(
    (companyData?.theme_gray_color as RadixGrayColor | undefined) ??
      DEFAULT_GRAY_COLOR,
  )
  const [panelBackground, setPanelBackground] =
    React.useState<RadixPanelBackground>(
      (companyData?.theme_panel_background as
        | RadixPanelBackground
        | undefined) ?? DEFAULT_PANEL_BACKGROUND,
    )

  // Update state when company data changes
  React.useEffect(() => {
    if (companyData) {
      setAccentColor(getValidAccentColor(companyData.accent_color))
      setRadius(
        (companyData.theme_radius as RadixRadius | undefined) ?? DEFAULT_RADIUS,
      )
      setGrayColor(
        (companyData.theme_gray_color as RadixGrayColor | undefined) ??
          DEFAULT_GRAY_COLOR,
      )
      setPanelBackground(
        (companyData.theme_panel_background as
          | RadixPanelBackground
          | undefined) ?? DEFAULT_PANEL_BACKGROUND,
      )
    }
  }, [companyData])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      await updateCompanyTheme({
        companyId,
        accentColor,
        radius,
        grayColor,
        panelBackground,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'company-detail'],
      })

      // Dispatch events to update theme immediately
      window.dispatchEvent(
        new CustomEvent('accent-color-changed', {
          detail: { color: accentColor },
        }),
      )
      window.dispatchEvent(
        new CustomEvent('theme-changed', {
          detail: { property: 'radius', value: radius },
        }),
      )
      window.dispatchEvent(
        new CustomEvent('theme-changed', {
          detail: { property: 'grayColor', value: grayColor },
        }),
      )
      window.dispatchEvent(
        new CustomEvent('theme-changed', {
          detail: {
            property: 'panelBackground',
            value: panelBackground,
          },
        }),
      )
    },
    onError: (e: any) => {
      toastError('Failed to save', e?.message ?? 'Please try again.')
    },
  })

  // Check if there are unsaved changes
  const hasChanges = React.useMemo(() => {
    if (!companyData) return false
    const currentAccent = getValidAccentColor(companyData.accent_color)
    const currentRadius =
      (companyData.theme_radius as RadixRadius | undefined) ?? DEFAULT_RADIUS
    const currentGrayColor =
      (companyData.theme_gray_color as RadixGrayColor | undefined) ??
      DEFAULT_GRAY_COLOR
    const currentPanelBackground =
      (companyData.theme_panel_background as
        | RadixPanelBackground
        | undefined) ?? DEFAULT_PANEL_BACKGROUND

    return (
      currentAccent !== accentColor ||
      currentRadius !== radius ||
      currentGrayColor !== grayColor ||
      currentPanelBackground !== panelBackground
    )
  }, [companyData, accentColor, radius, grayColor, panelBackground])

  // Handle save
  const handleSave = React.useCallback(() => {
    saveMutation.mutate()
  }, [saveMutation])

  // Handle restore defaults
  const handleRestoreDefaults = React.useCallback(() => {
    setAccentColor(DEFAULT_ACCENT_COLOR)
    setRadius(DEFAULT_RADIUS)
    setGrayColor(DEFAULT_GRAY_COLOR)
    setPanelBackground(DEFAULT_PANEL_BACKGROUND)
  }, [])

  // Handle cancel - reset to saved values
  const handleCancel = React.useCallback(() => {
    if (companyData) {
      setAccentColor(getValidAccentColor(companyData.accent_color))
      setRadius(
        (companyData.theme_radius as RadixRadius | undefined) ?? DEFAULT_RADIUS,
      )
      setGrayColor(
        (companyData.theme_gray_color as RadixGrayColor | undefined) ??
          DEFAULT_GRAY_COLOR,
      )
      setPanelBackground(
        (companyData.theme_panel_background as
          | RadixPanelBackground
          | undefined) ?? DEFAULT_PANEL_BACKGROUND,
      )
    }
  }, [companyData])

  return (
    <Card
      size="4"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 'var(--space-4)',
        }}
      >
        {/* Two-column layout: Preview on left, Controls on right */}
        <Flex
          gap="4"
          direction={{ initial: 'column', md: 'row' }}
          style={{ height: '100%' }}
        >
          {/* Preview Area - Left side */}
          <Box
            style={{
              flex: '1 1 50%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <ThemePreview
              accentColor={accentColor}
              radius={radius}
              grayColor={grayColor}
              panelBackground={panelBackground}
            />
          </Box>

          {/* Controls - Right side */}
          <Box
            style={{
              flex: '1 1 50%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Heading size="3" mb="3">
              Theme Settings
            </Heading>
            <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <Flex direction="column" gap="3">
                {/* Accent Color Picker */}
                <AccentColorPicker
                  value={accentColor}
                  onChange={setAccentColor}
                />

                {/* Gray Color Picker */}
                <GrayColorPicker value={grayColor} onChange={setGrayColor} />

                {/* Border Radius Picker */}
                <RadiusPicker value={radius} onChange={setRadius} />

                {/* Panel Background Picker */}
                <PanelBackgroundPicker
                  value={panelBackground}
                  onChange={setPanelBackground}
                />
              </Flex>
            </Box>
            <Flex
              gap="3"
              justify="end"
              wrap="wrap"
              mt="3"
              pt="3"
              style={{ borderTop: '1px solid var(--gray-a6)' }}
            >
              <Button
                variant="soft"
                onClick={handleRestoreDefaults}
                disabled={saveMutation.isPending}
                size="2"
              >
                <Refresh />
                Restore to Defaults
              </Button>
              <Button
                variant="soft"
                color="gray"
                onClick={handleCancel}
                disabled={!hasChanges || saveMutation.isPending}
                size="2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
                size="2"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Flex>
          </Box>
        </Flex>
      </div>
    </Card>
  )
}
