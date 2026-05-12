/**
 * Group bookings are stored on `reserved_items` as one row per member item,
 * each with quantity = (group_items.quantity × number of groups booked).
 * This infers how many logical "groups" were booked from those lines.
 *
 * Same calculation as `createTechnicalOfferFromBookings` in offerQueries.ts.
 */
export function impliedBookedGroupCount(
  templateItems: Array<{ item_id: string; quantity: number }>,
  bookedLines: Array<{ item_id: string; quantity: number }>,
): number {
  if (templateItems.length === 0) {
    return 1
  }

  const bookedByItem = new Map<string, number>()
  for (const row of bookedLines) {
    if (!row.item_id) continue
    bookedByItem.set(
      row.item_id,
      (bookedByItem.get(row.item_id) ?? 0) + row.quantity,
    )
  }

  let minRatio = Number.POSITIVE_INFINITY
  for (const groupItem of templateItems) {
    if (!groupItem.item_id || groupItem.quantity <= 0) continue
    const bookedQty = bookedByItem.get(groupItem.item_id) ?? 0
    const ratio = bookedQty / groupItem.quantity
    minRatio = Math.min(minRatio, ratio)
  }

  const computedQty =
    Number.isFinite(minRatio) && minRatio > 0 ? Math.floor(minRatio) : 1
  return Math.max(1, computedQty)
}
