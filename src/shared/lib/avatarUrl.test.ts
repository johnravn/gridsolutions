import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAvatarUrl } from './avatarUrl'

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

describe('resolveAvatarUrl', () => {
  beforeEach(() => {
    getPublicUrlMock.mockReset()
    getPublicUrlMock.mockImplementation((_bucket: string, path: string) => ({
      data: {
        publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${path}`,
      },
    }))
  })

  it('returns null for missing or blank values', () => {
    expect(resolveAvatarUrl(null)).toBeNull()
    expect(resolveAvatarUrl(undefined)).toBeNull()
    expect(resolveAvatarUrl('')).toBeNull()
    expect(resolveAvatarUrl('   ')).toBeNull()
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('passes absolute https Google avatar URLs through unchanged', () => {
    const google =
      'https://lh3.googleusercontent.com/a/ACg8ocExamplePhotoId=s96-c'
    expect(resolveAvatarUrl(google)).toBe(google)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('passes absolute http URLs through unchanged', () => {
    const httpUrl = 'http://cdn.example.com/avatars/user.png'
    expect(resolveAvatarUrl(httpUrl)).toBe(httpUrl)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('does not double-prefix an already-public Supabase avatar URL', () => {
    const absolute =
      'https://project.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg'
    expect(resolveAvatarUrl(absolute)).toBe(absolute)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('prefixes relative storage keys with the public avatars bucket URL', () => {
    expect(resolveAvatarUrl('e2b4f0f5/avatar.jpg')).toBe(
      'https://project.supabase.co/storage/v1/object/public/avatars/e2b4f0f5/avatar.jpg',
    )
    expect(getPublicUrlMock).toHaveBeenCalledWith(
      'avatars',
      'e2b4f0f5/avatar.jpg',
    )
  })

  it('trims whitespace around relative keys before resolving', () => {
    expect(resolveAvatarUrl('  user/avatar.jpg  ')).toBe(
      'https://project.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg',
    )
    expect(getPublicUrlMock).toHaveBeenCalledWith('avatars', 'user/avatar.jpg')
  })
})
