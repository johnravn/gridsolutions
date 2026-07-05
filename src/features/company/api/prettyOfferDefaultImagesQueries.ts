import { supabase } from '@shared/api/supabase'
import {
  deletePrettyOfferMediaPath,
  uploadCompanyPrettyOfferLibraryImage,
} from '@features/jobs/utils/prettyOfferMediaUpload'

export type CompanyPrettyOfferDefaultImage = {
  id: string
  company_id: string
  title: string
  storage_path: string
  sort_order: number
  created_at: string
  updated_at: string
}

export function companyPrettyOfferDefaultImagesQuery({
  companyId,
}: {
  companyId: string
}) {
  return {
    queryKey: ['company', companyId, 'pretty-offer-default-images'] as const,
    queryFn: async (): Promise<Array<CompanyPrettyOfferDefaultImage>> => {
      const { data, error } = await supabase
        .from('company_pretty_offer_default_images')
        .select(
          'id, company_id, title, storage_path, sort_order, created_at, updated_at',
        )
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  }
}

export async function createCompanyPrettyOfferDefaultImage({
  companyId,
  title,
  file,
}: {
  companyId: string
  title: string
  file: File
}): Promise<CompanyPrettyOfferDefaultImage> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) throw new Error('Title is required.')

  const { data: existing, error: countError } = await supabase
    .from('company_pretty_offer_default_images')
    .select('sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const imageId = crypto.randomUUID()

  const storagePath = await uploadCompanyPrettyOfferLibraryImage({
    companyId,
    imageId,
    file,
  })

  const { data, error } = await supabase
    .from('company_pretty_offer_default_images')
    .insert({
      id: imageId,
      company_id: companyId,
      title: trimmedTitle,
      storage_path: storagePath,
      sort_order: nextSortOrder,
    })
    .select(
      'id, company_id, title, storage_path, sort_order, created_at, updated_at',
    )
    .single()

  if (error) {
    await deletePrettyOfferMediaPath(storagePath).catch(() => undefined)
    throw error
  }

  return data
}

export async function updateCompanyPrettyOfferDefaultImageTitle({
  companyId,
  imageId,
  title,
}: {
  companyId: string
  imageId: string
  title: string
}): Promise<void> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) throw new Error('Title is required.')

  const { error } = await supabase
    .from('company_pretty_offer_default_images')
    .update({ title: trimmedTitle })
    .eq('id', imageId)
    .eq('company_id', companyId)

  if (error) throw error
}

export async function deleteCompanyPrettyOfferDefaultImage({
  companyId,
  imageId,
  storagePath,
}: {
  companyId: string
  imageId: string
  storagePath: string
}): Promise<void> {
  const { error } = await supabase
    .from('company_pretty_offer_default_images')
    .delete()
    .eq('id', imageId)
    .eq('company_id', companyId)

  if (error) throw error

  await deletePrettyOfferMediaPath(storagePath).catch(() => undefined)
}
