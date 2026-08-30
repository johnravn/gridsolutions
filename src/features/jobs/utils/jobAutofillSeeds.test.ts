import { describe, expect, it } from 'vitest'
import {
  AUTOFILL_MIN_VARIATIONS,
  generateGroupAutofill,
  generateItemAutofill,
  generateVehicleAutofill,
} from '@shared/testing/autofill'
import {
  JOB_AUTOFILL_SEEDS,
  pickBySeedIndex,
  pickRandomJobAutofillSeedId,
} from './jobAutofillSeeds'

describe('jobAutofillSeeds', () => {
  it(`defines at least ${AUTOFILL_MIN_VARIATIONS} seeds with unique ids`, () => {
    expect(JOB_AUTOFILL_SEEDS.length).toBeGreaterThanOrEqual(
      AUTOFILL_MIN_VARIATIONS,
    )
    const ids = JOB_AUTOFILL_SEEDS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe(1)
    expect(ids[ids.length - 1]).toBe(ids.length)
  })

  it('includes company-member customer seeds', () => {
    expect(JOB_AUTOFILL_SEEDS.some((seed) => seed.isCompanyCustomer)).toBe(true)
  })

  it('covers both technician crew booking modes', () => {
    expect(
      JOB_AUTOFILL_SEEDS.some((seed) => seed.technicianCrewBooking === 'open'),
    ).toBe(true)
    expect(
      JOB_AUTOFILL_SEEDS.some(
        (seed) => seed.technicianCrewBooking === 'confirm_myself',
      ),
    ).toBe(true)
  })

  it('pickBySeedIndex wraps with modulo and treats -1 as none', () => {
    const list = ['a', 'b', 'c']
    expect(pickBySeedIndex(list, -1)).toBeNull()
    expect(pickBySeedIndex(list, 0)).toBe('a')
    expect(pickBySeedIndex(list, 2)).toBe('c')
    expect(pickBySeedIndex(list, 3)).toBe('a')
    expect(pickBySeedIndex(list, 5)).toBe('c')
    expect(pickBySeedIndex([], 0)).toBeNull()
  })

  it('pickRandomJobAutofillSeedId avoids the excluded id when possible', () => {
    const ids = new Set<number>()
    for (let i = 0; i < 40; i += 1) {
      ids.add(pickRandomJobAutofillSeedId(1))
    }
    expect(ids.has(1)).toBe(false)
    expect(ids.size).toBeGreaterThan(1)
  })
})

describe('shared autofill generators', () => {
  it('item autofill produces many unique combinations', () => {
    const names = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      names.add(generateItemAutofill().name)
    }
    expect(names.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('item autofill always includes nicknames', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateItemAutofill().nicknames.trim().length).toBeGreaterThan(0)
    }
  })

  it('group autofill produces many unique combinations', () => {
    const names = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      names.add(generateGroupAutofill().name)
    }
    expect(names.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('vehicle autofill produces many unique registration numbers', () => {
    const regs = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      regs.add(
        generateVehicleAutofill({
          partners: [{ id: 'p1' }, { id: 'p2' }],
          crew: [{ user_id: 'u1' }, { user_id: 'u2' }],
        }).registrationNo,
      )
    }
    expect(regs.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })
})
