/** Shared with the client via mirrored constants in `src/shared/lib/bibleVersion.ts`.
 * Lives under `api/_lib/` so Vercel does not count it as a Serverless Function.
 */
export const BIBLE_VERSIONS = ['bm11', 'nn11', 'nrsv', 'msg'] as const

export type BibleVersion = (typeof BIBLE_VERSIONS)[number]

export const DEFAULT_BIBLE_VERSION: BibleVersion = 'bm11'

export const BIBLE_VERSION_OPTIONS: Array<{
  value: BibleVersion
  label: string
  shortLabel: string
}> = [
  {
    value: 'bm11',
    label: 'Bibel 2011 Bokmål (BM11)',
    shortLabel: 'BM11',
  },
  {
    value: 'nn11',
    label: 'Bibel 2011 Nynorsk (NN11)',
    shortLabel: 'NN11',
  },
  {
    value: 'nrsv',
    label: 'New Revised Standard Version (NRSV)',
    shortLabel: 'NRSV',
  },
  {
    value: 'msg',
    label: 'The Message (MSG)',
    shortLabel: 'MSG',
  },
]

export function isBibleVersion(value: unknown): value is BibleVersion {
  return (
    typeof value === 'string' &&
    (BIBLE_VERSIONS as ReadonlyArray<string>).includes(value)
  )
}

export function normalizeBibleVersion(value: unknown): BibleVersion {
  return isBibleVersion(value) ? value : DEFAULT_BIBLE_VERSION
}
