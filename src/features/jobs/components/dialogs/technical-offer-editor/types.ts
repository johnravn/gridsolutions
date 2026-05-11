import type { UUID } from '../../../types'

export type LocalEquipmentGroup = {
  id: string // temp ID for new groups
  group_name: string
  sort_order: number
  items: Array<LocalEquipmentItem>
}

export type LocalEquipmentItem = {
  id: string // temp ID for new items
  item_id: string | null
  group_id: string | null
  quantity: number
  unit_price: number
  is_internal: boolean
  sort_order: number
  /** Free-text description for custom/one-off lines (when item_id and group_id are null). */
  custom_line_description?: string | null
  /** Free-text brand for custom lines (when item_id and group_id are null). */
  custom_line_brand?: string | null
  /** Free-text model for custom lines (when item_id and group_id are null). */
  custom_line_model?: string | null
  group_items?: Array<{
    id: string
    name: string
    brand_name: string | null
    model: string | null
    quantity: number
  }>
  item?: {
    id: string
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
    brand?: { id: string; name: string } | null
    model?: string | null
  } | null
  group?: {
    id: string
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
    external_owner_name?: string | null
  } | null
}

export type LocalCrewItem = {
  id: string // temp ID for new items
  role_title: string
  crew_count: number
  start_date: string
  end_date: string
  daily_rate: number
  hourly_rate: number | null
  hours_per_day: number | null
  billing_type: 'daily' | 'hourly'
  sort_order: number
  role_category?: string | null
}

export type LocalTransportItem = {
  id: string // temp ID for new items
  transport_group_id?: string
  vehicle_name: string
  vehicle_id: string | null
  vehicle_category:
    | 'passenger_car_small'
    | 'passenger_car_medium'
    | 'passenger_car_big'
    | 'van_small'
    | 'van_medium'
    | 'van_big'
    | 'C1'
    | 'C1E'
    | 'C'
    | 'CE'
    | null
  distance_km: number | null
  start_date: string
  end_date: string
  days_used: number | null
  daily_rate_count: number | null
  daily_rate: number | null
  distance_rate: number | null // Distance rate per increment (null means use default)
  is_internal: boolean
  sort_order: number
  vehicle?: {
    id: string
    name: string
    external_owner_id?: UUID | null
  } | null
}

export type LocalTransportGroup = {
  id: string // temp ID for new groups
  group_name: string
  sort_order: number
  items: Array<LocalTransportItem>
}

