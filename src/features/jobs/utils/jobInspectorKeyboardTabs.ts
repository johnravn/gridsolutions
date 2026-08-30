import { BOOKINGS_SUB_TABS } from '@features/jobs/components/tabs/BookingsTab'

/** Map legacy `invoices` deep-links to the combined Invoice tab. */
export function normalizeJobInspectorTab(tab: string | undefined): string {
  if (!tab) return 'overview'
  if (tab === 'invoices') return 'invoice'
  return tab
}

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
