import { supabase } from '@shared/api/supabase'

export const PRETTY_OFFER_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRETTY_OFFER_VIDEO_MAX_BYTES = 25 * 1024 * 1024

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm'])

export type PrettyOfferMediaKind = 'image' | 'video'

export function validatePrettyOfferMediaFile(
  file: File,
  kind: PrettyOfferMediaKind,
): string | null {
  if (kind === 'image') {
    if (!IMAGE_MIME_TYPES.has(file.type)) {
      return 'Images must be JPG, PNG, or WebP.'
    }
    if (file.size > PRETTY_OFFER_IMAGE_MAX_BYTES) {
      return 'Images must be 5 MB or smaller.'
    }
    return null
  }

  if (!VIDEO_MIME_TYPES.has(file.type)) {
    return 'Videos must be MP4 or WebM.'
  }
  if (file.size > PRETTY_OFFER_VIDEO_MAX_BYTES) {
    return 'Videos must be 25 MB or smaller.'
  }
  return null
}

export function isStorageMediaPath(url: string | null | undefined): boolean {
  if (!url) return false
  return !/^https?:\/\//i.test(url)
}

export function resolvePrettyOfferMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const { data } = supabase.storage.from('pretty_offer_media').getPublicUrl(url)
  return data.publicUrl
}

export async function uploadPrettyOfferMedia({
  companyId,
  offerId,
  file,
  kind,
}: {
  companyId: string
  offerId: string
  file: File
  kind: PrettyOfferMediaKind
}): Promise<string> {
  const validationError = validatePrettyOfferMediaFile(file, kind)
  if (validationError) throw new Error(validationError)

  const ext =
    file.name.split('.').pop()?.toLowerCase() ||
    (kind === 'image' ? 'jpg' : 'mp4')
  const timestamp = Date.now()
  const filename = `${timestamp}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const path = `${companyId}/${offerId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('pretty_offer_media')
    .upload(path, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type,
    })

  if (uploadError) throw uploadError
  return path
}
