import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  __resetOfferBasisWriteLocksForTests,
  basisImportWouldWriteLines,
  canAutosaveOfferBasisState,
  editorStateHasLineItems,
  withOfferBasisWriteLock,
} from './offerBasisWriteSafety'

describe('basisImportWouldWriteLines', () => {
  it('rejects empty time periods', () => {
    expect(
      basisImportWouldWriteLines({
        timePeriodCount: 0,
        equipmentCategoryCount: 3,
        crewLineCount: 2,
        transportBookingCount: 1,
      }),
    ).toBe(false)
  })

  it('rejects time periods with no importable lines', () => {
    expect(
      basisImportWouldWriteLines({
        timePeriodCount: 2,
        equipmentCategoryCount: 0,
        crewLineCount: 0,
        transportBookingCount: 0,
      }),
    ).toBe(false)
  })

  it('accepts when any line type would be written', () => {
    expect(
      basisImportWouldWriteLines({
        timePeriodCount: 1,
        equipmentCategoryCount: 1,
        crewLineCount: 0,
        transportBookingCount: 0,
      }),
    ).toBe(true)
    expect(
      basisImportWouldWriteLines({
        timePeriodCount: 1,
        equipmentCategoryCount: 0,
        crewLineCount: 1,
        transportBookingCount: 0,
      }),
    ).toBe(true)
    expect(
      basisImportWouldWriteLines({
        timePeriodCount: 1,
        equipmentCategoryCount: 0,
        crewLineCount: 0,
        transportBookingCount: 1,
      }),
    ).toBe(true)
  })
})

describe('editorStateHasLineItems', () => {
  it('detects equipment, crew, and transport lines', () => {
    expect(
      editorStateHasLineItems({
        equipmentGroups: [],
        crewItems: [],
        transportGroups: [],
      }),
    ).toBe(false)
    expect(
      editorStateHasLineItems({
        equipmentGroups: [{ items: [{}] }],
        crewItems: [],
        transportGroups: [],
      }),
    ).toBe(true)
    expect(
      editorStateHasLineItems({
        equipmentGroups: [{ items: [] }],
        crewItems: [{}],
        transportGroups: [],
      }),
    ).toBe(true)
    expect(
      editorStateHasLineItems({
        equipmentGroups: [],
        crewItems: [],
        transportGroups: [{ items: [{}] }],
      }),
    ).toBe(true)
  })

  it('ignores empty nested item arrays', () => {
    expect(
      editorStateHasLineItems({
        equipmentGroups: [{ items: [] }, { items: [] }],
        crewItems: [],
        transportGroups: [{ items: [] }],
      }),
    ).toBe(false)
  })
})

describe('canAutosaveOfferBasisState', () => {
  const empty = {
    equipmentGroups: [] as Array<{ items: Array<unknown> }>,
    crewItems: [] as Array<unknown>,
    transportGroups: [] as Array<{ items: Array<unknown> }>,
  }

  it('blocks autosave that would wipe a non-empty baseline', () => {
    expect(
      canAutosaveOfferBasisState({
        baselineHadLineItems: true,
        current: empty,
      }),
    ).toBe(false)
  })

  it('allows autosave when baseline was already empty', () => {
    expect(
      canAutosaveOfferBasisState({
        baselineHadLineItems: false,
        current: empty,
      }),
    ).toBe(true)
  })

  it('allows autosave when current state still has lines', () => {
    expect(
      canAutosaveOfferBasisState({
        baselineHadLineItems: true,
        current: {
          equipmentGroups: [{ items: [{}] }],
          crewItems: [],
          transportGroups: [],
        },
      }),
    ).toBe(true)
  })
})

describe('withOfferBasisWriteLock', () => {
  beforeEach(() => {
    __resetOfferBasisWriteLocksForTests()
  })

  it('runs same-basis writers one at a time', async () => {
    const order: Array<string> = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = withOfferBasisWriteLock('basis-a', async () => {
      order.push('first-start')
      await firstGate
      order.push('first-end')
      return 1
    })

    const second = withOfferBasisWriteLock('basis-a', async () => {
      order.push('second-start')
      order.push('second-end')
      return 2
    })

    // Give both calls a chance to schedule; second must wait.
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['first-start'])

    releaseFirst()
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2])
    expect(order).toEqual([
      'first-start',
      'first-end',
      'second-start',
      'second-end',
    ])
  })

  it('allows different bases to run concurrently', async () => {
    let releaseA!: () => void
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const startedB = vi.fn()

    const a = withOfferBasisWriteLock('basis-a', async () => {
      await gateA
      return 'a'
    })
    const b = withOfferBasisWriteLock('basis-b', async () => {
      startedB()
      return 'b'
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(startedB).toHaveBeenCalledTimes(1)

    releaseA()
    await expect(Promise.all([a, b])).resolves.toEqual(['a', 'b'])
  })

  it('releases the lock when a writer fails', async () => {
    await expect(
      withOfferBasisWriteLock('basis-a', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    await expect(
      withOfferBasisWriteLock('basis-a', async () => 'recovered'),
    ).resolves.toBe('recovered')
  })
})
