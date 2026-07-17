export type ShortcutCategory = 'navigation' | 'panels' | 'create'

export type ShortcutId =
  | 'nav.sidebarPrev'
  | 'nav.sidebarNext'
  | 'nav.tabPrev'
  | 'nav.tabNext'
  | 'panel.collapse'
  | 'nav.goHome'
  | 'nav.goLatest'
  | 'nav.goInventory'
  | 'nav.goVehicles'
  | 'nav.goCrew'
  | 'nav.goJobs'
  | 'nav.goCalendar'
  | 'nav.goLogging'
  | 'nav.goCustomers'
  | 'nav.goMatters'
  | 'nav.goCompany'
  | 'nav.goReporting'
  | 'nav.goProfile'
  | 'create.job'
  | 'create.customer'
  | 'create.inventoryItem'
  | 'create.matter'
  | 'create.vehicle'
  | 'create.crew'

export type ShortcutDefinition = {
  id: ShortcutId
  label: string
  description: string
  category: ShortcutCategory
  /** Null means unbound until the user assigns one. */
  defaultHotkey: string | null
  /** When true, fires even while focus is in an input (rare). */
  allowInInputs?: boolean
  /** Route path for nav.go* shortcuts */
  route?: string
}

export const SHORTCUT_REGISTRY: ReadonlyArray<ShortcutDefinition> = [
  {
    id: 'nav.sidebarPrev',
    label: 'Previous sidebar page',
    description: 'Cycle to the previous allowed sidebar destination',
    category: 'navigation',
    defaultHotkey: 'Alt+ArrowUp',
  },
  {
    id: 'nav.sidebarNext',
    label: 'Next sidebar page',
    description: 'Cycle to the next allowed sidebar destination',
    category: 'navigation',
    defaultHotkey: 'Alt+ArrowDown',
  },
  {
    id: 'nav.tabPrev',
    label: 'Previous tab',
    description: 'Switch to the previous tab in the active panel',
    category: 'navigation',
    defaultHotkey: 'Alt+ArrowLeft',
  },
  {
    id: 'nav.tabNext',
    label: 'Next tab',
    description: 'Switch to the next tab in the active panel',
    category: 'navigation',
    defaultHotkey: 'Alt+ArrowRight',
  },
  {
    id: 'panel.collapse',
    label: 'Collapse / expand panel',
    description: 'Toggle the list or inspector sidebar panel',
    category: 'panels',
    defaultHotkey: 'Mod+B',
  },
  {
    id: 'nav.goHome',
    label: 'Go to Home',
    description: 'Navigate to the home dashboard',
    category: 'navigation',
    defaultHotkey: null,
    route: '/dashboard',
  },
  {
    id: 'nav.goLatest',
    label: 'Go to Latest',
    description: 'Navigate to the activity feed',
    category: 'navigation',
    defaultHotkey: null,
    route: '/latest',
  },
  {
    id: 'nav.goInventory',
    label: 'Go to Inventory',
    description: 'Navigate to inventory',
    category: 'navigation',
    defaultHotkey: null,
    route: '/inventory',
  },
  {
    id: 'nav.goVehicles',
    label: 'Go to Vehicles',
    description: 'Navigate to vehicles',
    category: 'navigation',
    defaultHotkey: null,
    route: '/vehicles',
  },
  {
    id: 'nav.goCrew',
    label: 'Go to Crew',
    description: 'Navigate to crew',
    category: 'navigation',
    defaultHotkey: null,
    route: '/crew',
  },
  {
    id: 'nav.goJobs',
    label: 'Go to Jobs',
    description: 'Navigate to jobs',
    category: 'navigation',
    defaultHotkey: null,
    route: '/jobs',
  },
  {
    id: 'nav.goCustomers',
    label: 'Go to Customers',
    description: 'Navigate to customers',
    category: 'navigation',
    defaultHotkey: null,
    route: '/customers',
  },
  {
    id: 'nav.goLogging',
    label: 'Go to Logging',
    description: 'Navigate to time logging',
    category: 'navigation',
    defaultHotkey: null,
    route: '/logging',
  },
  {
    id: 'nav.goCalendar',
    label: 'Go to Calendar',
    description: 'Navigate to calendar',
    category: 'navigation',
    defaultHotkey: null,
    route: '/calendar',
  },
  {
    id: 'nav.goMatters',
    label: 'Go to Matters',
    description: 'Navigate to matters',
    category: 'navigation',
    defaultHotkey: null,
    route: '/matters',
  },
  {
    id: 'nav.goCompany',
    label: 'Go to Company',
    description: 'Navigate to company settings',
    category: 'navigation',
    defaultHotkey: null,
    route: '/company',
  },
  {
    id: 'nav.goReporting',
    label: 'Go to Reporting',
    description: 'Navigate to reporting',
    category: 'navigation',
    defaultHotkey: null,
    route: '/reporting',
  },
  {
    id: 'nav.goProfile',
    label: 'Go to Profile',
    description: 'Navigate to your profile',
    category: 'navigation',
    defaultHotkey: null,
    route: '/profile',
  },
  {
    id: 'create.job',
    label: 'Create job',
    description: 'Open the create job dialog (on Jobs)',
    category: 'create',
    defaultHotkey: null,
  },
  {
    id: 'create.customer',
    label: 'Create customer',
    description: 'Open the add customer dialog (on Customers)',
    category: 'create',
    defaultHotkey: null,
  },
  {
    id: 'create.inventoryItem',
    label: 'Create inventory item',
    description: 'Open the add item dialog (on Inventory)',
    category: 'create',
    defaultHotkey: null,
  },
  {
    id: 'create.matter',
    label: 'Create matter',
    description: 'Open the create matter dialog (on Matters)',
    category: 'create',
    defaultHotkey: null,
  },
  {
    id: 'create.vehicle',
    label: 'Create vehicle',
    description: 'Open the add vehicle dialog (on Vehicles)',
    category: 'create',
    defaultHotkey: null,
  },
  {
    id: 'create.crew',
    label: 'Create crew member',
    description: 'Open the add freelancer dialog (on Crew)',
    category: 'create',
    defaultHotkey: null,
  },
]

