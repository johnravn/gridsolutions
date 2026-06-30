import { describe, expect, it } from 'vitest'
import { makeActivityFeedItem } from '@test/fixtures/latest'
import {
  getActivityButtonInfo,
  getActivityGenericMessage,
  getActivityNavigation,
} from './activityNavigation'

describe('getActivityNavigation', () => {
  it('returns inventory route for item created', () => {
    const nav = getActivityNavigation(
      makeActivityFeedItem({
        activity_type: 'inventory_item_created',
        metadata: { item_id: 'item-1' },
      }),
    )
    expect(nav).toEqual({
      route: '/inventory',
      searchParam: 'inventoryId',
      id: 'item-1',
    })
  })

  it('returns job route for job status changed', () => {
    const nav = getActivityNavigation(
      makeActivityFeedItem({
        activity_type: 'job_status_changed',
        metadata: { job_id: 'job-1' },
      }),
    )
    expect(nav?.route).toBe('/jobs')
    expect(nav?.id).toBe('job-1')
  })

  it('returns null for unsupported activity types', () => {
    expect(
      getActivityNavigation(
        makeActivityFeedItem({ activity_type: 'announcement' }),
      ),
    ).toBeNull()
  })
})

describe('getActivityButtonInfo', () => {
  it('returns button info for navigable types', () => {
    expect(getActivityButtonInfo('vehicle_added')).toEqual({
      label: 'Show vehicle',
      iconName: 'Car',
      color: 'green',
    })
  })

  it('returns null for unsupported types', () => {
    expect(getActivityButtonInfo('announcement')).toBeNull()
  })
})

describe('getActivityGenericMessage', () => {
  it('returns message for known activity types', () => {
    expect(getActivityGenericMessage('job_created')).toBe('New job created')
    expect(getActivityGenericMessage('grouped_inventory')).toBe(
      'New items added',
    )
  })
})
