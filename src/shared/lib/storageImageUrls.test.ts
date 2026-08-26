import { describe, expect, it } from 'vitest'
import {
  getBlurredPlaceholderUrl,
  isSupabaseStorageUrl,
  isSvgUrl,
} from './storageImageUrls'

describe('getBlurredPlaceholderUrl', () => {
  it('returns a tiny render URL for Supabase object URLs', () => {
    const src =
      'https://abc.supabase.co/storage/v1/object/public/vehicle_images/co/photo.jpg?v=1'
    expect(getBlurredPlaceholderUrl(src)).toBe(
      'https://abc.supabase.co/storage/v1/render/image/public/vehicle_images/co/photo.jpg?width=40&quality=20&resize=cover',
    )
  })

  it('returns a tiny render URL for existing render URLs', () => {
    const src =
      'https://abc.supabase.co/storage/v1/render/image/public/logos/logo.png?width=200'
    expect(getBlurredPlaceholderUrl(src)).toBe(
      'https://abc.supabase.co/storage/v1/render/image/public/logos/logo.png?width=40&quality=20&resize=cover',
    )
  })

  it('returns null for external URLs', () => {
    expect(getBlurredPlaceholderUrl('https://example.com/photo.jpg')).toBeNull()
  })

  it('returns null for SVG logos so alpha is not flattened', () => {
    expect(
      getBlurredPlaceholderUrl(
        'https://abc.supabase.co/storage/v1/object/public/logos/companies/1/logo_light.svg?v=1',
      ),
    ).toBeNull()
  })
})

describe('isSvgUrl', () => {
  it('detects SVG paths even with cache-busting query params', () => {
    expect(
      isSvgUrl(
        'https://abc.supabase.co/storage/v1/object/public/logos/logo_light.svg?v=companies/1/logo_light.svg',
      ),
    ).toBe(true)
    expect(
      isSvgUrl(
        'https://abc.supabase.co/storage/v1/object/public/logos/logo.png',
      ),
    ).toBe(false)
  })
})

describe('isSupabaseStorageUrl', () => {
  it('detects Supabase storage URLs', () => {
    expect(
      isSupabaseStorageUrl(
        'https://abc.supabase.co/storage/v1/object/public/bucket/file.png',
      ),
    ).toBe(true)
    expect(isSupabaseStorageUrl('https://cdn.example.com/file.png')).toBe(false)
  })
})
