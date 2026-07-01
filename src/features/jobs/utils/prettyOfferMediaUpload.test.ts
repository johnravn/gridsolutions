import { describe, expect, it } from 'vitest'
import {
  PRETTY_OFFER_IMAGE_MAX_BYTES,
  PRETTY_OFFER_VIDEO_MAX_BYTES,
  validatePrettyOfferMediaFile,
} from './prettyOfferMediaUpload'

describe('validatePrettyOfferMediaFile', () => {
  it('rejects oversized images', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', {
      value: PRETTY_OFFER_IMAGE_MAX_BYTES + 1,
    })
    expect(validatePrettyOfferMediaFile(file, 'image')).toMatch(/5 MB/)
  })

  it('rejects unsupported video types', () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' })
    Object.defineProperty(file, 'size', { value: 1024 })
    expect(validatePrettyOfferMediaFile(file, 'video')).toMatch(/MP4 or WebM/)
  })

  it('accepts valid video files', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: PRETTY_OFFER_VIDEO_MAX_BYTES })
    expect(validatePrettyOfferMediaFile(file, 'video')).toBeNull()
  })
})
