// src/shared/theme/ThemeWrapper.tsx
import * as React from 'react'
import { Theme } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { companyDetailQuery } from '@features/company/api/queries'
import type {
  RadixAccentColor,
  RadixGrayColor,
  RadixPanelBackground,
  RadixRadius,
  RadixScaling,
} from '@features/company/api/queries'

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany()

  const { data: companyData } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  const [accentColor, setAccentColor] = React.useState<RadixAccentColor>(
    (companyData?.accent_color as RadixAccentColor | undefined) ?? 'indigo',
  )
  const [radius, setRadius] = React.useState<RadixRadius>(
    (companyData?.theme_radius as RadixRadius | undefined) ?? 'small',
  )
  const [grayColor, setGrayColor] = React.useState<RadixGrayColor>(
    (companyData?.theme_gray_color as RadixGrayColor | undefined) ?? 'gray',
  )
  const [panelBackground, setPanelBackground] =
    React.useState<RadixPanelBackground>(
      (companyData?.theme_panel_background as
        | RadixPanelBackground
        | undefined) ?? 'solid',
    )
  const [scaling, setScaling] = React.useState<RadixScaling>(
    (companyData?.theme_scaling as RadixScaling | undefined) ?? '100%',
  )

  // Update theme properties when company data changes
  React.useEffect(() => {
    const color = companyData?.accent_color
    if (!color) {
      setAccentColor('indigo')
    } else {
      // Check if it's a valid Radix accent color
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
      const isValidColor = (c: string): c is RadixAccentColor => {
        return validColors.includes(c as RadixAccentColor)
      }
      if (isValidColor(color)) {
        setAccentColor(color)
      } else {
        setAccentColor('indigo')
      }
    }

    // Update other theme properties
    if (companyData?.theme_radius) {
      setRadius(companyData.theme_radius)
    } else {
      setRadius('small')
    }

    if (companyData?.theme_gray_color) {
      setGrayColor(companyData.theme_gray_color)
    } else {
      setGrayColor('gray')
    }

    if (companyData?.theme_panel_background) {
      setPanelBackground(companyData.theme_panel_background)
    } else {
      setPanelBackground('solid')
    }

    if (companyData?.theme_scaling) {
      setScaling(companyData.theme_scaling)
    } else {
      setScaling('100%')
    }
  }, [companyData])

  // Listen for theme changes from pickers
  React.useEffect(() => {
    const handleColorChange = (e: CustomEvent<{ color: RadixAccentColor }>) => {
      setAccentColor(e.detail.color)
    }

    const handleThemeChange = (
      e: CustomEvent<{ property: string; value: any }>,
    ) => {
      // Update state immediately from the event value
      if (e.detail.property === 'radius' && e.detail.value) {
        setRadius(e.detail.value as RadixRadius)
      } else if (e.detail.property === 'grayColor' && e.detail.value) {
        setGrayColor(e.detail.value as RadixGrayColor)
      } else if (e.detail.property === 'panelBackground' && e.detail.value) {
        setPanelBackground(e.detail.value as RadixPanelBackground)
      } else if (e.detail.property === 'scaling' && e.detail.value) {
        setScaling(e.detail.value as RadixScaling)
      }
    }

    window.addEventListener(
      'accent-color-changed',
      handleColorChange as EventListener,
    )
    window.addEventListener('theme-changed', handleThemeChange as EventListener)
    return () => {
      window.removeEventListener(
        'accent-color-changed',
        handleColorChange as EventListener,
      )
      window.removeEventListener(
        'theme-changed',
        handleThemeChange as EventListener,
      )
    }
  }, [])

  return (
    <Theme
      radius={radius}
      accentColor={accentColor}
      grayColor={grayColor}
      panelBackground={panelBackground}
      scaling={scaling}
    >
      {children}
    </Theme>
  )
}
