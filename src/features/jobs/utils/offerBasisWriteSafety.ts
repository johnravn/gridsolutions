/**
 * Helpers that keep offer-basis writes from wiping data by accident.
 * Pure functions so they can be unit-tested without Supabase.
 */

export function basisImportWouldWriteLines(input: {
  timePeriodCount: number
  equipmentCategoryCount: number
  crewLineCount: number
  transportBookingCount: number
}): boolean {
  if (input.timePeriodCount <= 0) return false
  return (
    input.equipmentCategoryCount > 0 ||
    input.crewLineCount > 0 ||
    input.transportBookingCount > 0
  )
}

export function editorStateHasLineItems(state: {
  equipmentGroups: Array<{ items: Array<unknown> }>
  crewItems: Array<unknown>
  transportGroups: Array<{ items: Array<unknown> }>
}): boolean {
  if (state.crewItems.length > 0) return true
  if (state.equipmentGroups.some((group) => group.items.length > 0)) return true
  return state.transportGroups.some((group) => group.items.length > 0)
}

/**
 * Autosave must not wipe a non-empty baseline with an empty editor state.
 * Intentional clears still go through the explicit Save button.
 */
export function canAutosaveOfferBasisState(input: {
  baselineHadLineItems: boolean
  current: {
    equipmentGroups: Array<{ items: Array<unknown> }>
    crewItems: Array<unknown>
    transportGroups: Array<{ items: Array<unknown> }>
  }
}): boolean {
  const incomingEmpty = !editorStateHasLineItems(input.current)
  if (incomingEmpty && input.baselineHadLineItems) return false
  return true
}

/** Serialize writes per basis so delete+reinsert cannot interleave. */
const offerBasisWriteTails = new Map<string, Promise<unknown>>()

/** Test-only: clear pending write locks between cases. */
export function __resetOfferBasisWriteLocksForTests() {
  offerBasisWriteTails.clear()
}

export async function withOfferBasisWriteLock<T>(
  basisId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = offerBasisWriteTails.get(basisId) ?? Promise.resolve()
  let release!: () => void
  const done = new Promise<void>((resolve) => {
    release = resolve
  })
  offerBasisWriteTails.set(
    basisId,
    previous.then(
      () => done,
      () => done,
    ),
  )
  await previous.catch(() => undefined)
  try {
    return await fn()
  } finally {
    release()
  }
}
