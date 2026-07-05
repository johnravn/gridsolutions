import { BOOKINGS_SUB_TABS } from '@features/jobs/components/tabs/BookingsTab'

export function buildJobInspectorKeyboardSteps(
  tabValues: ReadonlyArray<string>,
): Array<string> {
  const steps: Array<string> = []
  for (const tab of tabValues) {
    if (tab === 'bookings') {
      for (const subTab of BOOKINGS_SUB_TABS) {
        steps.push(`bookings:${subTab}`)
      }
    } else {
      steps.push(tab)
    }
  }
  return steps
}

export function getJobInspectorKeyboardStep(
  activeTab: string,
  bookingsSubTab: string,
): string {
  if (activeTab === 'bookings') {
    return `bookings:${bookingsSubTab}`
  }
  return activeTab
}

export function parseJobInspectorKeyboardStep(step: string): {
  tab: string
  bookingsSubTab?: string
} {
  if (step.startsWith('bookings:')) {
    return { tab: 'bookings', bookingsSubTab: step.slice('bookings:'.length) }
  }
  return { tab: step }
}
