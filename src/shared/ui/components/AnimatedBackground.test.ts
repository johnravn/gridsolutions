import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
  normalizeGeometricPreset,
} from './AnimatedBackground'

describe('normalizeGeometricPreset', () => {
  it('keeps canvas preset ids (legacy prefs)', () => {
    expect(normalizeGeometricPreset('grid-slash')).toBe('grid-slash')
    expect(normalizeGeometricPreset('prism-bands')).toBe('prism-bands')
    expect(normalizeGeometricPreset('circuit')).toBe('circuit')
    expect(normalizeGeometricPreset('facet')).toBe('facet')
  })

  it('maps legacy soft-shape values', () => {
    expect(normalizeGeometricPreset('circles')).toBe(
      DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
    )
    expect(normalizeGeometricPreset('triangles')).toBe('facet')
    expect(normalizeGeometricPreset('rectangles')).toBe('grid-slash')
  })

  it('maps interim geometric aliases', () => {
    expect(normalizeGeometricPreset('bands')).toBe('prism-bands')
    expect(normalizeGeometricPreset('prism')).toBe('prism-bands')
    expect(normalizeGeometricPreset('grid')).toBe('grid-slash')
    expect(normalizeGeometricPreset('facets')).toBe('facet')
  })

  it('defaults unknown values to grid-slash', () => {
    expect(normalizeGeometricPreset(undefined)).toBe('grid-slash')
    expect(normalizeGeometricPreset('blob')).toBe('grid-slash')
  })
})
