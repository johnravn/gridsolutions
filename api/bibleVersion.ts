/** Shared with the client via mirrored constants in `src/shared/lib/bibleVersion.ts`. */
export const BIBLE_VERSIONS = ['bm11', 'nn11', 'msg'] as const

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
    value: 'msg',
    label: 'The Message (MSG)',
    shortLabel: 'MSG',
  },
]

export function normalizeBibleVersion(value: unknown): BibleVersion {
  return value === 'nn11' || value === 'msg' || value === 'bm11'
    ? value
    : DEFAULT_BIBLE_VERSION
}
