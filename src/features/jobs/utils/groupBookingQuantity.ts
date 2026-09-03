/**
 * Group bookings are stored on `reserved_items` as one row per member item,
 * each with quantity = (group_items.quantity × number of groups booked).
 * This infers how many logical "groups" were booked from those lines.
 *
 * Same calculation as invoices, the equipment tab, and offer-basis import.
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

export type BookedGroupLine = {
  source_group_id: string | null
  time_period_id: string | null
  item_id: string | null
  quantity: number | null
}

/**
 * Offer-basis import quantity per inventory group.
 *
 * Booked groups are stored as one reserved-item row per member, so callers
 * must not add implied counts once per raw row. Chunk by
 * (source_group_id, time_period_id), infer the group count, then sum
 * across periods — same semantics as invoices and the equipment tab.
 */
export function bookedGroupQuantitiesByGroupId(
  bookings: Array<BookedGroupLine>,
  groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
): Map<string, number> {
  const chunks = new Map<
    string,
    {
      groupId: string
      lines: Array<{ item_id: string; quantity: number }>
    }
  >()

  for (const booking of bookings) {
    const groupId = booking.source_group_id
    if (!groupId || !booking.item_id) continue
    const key = `${groupId}:${booking.time_period_id ?? ''}`
    const chunk = chunks.get(key) ?? { groupId, lines: [] }
    chunk.lines.push({
      item_id: booking.item_id,
      quantity: booking.quantity ?? 0,
    })
    chunks.set(key, chunk)
  }

  const quantities = new Map<string, number>()
  for (const chunk of chunks.values()) {
    const template = groupItemsMap.get(chunk.groupId) ?? []
    const count = impliedBookedGroupCount(template, chunk.lines)
    quantities.set(chunk.groupId, (quantities.get(chunk.groupId) ?? 0) + count)
  }
  return quantities
}

/**
 * Same as bookedGroupQuantitiesByGroupId, but keeps period identity:
 * key = `${groupId}:${time_period_id}`.
 */
export function bookedGroupQuantitiesByGroupAndPeriod(
  bookings: Array<BookedGroupLine>,
  groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
): Map<string, { groupId: string; time_period_id: string; quantity: number }> {
  const chunks = new Map<
    string,
    {
      groupId: string
      time_period_id: string
      lines: Array<{ item_id: string; quantity: number }>
    }
  >()

  for (const booking of bookings) {
    const groupId = booking.source_group_id
    if (!groupId || !booking.item_id || !booking.time_period_id) continue
    const key = `${groupId}:${booking.time_period_id}`
    const chunk = chunks.get(key) ?? {
      groupId,
      time_period_id: booking.time_period_id,
      lines: [],
    }
    chunk.lines.push({
      item_id: booking.item_id,
      quantity: booking.quantity ?? 0,
    })
    chunks.set(key, chunk)
  }

  const result = new Map<
    string,
    { groupId: string; time_period_id: string; quantity: number }
  >()
  for (const [key, chunk] of chunks.entries()) {
    const template = groupItemsMap.get(chunk.groupId) ?? []
    const count = impliedBookedGroupCount(template, chunk.lines)
    result.set(key, {
      groupId: chunk.groupId,
      time_period_id: chunk.time_period_id,
      quantity: count,
    })
  }
  return result
}
