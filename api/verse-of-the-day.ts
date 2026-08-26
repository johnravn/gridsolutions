/**
 * Daily verse endpoint.
 *
 * YouVersion's public site is bot-protected, so we resolve today's reference
 * from OurManna and load BM11/NN11/NRSV/MSG from sources that still return text.
 */
import { normalizeBibleVersion } from './_lib/bibleVersion.js'
import { fetchVerseOfTheDay } from './_lib/verseOfTheDay.js'

export default async function handler(req: any, res: any) {
  try {
    const version = normalizeBibleVersion(
      typeof req?.query?.version === 'string' ? req.query.version : undefined,
    )
    const data = await fetchVerseOfTheDay(version)

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Cache-Control',
      's-maxage=3600, stale-while-revalidate=86400',
    )
    res.statusCode = 200
    res.end(JSON.stringify(data))
  } catch (e: any) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.statusCode = 500
    res.end(
      JSON.stringify({
        error: 'Failed to load verse of the day',
        message: e?.message ?? String(e),
      }),
    )
  }
}
