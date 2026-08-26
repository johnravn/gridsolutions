import { BIBLE_VERSION_OPTIONS, normalizeBibleVersion } from './bibleVersion.js'
import type { BibleVersion } from './bibleVersion.js'

export type VerseOfTheDay = {
  citation: string
  passage: string
  version: string
}

type BookLabels = {
  bm11: string
  nn11: string
  msg: string
}

type HolyBibleVersion = 'bm11' | 'nn11'

type BookMeta = {
  names: Array<string>
  slug: string
  bollsId: number
  labels: BookLabels
}

type ParsedReference = {
  book: BookMeta
  chapter: number
  verseStart: number
  verseEnd: number
  display: string
}

function book(
  names: Array<string>,
  slug: string,
  bollsId: number,
  labels: BookLabels,
): BookMeta {
  return { names, slug, bollsId, labels }
}

const BOOKS: Array<BookMeta> = [
  book(['genesis', 'gen'], 'genesis', 1, {
    bm11: 'Første Mosebok',
    nn11: 'Første Mosebok',
    msg: 'Genesis',
  }),
  book(['exodus', 'exo', 'exod'], 'exodus', 2, {
    bm11: 'Andre Mosebok',
    nn11: 'Andre Mosebok',
    msg: 'Exodus',
  }),
  book(['leviticus', 'lev'], 'leviticus', 3, {
    bm11: 'Tredje Mosebok',
    nn11: 'Tredje Mosebok',
    msg: 'Leviticus',
  }),
  book(['numbers', 'num'], 'numbers', 4, {
    bm11: 'Fjerde Mosebok',
    nn11: 'Fjerde Mosebok',
    msg: 'Numbers',
  }),
  book(['deuteronomy', 'deut', 'deu'], 'deuteronomy', 5, {
    bm11: 'Femte Mosebok',
    nn11: 'Femte Mosebok',
    msg: 'Deuteronomy',
  }),
  book(['joshua', 'josh', 'jos'], 'joshua', 6, {
    bm11: 'Josva',
    nn11: 'Josva',
    msg: 'Joshua',
  }),
  book(['judges', 'judg', 'jdg'], 'judges', 7, {
    bm11: 'Dommerne',
    nn11: 'Dommarane',
    msg: 'Judges',
  }),
  book(['ruth'], 'ruth', 8, {
    bm11: 'Rut',
    nn11: 'Rut',
    msg: 'Ruth',
  }),
  book(['1 samuel', '1 sam', 'i samuel'], '1-samuel', 9, {
    bm11: 'Første Samuelsbok',
    nn11: 'Første Samuelsbok',
    msg: '1 Samuel',
  }),
  book(['2 samuel', '2 sam', 'ii samuel'], '2-samuel', 10, {
    bm11: 'Andre Samuelsbok',
    nn11: 'Andre Samuelsbok',
    msg: '2 Samuel',
  }),
  book(['1 kings', '1 kgs', 'i kings'], '1-kings', 11, {
    bm11: 'Første Kongebok',
    nn11: 'Første Kongebok',
    msg: '1 Kings',
  }),
  book(['2 kings', '2 kgs', 'ii kings'], '2-kings', 12, {
    bm11: 'Andre Kongebok',
    nn11: 'Andre Kongebok',
    msg: '2 Kings',
  }),
  book(['1 chronicles', '1 chr', 'i chronicles'], '1-chronicles', 13, {
    bm11: 'Første Krønikebok',
    nn11: 'Første Krønikebok',
    msg: '1 Chronicles',
  }),
  book(['2 chronicles', '2 chr', 'ii chronicles'], '2-chronicles', 14, {
    bm11: 'Andre Krønikebok',
    nn11: 'Andre Krønikebok',
    msg: '2 Chronicles',
  }),
  book(['ezra'], 'ezra', 15, {
    bm11: 'Esra',
    nn11: 'Esra',
    msg: 'Ezra',
  }),
  book(['nehemiah', 'neh'], 'nehemiah', 16, {
    bm11: 'Nehemja',
    nn11: 'Nehemja',
    msg: 'Nehemiah',
  }),
  book(['esther', 'est'], 'esther', 17, {
    bm11: 'Ester',
    nn11: 'Ester',
    msg: 'Esther',
  }),
  book(['job'], 'job', 18, {
    bm11: 'Job',
    nn11: 'Job',
    msg: 'Job',
  }),
  book(['psalm', 'psalms', 'ps'], 'psalms', 19, {
    bm11: 'Salme',
    nn11: 'Salme',
    msg: 'Psalm',
  }),
  book(['proverbs', 'prov', 'pro'], 'proverbs', 20, {
    bm11: 'Ordspråkene',
    nn11: 'Ordspråka',
    msg: 'Proverbs',
  }),
  book(['ecclesiastes', 'eccl', 'ecc'], 'ecclesiastes', 21, {
    bm11: 'Forkynneren',
    nn11: 'Forkynnaren',
    msg: 'Ecclesiastes',
  }),
  book(
    ['song of solomon', 'song of songs', 'canticles', 'song'],
    'song-of-solomon',
    22,
    {
      bm11: 'Høysangen',
      nn11: 'Høgsongen',
      msg: 'Song of Songs',
    },
  ),
  book(['isaiah', 'isa'], 'isaiah', 23, {
    bm11: 'Jesaja',
    nn11: 'Jesaja',
    msg: 'Isaiah',
  }),
  book(['jeremiah', 'jer'], 'jeremiah', 24, {
    bm11: 'Jeremia',
    nn11: 'Jeremia',
    msg: 'Jeremiah',
  }),
  book(['lamentations', 'lam'], 'lamentations', 25, {
    bm11: 'Klagesangene',
    nn11: 'Klagesongane',
    msg: 'Lamentations',
  }),
  book(['ezekiel', 'ezek', 'eze'], 'ezekiel', 26, {
    bm11: 'Esekiel',
    nn11: 'Esekiel',
    msg: 'Ezekiel',
  }),
  book(['daniel', 'dan'], 'daniel', 27, {
    bm11: 'Daniel',
    nn11: 'Daniel',
    msg: 'Daniel',
  }),
  book(['hosea', 'hos'], 'hosea', 28, {
    bm11: 'Hosea',
    nn11: 'Hosea',
    msg: 'Hosea',
  }),
  book(['joel'], 'joel', 29, {
    bm11: 'Joel',
    nn11: 'Joel',
    msg: 'Joel',
  }),
  book(['amos'], 'amos', 30, {
    bm11: 'Amos',
    nn11: 'Amos',
    msg: 'Amos',
  }),
  book(['obadiah', 'obad', 'oba'], 'obadiah', 31, {
    bm11: 'Obadja',
    nn11: 'Obadja',
    msg: 'Obadiah',
  }),
  book(['jonah'], 'jonah', 32, {
    bm11: 'Jona',
    nn11: 'Jona',
    msg: 'Jonah',
  }),
  book(['micah', 'mic'], 'micah', 33, {
    bm11: 'Mika',
    nn11: 'Mika',
    msg: 'Micah',
  }),
  book(['nahum', 'nah'], 'nahum', 34, {
    bm11: 'Nahum',
    nn11: 'Nahum',
    msg: 'Nahum',
  }),
  book(['habakkuk', 'hab'], 'habakkuk', 35, {
    bm11: 'Habakkuk',
    nn11: 'Habakkuk',
    msg: 'Habakkuk',
  }),
  book(['zephaniah', 'zeph', 'zep'], 'zephaniah', 36, {
    bm11: 'Sefanja',
    nn11: 'Sefanja',
    msg: 'Zephaniah',
  }),
  book(['haggai', 'hag'], 'haggai', 37, {
    bm11: 'Haggai',
    nn11: 'Haggai',
    msg: 'Haggai',
  }),
  book(['zechariah', 'zech', 'zec'], 'zechariah', 38, {
    bm11: 'Sakarja',
    nn11: 'Sakarja',
    msg: 'Zechariah',
  }),
  book(['malachi', 'mal'], 'malachi', 39, {
    bm11: 'Malaki',
    nn11: 'Malaki',
    msg: 'Malachi',
  }),
  book(['matthew', 'matt', 'mt'], 'matthew', 40, {
    bm11: 'Matteus',
    nn11: 'Matteus',
    msg: 'Matthew',
  }),
  book(['mark', 'mk'], 'mark', 41, {
    bm11: 'Markus',
    nn11: 'Markus',
    msg: 'Mark',
  }),
  book(['luke', 'lk'], 'luke', 42, {
    bm11: 'Lukas',
    nn11: 'Lukas',
    msg: 'Luke',
  }),
  book(['john', 'jn'], 'john', 43, {
    bm11: 'Johannes',
    nn11: 'Johannes',
    msg: 'John',
  }),
  book(['acts'], 'acts', 44, {
    bm11: 'Apostlenes gjerninger',
    nn11: 'Apostelgjerningane',
    msg: 'Acts',
  }),
  book(['romans', 'rom'], 'romans', 45, {
    bm11: 'Romerbrevet',
    nn11: 'Romerbrevet',
    msg: 'Romans',
  }),
  book(['1 corinthians', '1 cor', 'i corinthians'], '1-corinthians', 46, {
    bm11: 'Første Korinterbrev',
    nn11: 'Første Korintarbrev',
    msg: '1 Corinthians',
  }),
  book(['2 corinthians', '2 cor', 'ii corinthians'], '2-corinthians', 47, {
    bm11: 'Andre Korinterbrev',
    nn11: 'Andre Korintarbrev',
    msg: '2 Corinthians',
  }),
  book(['galatians', 'gal'], 'galatians', 48, {
    bm11: 'Galaterbrevet',
    nn11: 'Galatarbrevet',
    msg: 'Galatians',
  }),
  book(['ephesians', 'eph'], 'ephesians', 49, {
    bm11: 'Efeserbrevet',
    nn11: 'Efesarbrevet',
    msg: 'Ephesians',
  }),
  book(['philippians', 'phil', 'php'], 'philippians', 50, {
    bm11: 'Filipperbrevet',
    nn11: 'Filipparbrevet',
    msg: 'Philippians',
  }),
  book(['colossians', 'col'], 'colossians', 51, {
    bm11: 'Kolosserbrevet',
    nn11: 'Kolossarbrevet',
    msg: 'Colossians',
  }),
  book(
    ['1 thessalonians', '1 thess', 'i thessalonians'],
    '1-thessalonians',
    52,
    {
      bm11: 'Første Tessalonikerbrev',
      nn11: 'Første Tessalonikarbrev',
      msg: '1 Thessalonians',
    },
  ),
  book(
    ['2 thessalonians', '2 thess', 'ii thessalonians'],
    '2-thessalonians',
    53,
    {
      bm11: 'Andre Tessalonikerbrev',
      nn11: 'Andre Tessalonikarbrev',
      msg: '2 Thessalonians',
    },
  ),
  book(['1 timothy', '1 tim', 'i timothy'], '1-timothy', 54, {
    bm11: 'Første Timoteusbrev',
    nn11: 'Første Timoteusbrev',
    msg: '1 Timothy',
  }),
  book(['2 timothy', '2 tim', 'ii timothy'], '2-timothy', 55, {
    bm11: 'Andre Timoteusbrev',
    nn11: 'Andre Timoteusbrev',
    msg: '2 Timothy',
  }),
  book(['titus'], 'titus', 56, {
    bm11: 'Titusbrevet',
    nn11: 'Titusbrevet',
    msg: 'Titus',
  }),
  book(['philemon', 'phlm'], 'philemon', 57, {
    bm11: 'Filemonbrevet',
    nn11: 'Filemonbrevet',
    msg: 'Philemon',
  }),
  book(['hebrews', 'heb'], 'hebrews', 58, {
    bm11: 'Hebreerbrevet',
    nn11: 'Hebrearbrevet',
    msg: 'Hebrews',
  }),
  book(['james', 'jas'], 'james', 59, {
    bm11: 'Jakobs brev',
    nn11: 'Jakobs brev',
    msg: 'James',
  }),
  book(['1 peter', '1 pet', 'i peter'], '1-peter', 60, {
    bm11: 'Første Petersbrev',
    nn11: 'Første Petersbrev',
    msg: '1 Peter',
  }),
  book(['2 peter', '2 pet', 'ii peter'], '2-peter', 61, {
    bm11: 'Andre Petersbrev',
    nn11: 'Andre Petersbrev',
    msg: '2 Peter',
  }),
  book(['1 john', 'i john'], '1-john', 62, {
    bm11: 'Første Johannesbrev',
    nn11: 'Første Johannesbrev',
    msg: '1 John',
  }),
  book(['2 john', 'ii john'], '2-john', 63, {
    bm11: 'Andre Johannesbrev',
    nn11: 'Andre Johannesbrev',
    msg: '2 John',
  }),
  book(['3 john', 'iii john'], '3-john', 64, {
    bm11: 'Tredje Johannesbrev',
    nn11: 'Tredje Johannesbrev',
    msg: '3 John',
  }),
  book(['jude'], 'jude', 65, {
    bm11: 'Judas’ brev',
    nn11: 'Judasbrevet',
    msg: 'Jude',
  }),
  book(['revelation', 'rev'], 'revelation', 66, {
    bm11: 'Johannes’ åpenbaring',
    nn11: 'Johannes’ openberring',
    msg: 'Revelation',
  }),
]

