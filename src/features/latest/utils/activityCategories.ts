import type { ActivityType } from '../types'

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  inventory_item_created: 'Inventory Items',
  inventory_item_deleted: 'Inventory Items',
  inventory_group_created: 'Inventory Groups',
  inventory_group_deleted: 'Inventory Groups',
  vehicle_added: 'Vehicles',
  vehicle_removed: 'Vehicles',
  customer_added: 'Customers',
  customer_removed: 'Customers',
  crew_added: 'Crew',
  crew_removed: 'Crew',
  job_created: 'Jobs',
  job_status_changed: 'Jobs',
  job_deleted: 'Jobs',
  announcement: 'Announcements',
}

export const ACTIVITY_CATEGORY_GROUPS: Record<string, Array<ActivityType>> = {
  All: [],
  Inventory: [
    'inventory_item_created',
    'inventory_item_deleted',
    'inventory_group_created',
    'inventory_group_deleted',
  ],
  Vehicles: ['vehicle_added', 'vehicle_removed'],
  Customers: ['customer_added', 'customer_removed'],
  Crew: ['crew_added', 'crew_removed'],
  Jobs: ['job_created', 'job_status_changed', 'job_deleted'],
  Announcements: ['announcement'],
}

export const ACTIVITY_CATEGORY_OPTIONS = Object.keys(
  ACTIVITY_CATEGORY_GROUPS,
).filter((key) => key !== 'All')
