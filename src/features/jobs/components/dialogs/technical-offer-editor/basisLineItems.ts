import { calculateHoursPerDay } from './utils'
import type { OfferBasisDetail } from '../../../types'
import type {
  LocalCrewItem,
  LocalEquipmentGroup,
  LocalTransportGroup,
} from './types'

export function lineItemsFromBasisDetail(
  basis: OfferBasisDetail,
  defaultCrewRatePerHour: number | null,
): {
  equipmentGroups: Array<LocalEquipmentGroup>
  crewItems: Array<LocalCrewItem>
  transportGroups: Array<LocalTransportGroup>
} {
  const equipmentGroups: Array<LocalEquipmentGroup> =
    basis.groups?.map((group) => ({
      id: group.id,
      group_name: group.group_name,
      sort_order: group.sort_order,
      items: group.items.map((item) => {
        const rawItem = item.item as any
        const rawBrand = rawItem?.brand
        const brand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand
        const rawGroup = (item as any).group
        return {
          id: item.id,
          item_id: item.item_id,
          group_id: item.group_id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          custom_line_description:
            (item as any).custom_line_description ?? null,
          custom_line_brand: (item as any).custom_line_brand ?? null,
          custom_line_model: (item as any).custom_line_model ?? null,
          item: rawItem
            ? {
                id: rawItem.id,
                name: rawItem.name,
                item_kind: rawItem.item_kind ?? 'stock',
                brand: brand ?? null,
                model: rawItem.model ?? null,
              }
            : null,
          group: rawGroup
            ? {
                id: rawGroup.id,
                name: rawGroup.name,
                item_kind: rawGroup.item_kind ?? 'stock',
              }
            : null,
        }
      }),
    })) || []

  const crewItems: Array<LocalCrewItem> =
    basis.crew_items?.map((item) => {
      const rawItem: any = item
      const billingType: 'daily' | 'hourly' =
        rawItem?.billing_type === 'hourly' ? 'hourly' : 'daily'
      const hoursFromDates = calculateHoursPerDay(
        item.start_date,
        item.end_date,
      )
      const baseHoursPerDay =
        billingType === 'hourly'
          ? (hoursFromDates ?? rawItem?.hours_per_day ?? 8)
          : null
      const baseHourlyRate =
        billingType === 'hourly'
          ? (rawItem?.hourly_rate ??
            (baseHoursPerDay && baseHoursPerDay > 0
              ? item.daily_rate / baseHoursPerDay
              : (defaultCrewRatePerHour ?? null)))
          : null
      const normalizedDailyRate =
        billingType === 'hourly'
          ? (baseHourlyRate ?? 0) * (baseHoursPerDay ?? 0)
          : item.daily_rate

      return {
        id: item.id,
        role_title: item.role_title,
        crew_count: item.crew_count,
        start_date: item.start_date,
        end_date: item.end_date,
        daily_rate: normalizedDailyRate,
        hourly_rate: billingType === 'hourly' ? baseHourlyRate : null,
        hours_per_day: billingType === 'hourly' ? baseHoursPerDay : null,
        billing_type: billingType,
        sort_order: item.sort_order,
        role_category: rawItem?.role_category ?? null,
      }
    }) || []

  let transportGroups: Array<LocalTransportGroup>
  const fromTransportGroups = basis.transport_groups
  if (fromTransportGroups && fromTransportGroups.length > 0) {
    transportGroups = fromTransportGroups.map((group) => ({
      id: group.id,
      group_name: group.group_name,
      sort_order: group.sort_order,
      items: group.items.map((item) => ({
        id: item.id,
        transport_group_id: group.id,
        vehicle_name: item.vehicle_name,
        vehicle_id: item.vehicle_id ?? null,
        vehicle_category: item.vehicle_category ?? null,
        distance_km: item.distance_km ?? null,
        start_date: item.start_date,
        end_date: item.end_date,
        days_used: item.days_used ?? null,
        daily_rate_count: item.daily_rate_count ?? null,
        daily_rate: item.daily_rate > 0 ? item.daily_rate : null,
        distance_rate: item.distance_rate ?? null,
        is_internal: item.is_internal,
        sort_order: item.sort_order,
        vehicle: item.vehicle ?? null,
      })),
    }))
  } else if (basis.transport_items && basis.transport_items.length > 0) {
    const gid = `temp-${Date.now()}-tg`
    transportGroups = [
      {
        id: gid,
        group_name: 'Transport',
        sort_order: 0,
        items: basis.transport_items.map((item) => ({
          id: item.id,
          transport_group_id: gid,
          vehicle_name: item.vehicle_name,
          vehicle_id: item.vehicle_id ?? null,
          vehicle_category: item.vehicle_category ?? null,
          distance_km: item.distance_km ?? null,
          start_date: item.start_date,
          end_date: item.end_date,
          days_used: item.days_used ?? null,
          daily_rate_count: item.daily_rate_count ?? null,
          daily_rate: item.daily_rate > 0 ? item.daily_rate : null,
          distance_rate: item.distance_rate ?? null,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          vehicle: item.vehicle ?? null,
        })),
      },
    ]
  } else {
    transportGroups = []
  }

  return { equipmentGroups, crewItems, transportGroups }
}