const HOLY_BIBLE_VERSION: Record<HolyBibleVersion, string> = {
  bm11: 'n11bm',
  nn11: 'n11nn',
}

const FETCH_HEADERS = {
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (compatible; GridDailyVerse/1.0; +https://gridsolutions.app)',
}

export function parseVerseReference(reference: string): ParsedReference {
  const trimmed = reference.trim()
  const match = trimmed.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (!match) {
    throw new Error(`Could not parse verse reference: ${reference}`)
  }
  const bookName = match[1].trim().toLowerCase()
  const chapter = Number(match[2])
  const verseStart = Number(match[3])
  const verseEnd = match[4] ? Number(match[4]) : verseStart
  const matchedBook = BOOKS.find((entry) => entry.names.includes(bookName))
  if (!matchedBook) {
    throw new Error(`Unknown Bible book: ${match[1]}`)
  }
  return {
    book: matchedBook,
    chapter,
    verseStart,
    verseEnd,
    display: trimmed,
  }
}

export function formatVerseCitation(
  parsed: ParsedReference,
  version: BibleVersion,
): string {
  const bookName =
    version === 'bm11' || version === 'nn11'
      ? parsed.book.labels[version]
      : parsed.book.labels.msg
  const separator = version === 'bm11' || version === 'nn11' ? ',' : ':'
  const verses =
    parsed.verseStart === parsed.verseEnd
      ? String(parsed.verseStart)
      : `${parsed.verseStart}-${parsed.verseEnd}`
  return `${bookName} ${parsed.chapter}${separator}${verses}`
}

export function extractHolyBibleVerse(html: string): string {
  const match = html.match(/<p class="row-verse">\s*([\s\S]*?)<\/p>/i)
  if (!match) {
    throw new Error('Verse markup not found')
  }
  const text = decodeHtml(stripTags(match[1])).replace(/\s+/g, ' ').trim()
  if (!text || /^verse not found\.?$/i.test(text)) {
    throw new Error('Verse not found')
  }
  return text
}

export function extractOremusVerse(html: string): string {
  const match = html.match(/<div class="bibletext">([\s\S]*?)<\/div>/i)
  if (!match) {
    throw new Error('NRSV verse markup not found')
  }
  const text = decodeHtml(stripTags(match[1].replace(/<!--[\s\S]*?-->/g, ' ')))
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) {
    throw new Error('NRSV verse was not found')
  }
  return text
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const n = Number(dec)
      const win1252: Record<number, string> = {
        145: '\u2018',
        146: '\u2019',
        147: '\u201C',
        148: '\u201D',
        150: '\u2013',
        151: '\u2014',
      }
      return win1252[n] ?? String.fromCharCode(n)
    })
}