export const SHORTCUT_BY_ID: Record<ShortcutId, ShortcutDefinition> =
  Object.fromEntries(SHORTCUT_REGISTRY.map((s) => [s.id, s])) as Record<
    ShortcutId,
    ShortcutDefinition
  >

export const DEFAULT_SHORTCUTS: Record<ShortcutId, string | null> =
  Object.fromEntries(
    SHORTCUT_REGISTRY.map((s) => [s.id, s.defaultHotkey]),
  ) as Record<ShortcutId, string | null>

export type ShortcutOverrides = Partial<Record<ShortcutId, string>>

export type ResolvedShortcuts = Record<ShortcutId, string | null>

const VALID_IDS = new Set<string>(SHORTCUT_REGISTRY.map((s) => s.id))

export function isShortcutBound(
  hotkey: string | null | undefined,
): hotkey is string {
  return typeof hotkey === 'string' && hotkey.trim().length > 0
}

/** Merge defaults with user overrides; drop unknown ids and empty strings. */
export function resolveShortcuts(
  overrides: ShortcutOverrides | null | undefined,
): ResolvedShortcuts {
  const resolved: ResolvedShortcuts = { ...DEFAULT_SHORTCUTS }
  if (!overrides || typeof overrides !== 'object') return resolved

  for (const [id, hotkey] of Object.entries(overrides)) {
    if (!VALID_IDS.has(id)) continue
    if (typeof hotkey !== 'string' || !hotkey.trim()) continue
    resolved[id as ShortcutId] = hotkey.trim()
  }
  return resolved
}

/** Parse preferences.keyboard_shortcuts from profiles JSON. */
export function parseShortcutOverrides(
  preferences: unknown,
): ShortcutOverrides {
  if (
    !preferences ||
    typeof preferences !== 'object' ||
    Array.isArray(preferences)
  ) {
    return {}
  }
  const raw = (preferences as Record<string, unknown>).keyboard_shortcuts
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const out: ShortcutOverrides = {}
  for (const [id, hotkey] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_IDS.has(id)) continue
    if (typeof hotkey !== 'string' || !hotkey.trim()) continue
    out[id as ShortcutId] = hotkey.trim()
  }
  return out
}

export function findShortcutConflict(
  resolved: ResolvedShortcuts,
  id: ShortcutId,
  candidate: string,
): ShortcutId | null {
  const normalized = candidate.trim().toLowerCase()
  for (const [otherId, hotkey] of Object.entries(resolved) as Array<
    [ShortcutId, string | null]
  >) {
    if (otherId === id) continue
    if (!isShortcutBound(hotkey)) continue
    if (hotkey.trim().toLowerCase() === normalized) return otherId
  }
  return null
}

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  panels: 'Panels',
  create: 'Create',
}
