/**
 * Server-side wrapper around `@glowstudent/youversion`.
 *
 * Why: the library uses Node-only axios/follow-redirects, so it can't run in the browser bundle.
 */
export default async function handler(req: any, res: any) {
  try {
    const lang =
      typeof req?.query?.lang === 'string' && req.query.lang.length > 0
        ? req.query.lang
        : 'en'

    const { getVerseOfTheDay } = await import('@glowstudent/youversion')
    const data = await getVerseOfTheDay(lang)

    // Cache at the edge (Vercel) but allow refresh.
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Cache-Control',
      's-maxage=3600, stale-while-revalidate=86400',
    )
    res.statusCode = 200
    res.end(JSON.stringify(data ?? null))
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
