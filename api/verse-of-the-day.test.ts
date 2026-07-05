import { describe, expect, it, vi } from 'vitest'
import handler from './verse-of-the-day'

vi.mock('@glowstudent/youversion', () => ({
  getVerseOfTheDay: vi.fn(async (lang: string) => ({
    reference: 'John 3:16',
    lang,
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
    await handler({ query: { lang: 'no' } }, res)

    expect(getStatus()).toBe(200)
    const parsed = JSON.parse(getBody())
    expect(parsed.reference).toBe('John 3:16')
    expect(parsed.lang).toBe('no')
    expect(getHeaders()['Cache-Control']).toContain('s-maxage=3600')
  })

  it('defaults lang to en', async () => {
    const { getVerseOfTheDay } = await import('@glowstudent/youversion')
    const { res, getBody } = createMockRes()
    await handler({ query: {} }, res)

    expect(getVerseOfTheDay).toHaveBeenCalledWith('en')
    expect(JSON.parse(getBody()).lang).toBe('en')
  })

  it('returns 500 on upstream failure', async () => {
    const { getVerseOfTheDay } = await import('@glowstudent/youversion')
    vi.mocked(getVerseOfTheDay).mockRejectedValueOnce(new Error('network down'))

    const { res, getBody, getStatus } = createMockRes()
    await handler({ query: { lang: 'en' } }, res)

    expect(getStatus()).toBe(500)
    expect(JSON.parse(getBody()).error).toBe('Failed to load verse of the day')
  })
})
