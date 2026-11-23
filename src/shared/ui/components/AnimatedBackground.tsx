import { Box } from '@radix-ui/themes'
import type { CSSProperties } from 'react'
import './AnimatedBackground.css'

/**
 * Legacy canvas preset ids — stored prefs still normalize here.
 * Visual is always the subtle fine grid (no decorative geometry).
 */
export type GeometricBackgroundPreset =
  | 'grid-slash'
  | 'prism-bands'
  | 'circuit'
  | 'facet'

/** @deprecated Style picker removed — only the subtle grid remains. Kept for prefs. */
export const GEOMETRIC_BACKGROUND_PRESETS: ReadonlyArray<{
  id: GeometricBackgroundPreset
  label: string
  description: string
}> = [
  {
    id: 'grid-slash',
    label: 'Grid',
    description: 'Subtle technical lattice only',
  },
]

/** John locked Grid Slash as default / Recommended (2026-11-14). */
export const DEFAULT_GEOMETRIC_BACKGROUND_PRESET: GeometricBackgroundPreset =
  'grid-slash'

const PRESET_IDS = new Set<string>([
  'grid-slash',
  'prism-bands',
  'circuit',
  'facet',
])

/** Map legacy soft-shape prefs + unknown values onto canvas presets. */
export function normalizeGeometricPreset(
  value: unknown,
): GeometricBackgroundPreset {
  if (typeof value === 'string' && PRESET_IDS.has(value)) {
    return value as GeometricBackgroundPreset
  }
  switch (value) {
    case 'bands':
    case 'prism':
      return 'prism-bands'
    case 'grid':
    case 'rectangles':
      return 'grid-slash'
    case 'facets':
    case 'triangles':
      return 'facet'
    case 'circles':
    default:
      return DEFAULT_GEOMETRIC_BACKGROUND_PRESET
  }
}

/**
 * Subtle grid backdrop for auth / app shells.
 * Fine lattice only — no polygons, bands, circuits, or other decorative geometry.
 * Intensity scales lattice opacity. Optional micro-drift when `subtleMotion`.
 */
export function AnimatedBackground({
  intensity = 1.0,
  preset: _preset = DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
  shapeType: _shapeType,
  speed: _speed,
  boostLightContrast: _boostLightContrast = true,
  subtleMotion = false,
}: {
  intensity?: number
  /** @deprecated Ignored visually — all presets render the same subtle grid. */
  preset?: GeometricBackgroundPreset
  /** @deprecated Use `preset`. Legacy soft-shape values are mapped. */
  shapeType?: string
  /** @deprecated Ignored — background no longer uses speed. */
  speed?: number
  /** @deprecated Ignored — light contrast is handled in CSS. */
  boostLightContrast?: boolean
  /** Opt-in micro-drift (still disabled under prefers-reduced-motion). */
  subtleMotion?: boolean
}) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))

  return (
    <Box
      className={['geo-bg', subtleMotion ? 'geo-bg--motion' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        {
          ['--geo-intensity' as string]: String(clampedIntensity),
        } as CSSProperties
      }
      aria-hidden
    >
      <div className="geo-bg__fine-grid" />
    </Box>
  )
}
