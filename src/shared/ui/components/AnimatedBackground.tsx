import { Box } from '@radix-ui/themes'
import type { CSSProperties } from 'react'
import './AnimatedBackground.css'

/** Canvas preset ids — Profile → Personalization style picker. */
export type GeometricBackgroundPreset =
  | 'grid-slash'
  | 'prism-bands'
  | 'circuit'
  | 'facet'

export const GEOMETRIC_BACKGROUND_PRESETS: ReadonlyArray<{
  id: GeometricBackgroundPreset
  label: string
  description: string
}> = [
  {
    id: 'grid-slash',
    label: 'Grid Slash',
    description: 'Fine technical grid with hard diagonal cuts',
  },
  {
    id: 'prism-bands',
    label: 'Prism Bands',
    description: 'Bold angled neutral bands with sharp edges',
  },
  {
    id: 'circuit',
    label: 'Circuit',
    description: 'Orthogonal traces and nodes — schematic energy',
  },
  {
    id: 'facet',
    label: 'Facet',
    description: 'Low-poly triangles with neutral solid fills',
  },
]

/** John locked Grid Slash as default / Recommended (2026-11-14). */
export const DEFAULT_GEOMETRIC_BACKGROUND_PRESET: GeometricBackgroundPreset =
  'grid-slash'

const PRESET_IDS = new Set<string>(
  GEOMETRIC_BACKGROUND_PRESETS.map((p) => p.id),
)

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

function GridSlashArt() {
  // Large soft ~72px CSS lattice (.geo-bg__fine-grid) — visible atmosphere;
  // SVG viewBox lines scaled away on full-bleed shells.
  return (
    <svg
      className="geo-bg__svg"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect className="geo-bg__base" width="320" height="160" />
      <polygon
        className="geo-bg__fill-a"
        points="0,0 120,0 0,90"
        opacity="0.7"
      />
      <polygon
        className="geo-bg__fill-c"
        points="320,0 320,70 200,0"
        opacity="0.55"
      />
      <polygon
        className="geo-bg__fill-b"
        points="0,160 90,160 0,100"
        opacity="0.5"
      />
      <line
        className="geo-bg__stroke-d"
        x1="40"
        y1="160"
        x2="280"
        y2="0"
        strokeWidth="3"
      />
      <line
        className="geo-bg__stroke-e"
        x1="0"
        y1="40"
        x2="320"
        y2="120"
        strokeWidth="2"
        opacity="0.75"
      />
    </svg>
  )
}

function PrismBandsArt() {
  return (
    <svg
      className="geo-bg__svg"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect className="geo-bg__base" width="320" height="160" />
      <polygon
        className="geo-bg__fill-a"
        points="0,0 70,0 20,160 0,160"
        opacity="0.85"
      />
      <polygon
        className="geo-bg__fill-b"
        points="55,0 115,0 65,160 5,160"
        opacity="0.7"
      />
      <polygon
        className="geo-bg__fill-c"
        points="140,0 195,0 145,160 90,160"
        opacity="0.65"
      />
      <polygon
        className="geo-bg__fill-d"
        points="230,0 280,0 250,160 200,160"
        opacity="0.55"
      />
      <polygon
        className="geo-bg__fill-e"
        points="300,0 320,0 320,160 270,160"
        opacity="0.5"
      />
    </svg>
  )
}

function CircuitArt() {
  return (
    <svg
      className="geo-bg__svg"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect className="geo-bg__base" width="320" height="160" />
      {[40, 80, 120].map((y) => (
        <line
          key={`ch${y}`}
          className="geo-bg__ink"
          x1="20"
          y1={y}
          x2="300"
          y2={y}
          strokeWidth="2"
        />
      ))}
      {[60, 160, 260].map((x) => (
        <line
          key={`cv${x}`}
          className="geo-bg__ink"
          x1={x}
          y1="20"
          x2={x}
          y2="140"
          strokeWidth="2"
        />
      ))}
      <rect className="geo-bg__node-a" x="52" y="32" width="16" height="16" />
      <rect className="geo-bg__node-b" x="152" y="72" width="16" height="16" />
      <rect className="geo-bg__node-c" x="252" y="112" width="16" height="16" />
      <rect className="geo-bg__node-d" x="152" y="32" width="16" height="16" />
      <rect className="geo-bg__node-e" x="52" y="112" width="16" height="16" />
      <line
        className="geo-bg__stroke-a"
        x1="68"
        y1="40"
        x2="152"
        y2="40"
        strokeWidth="3"
      />
      <line
        className="geo-bg__stroke-b"
        x1="160"
        y1="48"
        x2="160"
        y2="72"
        strokeWidth="3"
      />
      <line
        className="geo-bg__stroke-c"
        x1="168"
        y1="120"
        x2="252"
        y2="120"
        strokeWidth="3"
      />
      <line
        className="geo-bg__stroke-e"
        x1="60"
        y1="48"
        x2="60"
        y2="112"
        strokeWidth="3"
      />
    </svg>
  )
}

function FacetArt() {
  return (
    <svg
      className="geo-bg__svg"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect className="geo-bg__base" width="320" height="160" />
      <polygon
        className="geo-bg__fill-a"
        points="0,0 160,0 80,80"
        opacity="0.85"
      />
      <polygon
        className="geo-bg__fill-b"
        points="160,0 320,0 240,80 80,80"
        opacity="0.65"
      />
      <polygon
        className="geo-bg__fill-c"
        points="320,0 320,160 240,80"
        opacity="0.6"
      />
      <polygon
        className="geo-bg__fill-d"
        points="0,0 80,80 0,160"
        opacity="0.55"
      />
      <polygon
        className="geo-bg__fill-e"
        points="80,80 240,80 160,160"
        opacity="0.65"
      />
      <polygon
        className="geo-bg__fill-a"
        points="0,160 160,160 80,80"
        opacity="0.4"
      />
      <polygon
        className="geo-bg__fill-b"
        points="160,160 320,160 240,80"
        opacity="0.45"
      />
    </svg>
  )
}

function PresetArt({ preset }: { preset: GeometricBackgroundPreset }) {
  switch (preset) {
    case 'prism-bands':
      return <PrismBandsArt />
    case 'circuit':
      return <CircuitArt />
    case 'facet':
      return <FacetArt />
    case 'grid-slash':
    default:
      return <GridSlashArt />
  }
}

/**
 * Geometric backdrop for auth / app shells.
 * Sharp neutral-gray SVG geometry (canvas presets) — no soft blobs, no brand hue.
 * Subtle scale/drift only when `subtleMotion` and OS allows motion.
 */
export function AnimatedBackground({
  intensity = 1.0,
  preset = DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
  shapeType,
  speed: _speed,
  boostLightContrast: _boostLightContrast = true,
  subtleMotion = false,
}: {
  intensity?: number
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
  const resolved = normalizeGeometricPreset(preset ?? shapeType)

  return (
    <Box
      className={[
        'geo-bg',
        `geo-bg--${resolved}`,
        subtleMotion ? 'geo-bg--motion' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          ['--geo-intensity' as string]: String(clampedIntensity),
        } as CSSProperties
      }
      aria-hidden
    >
      <div className="geo-bg__art">
        <PresetArt preset={resolved} />
      </div>
      {/* Fine grid above art so lattice reads on real app/auth chrome */}
      <div className="geo-bg__fine-grid" />
    </Box>
  )
}
