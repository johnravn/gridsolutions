/**
 * Offer equipment/crew/transport lines reference time_periods with
 * ON DELETE RESTRICT. Booking sync may wipe unused periods, but must
 * keep any period still pointed at by an offer line.
 */
export function timePeriodIdsSafeToDelete(
  candidateIds: Array<string>,
  referencedIds: Iterable<string | null | undefined>,
): Array<string> {
  const referenced = new Set<string>()
  for (const id of referencedIds) {
    if (id) referenced.add(id)
  }
  return candidateIds.filter((id) => !referenced.has(id))
}
