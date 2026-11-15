export type LegalLang = 'en' | 'no'

/** Supported locales for Terms & Privacy copy. */
export const LEGAL_LANGS = [
  'en',
  'no',
] as const satisfies ReadonlyArray<LegalLang>
