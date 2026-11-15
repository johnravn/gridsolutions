import { supabase } from '@shared/api/supabase'

/** Upload an avatar image; returns the storage path (not a public URL). */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `${Date.now()}.${ext}`
  const path = `${userId}/${fileName}`

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr
  return path
}
