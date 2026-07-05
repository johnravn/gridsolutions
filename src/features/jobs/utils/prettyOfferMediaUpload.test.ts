import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRETTY_OFFER_IMAGE_MAX_BYTES,
  PRETTY_OFFER_VIDEO_MAX_BYTES,
  buildCompanyPrettyOfferLibraryPath,
  copyPrettyOfferLibraryImageToOffer,
  isStorageMediaPath,
  resolvePrettyOfferMediaUrl,
  uploadCompanyPrettyOfferLibraryImage,
  uploadPrettyOfferMedia,
  validatePrettyOfferMediaFile,
} from './prettyOfferMediaUpload'

const uploadMock = vi.fn()
const copyMock = vi.fn()
const getPublicUrlMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
        copy: (...args: unknown[]) => copyMock(...args),
        getPublicUrl: (...args: unknown[]) => getPublicUrlMock(...args),
      }),
    },
  },
}))

describe('validatePrettyOfferMediaFile', () => {
  it('rejects unsupported image types', () => {
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' })
    Object.defineProperty(file, 'size', { value: 1024 })
    expect(validatePrettyOfferMediaFile(file, 'image')).toMatch(
      /JPG, PNG, or WebP/,
    )
  })

  it('rejects oversized images', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', {
      value: PRETTY_OFFER_IMAGE_MAX_BYTES + 1,
    })
    expect(validatePrettyOfferMediaFile(file, 'image')).toMatch(/5 MB/)
  })

  it('accepts valid images', () => {
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'size', { value: PRETTY_OFFER_IMAGE_MAX_BYTES })
    expect(validatePrettyOfferMediaFile(file, 'image')).toBeNull()
  })

  it('rejects unsupported video types', () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' })
    Object.defineProperty(file, 'size', { value: 1024 })
    expect(validatePrettyOfferMediaFile(file, 'video')).toMatch(/MP4 or WebM/)
  })

  it('rejects oversized videos', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', {
      value: PRETTY_OFFER_VIDEO_MAX_BYTES + 1,
    })
    expect(validatePrettyOfferMediaFile(file, 'video')).toMatch(/25 MB/)
  })

  it('accepts valid video files', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: PRETTY_OFFER_VIDEO_MAX_BYTES })
    expect(validatePrettyOfferMediaFile(file, 'video')).toBeNull()
  })
})

describe('isStorageMediaPath', () => {
  it('detects storage paths vs absolute URLs', () => {
    expect(isStorageMediaPath('company/offer/file.jpg')).toBe(true)
    expect(isStorageMediaPath('https://cdn.example.com/file.jpg')).toBe(false)
    expect(isStorageMediaPath(null)).toBe(false)
  })
})

describe('resolvePrettyOfferMediaUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolvePrettyOfferMediaUrl('https://example.com/a.jpg')).toBe(
      'https://example.com/a.jpg',
    )
  })

  it('resolves storage paths via supabase public URL', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://supabase.local/pretty_offer_media/path.jpg' },
    })
    expect(resolvePrettyOfferMediaUrl('path.jpg')).toBe(
      'https://supabase.local/pretty_offer_media/path.jpg',
    )
  })
})

describe('uploadPrettyOfferMedia', () => {
  beforeEach(() => {
    uploadMock.mockReset()
    copyMock.mockReset()
    getPublicUrlMock.mockReset()
  })

  it('uploads valid files and returns storage path', async () => {
    uploadMock.mockResolvedValue({ error: null })
    const file = new File(['x'], 'hero.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 1024 })

    const path = await uploadPrettyOfferMedia({
      companyId: 'co-1',
      offerId: 'offer-1',
      file,
      kind: 'image',
    })

    expect(path).toMatch(/^co-1\/offer-1\//)
    expect(uploadMock).toHaveBeenCalledWith(
      path,
      file,
      expect.objectContaining({ contentType: 'image/png' }),
    )
  })

  it('throws validation errors before upload', async () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' })
    Object.defineProperty(file, 'size', { value: 1024 })

    await expect(
      uploadPrettyOfferMedia({
        companyId: 'co-1',
        offerId: 'offer-1',
        file,
        kind: 'video',
      }),
    ).rejects.toThrow(/MP4 or WebM/)
    expect(uploadMock).not.toHaveBeenCalled()
  })
})

describe('buildCompanyPrettyOfferLibraryPath', () => {
  it('builds company library storage paths', () => {
    expect(
      buildCompanyPrettyOfferLibraryPath({
        companyId: 'co-1',
        imageId: 'img-1',
        ext: 'jpg',
      }),
    ).toBe('co-1/library/img-1.jpg')
  })
})

describe('uploadCompanyPrettyOfferLibraryImage', () => {
  beforeEach(() => {
    uploadMock.mockReset()
  })

  it('uploads to the company library path', async () => {
    uploadMock.mockResolvedValue({ error: null })
    const file = new File(['x'], 'stage.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'size', { value: 1024 })

    const path = await uploadCompanyPrettyOfferLibraryImage({
      companyId: 'co-1',
      imageId: 'img-1',
      file,
    })

    expect(path).toBe('co-1/library/img-1.webp')
    expect(uploadMock).toHaveBeenCalledWith(
      path,
      file,
      expect.objectContaining({ contentType: 'image/webp' }),
    )
  })
})

describe('copyPrettyOfferLibraryImageToOffer', () => {
  beforeEach(() => {
    copyMock.mockReset()
  })

  it('copies library image into offer folder and returns destination path', async () => {
    copyMock.mockResolvedValue({ error: null })

    const path = await copyPrettyOfferLibraryImageToOffer({
      companyId: 'co-1',
      offerId: 'offer-1',
      libraryPath: 'co-1/library/img-1.jpg',
    })

    expect(path).toMatch(/^co-1\/offer-1\//)
    expect(path.endsWith('.jpg')).toBe(true)
    expect(copyMock).toHaveBeenCalledWith('co-1/library/img-1.jpg', path)
  })
})
