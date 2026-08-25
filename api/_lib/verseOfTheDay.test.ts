import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  extractHolyBibleVerse,
  fetchVerseOfTheDay,
  formatVerseCitation,
  parseVerseReference,
} from './verseOfTheDay'

describe('parseVerseReference', () => {
  it('parses a simple reference', () => {
    expect(parseVerseReference('John 3:16')).toMatchObject({
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
      display: 'John 3:16',
    })
    expect(parseVerseReference('John 3:16').book.slug).toBe('john')
  })

  it('parses numbered books and ranges', () => {
    const parsed = parseVerseReference('1 John 4:7-8')
    expect(parsed.book.slug).toBe('1-john')
    expect(parsed.verseStart).toBe(7)
    expect(parsed.verseEnd).toBe(8)
  })

  it('maps Psalm to psalms', () => {
    expect(parseVerseReference('Psalm 62:1').book.slug).toBe('psalms')
  })
})

describe('formatVerseCitation', () => {
  it('uses Bokmål book names and a comma for BM11', () => {
    expect(formatVerseCitation(parseVerseReference('Psalm 62:1'), 'bm11')).toBe(
      'Salme 62,1',
    )
    expect(formatVerseCitation(parseVerseReference('John 3:16'), 'bm11')).toBe(
      'Johannes 3,16',
    )
  })

  it('uses Nynorsk book names for NN11', () => {
    expect(formatVerseCitation(parseVerseReference('Acts 2:1-4'), 'nn11')).toBe(
      'Apostelgjerningane 2,1-4',
    )
  })

  it('keeps English names and a colon for The Message', () => {
    expect(formatVerseCitation(parseVerseReference('Psalm 62:1'), 'msg')).toBe(
      'Psalm 62:1',
    )
    expect(
      formatVerseCitation(parseVerseReference('1 John 4:7-8'), 'msg'),
    ).toBe('1 John 4:7-8')
  })
})

describe('extractHolyBibleVerse', () => {
  it('reads the first row-verse paragraph', () => {
    const html = `
      <main class="container-verse">
        <p class="row-verse">
          For så høyt har Gud elsket verden.
        </p>
        <p class="row-verse center">Compare</p>
      </main>
    `
    expect(extractHolyBibleVerse(html)).toBe(
      'For så høyt har Gud elsket verden.',
    )
  })

  it('throws when the verse is missing', () => {
    expect(() =>
      extractHolyBibleVerse('<p class="row-verse">Verse not found.</p>'),
    ).toThrow(/not found/i)
  })
})

describe('fetchVerseOfTheDay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('ourmanna.com')) {
          return new Response(
            JSON.stringify({
              verse: { details: { reference: 'John 3:16' } },
            }),
            { status: 200 },
          )
        }
        if (url.includes('holybible.site')) {
          return new Response(
            '<p class="row-verse">For så høyt har Gud elsket verden.</p>',
            { status: 200 },
          )
        }
        if (url.includes('bolls.life')) {
          return new Response(
            JSON.stringify([
              { verse: 16, text: 'This is how much God loved the world.' },
            ]),
            { status: 200 },
          )
        }
        return new Response('missing', { status: 404 })
      }),
    )
  })

  it('returns BM11 text for the daily reference', async () => {
    const data = await fetchVerseOfTheDay('bm11')
    expect(data.citation).toBe('Johannes 3,16')
    expect(data.passage).toContain('elsket verden')
    expect(data.version).toBe('BM11')
  })

  it('returns The Message from bolls', async () => {
    const data = await fetchVerseOfTheDay('msg')
    expect(data.passage).toContain('God loved the world')
    expect(data.version).toBe('MSG')
  })
})
