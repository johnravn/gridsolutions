import { describe, expect, it } from 'vitest'
import {
  buildJobInspectorKeyboardSteps,
  getJobInspectorKeyboardStep,
  parseJobInspectorKeyboardStep,
} from './jobInspectorKeyboardTabs'

describe('jobInspectorKeyboardTabs', () => {
  const tabValues = ['overview', 'calendar', 'bookings', 'offers'] as const

  it('expands bookings into crew, equipment, and transport steps', () => {
    expect(buildJobInspectorKeyboardSteps(tabValues)).toEqual([
      'overview',
      'calendar',
      'bookings:crew',
      'bookings:equipment',
      'bookings:transport',
      'offers',
    ])
  })

  it('maps active bookings sub-tab to a keyboard step', () => {
    expect(getJobInspectorKeyboardStep('bookings', 'equipment')).toBe(
      'bookings:equipment',
    )
    expect(getJobInspectorKeyboardStep('calendar', 'crew')).toBe('calendar')
  })

  it('parses keyboard steps back into tab state', () => {
    expect(parseJobInspectorKeyboardStep('bookings:transport')).toEqual({
      tab: 'bookings',
      bookingsSubTab: 'transport',
    })
    expect(parseJobInspectorKeyboardStep('offers')).toEqual({ tab: 'offers' })
  })
})