async function fetchUrl(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Upstream ${res.status} for ${url}`)
    }
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchDailyReference(): Promise<string> {
  const raw = await fetchUrl(
    'https://beta.ourmanna.com/api/v1/get/?format=json',
  )
  const json = JSON.parse(raw) as {
    verse?: { details?: { reference?: string } }
  }
  const reference = json.verse?.details?.reference
  if (typeof reference !== 'string' || reference.length === 0) {
    throw new Error('Verse-of-the-day reference missing')
  }
  return reference
}

async function fetchHolyBibleVerses(
  version: HolyBibleVersion,
  parsed: ParsedReference,
): Promise<string> {
  const edition = HOLY_BIBLE_VERSION[version]
  const verses: Array<string> = []
  for (let verse = parsed.verseStart; verse <= parsed.verseEnd; verse++) {
    const html = await fetchUrl(
      `https://holybible.site/verse.php?version=${edition}&book=${parsed.book.slug}&chapter=${parsed.chapter}&verse=${verse}`,
    )
    verses.push(extractHolyBibleVerse(html))
  }
  return verses.join(' ')
}

async function fetchNrsvVerses(parsed: ParsedReference): Promise<string> {
  const passage = parsed.display.replace(/(\d+):(\d+(?:-\d+)?)$/, '$1.$2')
  const html = await fetchUrl(
    `https://bible.oremus.org/?version=NRSV&passage=${encodeURIComponent(passage)}&vnum=NO&fnote=NO&show_ref=NO&headings=NO&omithidden=YES`,
  )
  return extractOremusVerse(html)
}

