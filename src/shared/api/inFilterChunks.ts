/**
 * PostgREST puts `.in()` values in the GET query string. Kong/nginx reject
 * URIs around 8KB (414), which the browser often surfaces as CORS `ERR_FAILED`.
 * Each UUID is ~39 encoded chars, so keep chunks well under that limit.
 */
export const POSTGREST_IN_FILTER_CHUNK_SIZE = 80

export function chunkList<T>(
  items: Array<T>,
  size = POSTGREST_IN_FILTER_CHUNK_SIZE,
): Array<Array<T>> {
  if (items.length === 0) return []
  const chunks: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function fetchAllInChunks<T>(
  ids: Array<string>,
  fetchChunk: (chunk: Array<string>) => PromiseLike<{
    data: Array<T> | null
    error: unknown
  }>,
  chunkSize = POSTGREST_IN_FILTER_CHUNK_SIZE,
): Promise<Array<T>> {
  if (ids.length === 0) return []
  const parts = await Promise.all(
    chunkList(ids, chunkSize).map((chunk) => fetchChunk(chunk)),
  )
  const rows: Array<T> = []
  for (const part of parts) {
    if (part.error) throw part.error
    if (part.data) rows.push(...part.data)
  }
  return rows
}
