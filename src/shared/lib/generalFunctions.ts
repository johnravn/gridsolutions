/**
 * Barrel re-exports for shared string/date/search helpers.
 * Prefer importing from the domain modules (`localDates`, `vat`, `fuzzyClient`,
 * `initials`, `presentable`) when adding new call sites.
 */
export {
  addLocalCalendarDays,
  addThreeHours,
  formatLocalYmd,
} from './localDates'
export { formatVATInput, fmtVAT } from './vat'
export {
  fuzzyMatch,
  fuzzyMatchScore,
  fuzzySearch,
  getFuzzyMatchRanges,
  type FuzzyMatchRange,
} from './fuzzyClient'
export { getInitials, getInitialsFromNameOrEmail } from './initials'
export { makeWordPresentable } from './presentable'
