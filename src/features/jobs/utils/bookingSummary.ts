import { formatVehicleCategory } from '@features/jobs/components/dialogs/technical-offer-editor/utils'
import type { OfferDetail, OfferTransportItem } from '../types'

export type JobBookingSummary = {
  hasEquipment: boolean
  hasVehicles: boolean
  equipmentByCategory: Array<{ categoryName: string; quantity: number }>
  vehicleNames: Array<string>
  crewLabels: Array<string>
}

export const EMPTY_JOB_BOOKING_SUMMARY: JobBookingSummary = {
  hasEquipment: false,
  hasVehicles: false,
  equipmentByCategory: [],
  vehicleNames: [],
  crewLabels: [],
}

function collectTransportItems(
  detail: Pick<OfferDetail, 'transport_items' | 'transport_groups'>,
): Array<OfferTransportItem> {
  const byId = new Map<string, OfferTransportItem>()

  for (const item of detail.transport_items ?? []) {
    if (item.id) byId.set(item.id, item)
  }

  for (const group of detail.transport_groups ?? []) {
    for (const item of group.items ?? []) {
      if (item.id) byId.set(item.id, item)
    }
  }

  return [...byId.values()]
}

function transportItemLabel(
  item: OfferTransportItem,
  vehicleNameById: Map<string, string>,
): string {
  const explicitName = item.vehicle_name?.trim()
  if (explicitName) return explicitName

  if (item.vehicle_id) {
    const linkedName = vehicleNameById.get(item.vehicle_id)?.trim()
    if (linkedName) return linkedName
  }

  if (item.vehicle_category) {
    return formatVehicleCategory(item.vehicle_category)
  }

  return 'Transport'
}

export function buildOfferBasisBookingSummary(
  detail: Pick<
    OfferDetail,
    'groups' | 'crew_items' | 'transport_items' | 'transport_groups'
  >,
  itemCategoryById: Map<string, string>,
  groupCategoryById: Map<string, string>,
  vehicleNameById: Map<string, string> = new Map(),
): JobBookingSummary {
  const categoryQty = new Map<string, number>()

  const bump = (categoryName: string, delta: number) => {
    if (delta <= 0) return
    categoryQty.set(categoryName, (categoryQty.get(categoryName) ?? 0) + delta)
  }

  for (const group of detail.groups ?? []) {
    for (const item of group.items ?? []) {
      const quantity = Math.max(0, Number(item.quantity ?? 0))
      if (quantity <= 0) continue

      if (item.item_id) {
        bump(itemCategoryById.get(item.item_id) ?? 'Other', quantity)
        continue
      }

      if (item.group_id) {
        bump(groupCategoryById.get(item.group_id) ?? 'Other', quantity)
        continue
      }

      if (item.custom_line_description?.trim()) {
        bump('Custom', quantity)
      }
    }
  }

  const equipmentByCategory = [...categoryQty.entries()]
    .map(([categoryName, quantity]) => ({ categoryName, quantity }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))

  const vehicleNames = [
    ...new Set(
      collectTransportItems(detail).map((row) =>
        transportItemLabel(row, vehicleNameById),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, 'nb'))

  const crewByRole = new Map<string, number>()
  for (const row of detail.crew_items ?? []) {
    const title = row.role_title?.trim() || 'Crew'
    const count = Math.max(1, row.crew_count ?? 1)
    crewByRole.set(title, (crewByRole.get(title) ?? 0) + count)
  }

  const crewLabels = [...crewByRole.entries()]
    .map(([title, count]) => (count > 1 ? `${title} ×${count}` : title))
    .sort((a, b) => a.localeCompare(b, 'nb'))

  return {
    hasEquipment: equipmentByCategory.length > 0,
    hasVehicles: vehicleNames.length > 0,
    equipmentByCategory,
    vehicleNames,
    crewLabels,
  }
}
