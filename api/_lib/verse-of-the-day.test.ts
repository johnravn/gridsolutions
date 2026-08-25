import { describe, expect, it, vi } from 'vitest'
import handler from '../verse-of-the-day'

vi.mock('./verseOfTheDay', () => ({
  fetchVerseOfTheDay: vi.fn(async (version: string) => ({
    citation: 'John 3:16',
    passage: 'For God so loved the world.',
    version: version === 'msg' ? 'MSG' : 'BM11',
  })),
}))

function createMockRes() {
  const headers: Record<string, string> = {}
  let status = 200
  let body = ''

  const res = {
    setHeader: (key: string, value: string) => {
      headers[key] = value
    },
    get statusCode() {
      return status
    },
    set statusCode(value: number) {
      status = value
    },
    end: (chunk?: string) => {
      if (chunk !== undefined) body = chunk
    },
  }

  return {
    res,
    getBody: () => body,
    getStatus: () => status,
    getHeaders: () => headers,
  }
}

describe('verse-of-the-day handler', () => {
  it('returns verse JSON with cache headers', async () => {
    const { res, getBody, getStatus, getHeaders } = createMockRes()
    await handler({ query: { version: 'nn11' } }, res)

    expect(getStatus()).toBe(200)
    const parsed = JSON.parse(getBody())
    expect(parsed.citation).toBe('John 3:16')
    expect(getHeaders()['Cache-Control']).toContain('s-maxage=3600')
  })

  it('defaults version to bm11', async () => {
    const { fetchVerseOfTheDay } = await import('./verseOfTheDay')
    const { res } = createMockRes()
    await handler({ query: {} }, res)

    expect(fetchVerseOfTheDay).toHaveBeenCalledWith('bm11')
  })

  it('returns 500 on upstream failure', async () => {
    const { fetchVerseOfTheDay } = await import('./verseOfTheDay')
    vi.mocked(fetchVerseOfTheDay).mockRejectedValueOnce(
      new Error('network down'),
    )

    const { res, getBody, getStatus } = createMockRes()
    await handler({ query: { version: 'bm11' } }, res)

    expect(getStatus()).toBe(500)
    expect(JSON.parse(getBody()).error).toBe('Failed to load verse of the day')
  })
})