async function fetchMessageVerses(parsed: ParsedReference): Promise<string> {
  const raw = await fetchUrl(
    `https://bolls.life/get-text/MSG/${parsed.book.bollsId}/${parsed.chapter}/`,
  )
  const rows = JSON.parse(raw) as Array<{ verse?: number; text?: string }>
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('The Message chapter was empty')
  }
  const verses = rows
    .filter(
      (row) =>
        typeof row.verse === 'number' &&
        row.verse >= parsed.verseStart &&
        row.verse <= parsed.verseEnd &&
        typeof row.text === 'string',
    )
    .map((row) =>
      decodeHtml(stripTags(row.text ?? ''))
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  if (verses.length === 0) {
    throw new Error('The Message verse was not found')
  }
  return verses.join(' ')
}

export async function fetchVerseOfTheDay(
  versionInput?: unknown,
): Promise<VerseOfTheDay> {
  const version = normalizeBibleVersion(versionInput)
  const reference = await fetchDailyReference()
  const parsed = parseVerseReference(reference)
  const passage =
    version === 'msg'
      ? await fetchMessageVerses(parsed)
      : version === 'nrsv'
        ? await fetchNrsvVerses(parsed)
        : await fetchHolyBibleVerses(version, parsed)
  const shortLabel =
    BIBLE_VERSION_OPTIONS.find((option) => option.value === version)
      ?.shortLabel ?? version.toUpperCase()
  return {
    citation: formatVerseCitation(parsed, version),
    passage,
    version: shortLabel,
  }
}
