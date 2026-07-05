import type {
  OfferDetail,
  OfferTransportGroup,
  OfferTransportItem,
} from '../types'

export type TransportGroupWithItems = OfferTransportGroup & {
  items: Array<OfferTransportItem>
}

/** Ensure each transport group has an `items` array (RPC may return groups without nested items). */
export function normalizeTransportGroups(
  detail: Pick<OfferDetail, 'transport_groups' | 'transport_items'>,
): Array<TransportGroupWithItems> {
  const groups = detail.transport_groups ?? []
  const flatItems = detail.transport_items ?? []

  if (groups.length === 0) {
    if (flatItems.length === 0) return []
    const basisId = flatItems[0]?.offer_basis_id ?? ''
    return [
      {
        id: 'transport',
        offer_basis_id: basisId,
        group_name: 'Transport',
        sort_order: 0,
        created_at: '',
        items: [...flatItems].sort((a, b) => a.sort_order - b.sort_order),
      },
    ]
  }

  const itemsByGroupId = new Map<string, Array<OfferTransportItem>>()
  for (const item of flatItems) {
    const groupId = item.transport_group_id
    if (!groupId) continue
    const list = itemsByGroupId.get(groupId) ?? []
    list.push(item)
    itemsByGroupId.set(groupId, list)
  }

  return [...groups]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((group) => {
      const nestedItems = group.items ?? []
      const fallbackItems = itemsByGroupId.get(group.id) ?? []
      const items = nestedItems.length > 0 ? nestedItems : fallbackItems
      return {
        ...group,
        items: [...items].sort((a, b) => a.sort_order - b.sort_order),
      }
    })
}
