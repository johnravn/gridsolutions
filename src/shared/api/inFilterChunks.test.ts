import { describe, expect, it, vi } from 'vitest'
import {
  POSTGREST_IN_FILTER_CHUNK_SIZE,
  chunkList,
  fetchAllInChunks,
} from './inFilterChunks'

describe('chunkList', () => {
  it('returns no chunks for an empty list', () => {
    expect(chunkList([])).toEqual([])
  })

  it('keeps a short list as a single chunk', () => {
    expect(chunkList(['a', 'b'], 80)).toEqual([['a', 'b']])
  })

  it('splits at the PostgREST in-filter size', () => {
    const ids = Array.from(
      { length: POSTGREST_IN_FILTER_CHUNK_SIZE + 1 },
      (_, i) => String(i),
    )
    const chunks = chunkList(ids)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(POSTGREST_IN_FILTER_CHUNK_SIZE)
    expect(chunks[1]).toEqual([String(POSTGREST_IN_FILTER_CHUNK_SIZE)])
  })
})

describe('fetchAllInChunks', () => {
  it('returns an empty array without fetching', async () => {
    const fetchChunk = vi.fn()
    await expect(fetchAllInChunks([], fetchChunk)).resolves.toEqual([])
    expect(fetchChunk).not.toHaveBeenCalled()
  })

  it('concatenates chunk results in order', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `id-${i}`)
    const fetchChunk = vi.fn(async (chunk: Array<string>) => ({
      data: chunk.map((id) => ({ id })),
      error: null,
    }))

    await expect(fetchAllInChunks(ids, fetchChunk, 2)).resolves.toEqual([
      { id: 'id-0' },
      { id: 'id-1' },
      { id: 'id-2' },
    ])
    expect(fetchChunk).toHaveBeenCalledTimes(2)
  })

  it('throws the first chunk error', async () => {
    const err = new Error('too long')
    const fetchChunk = vi.fn(async () => ({ data: null, error: err }))
    await expect(fetchAllInChunks(['a'], fetchChunk)).rejects.toBe(err)
  })
})
