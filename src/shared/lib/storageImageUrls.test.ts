import { describe, expect, it } from 'vitest'
import {
  getBlurredPlaceholderUrl,
  isSupabaseStorageUrl,
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
