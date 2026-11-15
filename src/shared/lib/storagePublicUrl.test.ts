import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveStoragePublicUrl } from './storagePublicUrl'

const getPublicUrlMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (...args: unknown[]) => getPublicUrlMock(bucket, ...args),
      }),
    },
  },
}))

describe('resolveStoragePublicUrl', () => {
  beforeEach(() => {
    getPublicUrlMock.mockReset()
    getPublicUrlMock.mockImplementation((bucket: string, path: string) => ({
      data: {
        publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}`,
      },
    }))
  })

  it('returns null for missing paths', () => {
    expect(resolveStoragePublicUrl('logos', null)).toBeNull()
    expect(resolveStoragePublicUrl('logos', '  ')).toBeNull()
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('builds a public URL for a relative key', () => {
    expect(resolveStoragePublicUrl('logos', 'companies/1/logo.jpg')).toBe(
      'https://project.supabase.co/storage/v1/object/public/logos/companies/1/logo.jpg',
    )
  })

  it('optionally cache-busts', () => {
    const url = resolveStoragePublicUrl('logos', 'x.jpg', { cacheBust: true })
    expect(url).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/logos\/x\.jpg\?t=\d+$/,
    )
  })

  it('passes absolute http(s) through when requested', () => {
    const absolute = 'https://cdn.example.com/logo.png'
    expect(
      resolveStoragePublicUrl('logos', absolute, {
        passThroughAbsoluteHttp: true,
      }),
    ).toBe(absolute)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })
})
