import { describe, expect, it } from 'vitest'
import {
  JOB_AUTOFILL_SEEDS,
  pickBySeedIndex,
  pickRandomJobAutofillSeedId,
} from './jobAutofillSeeds'

describe('jobAutofillSeeds', () => {
  it('defines 20 seeds with unique ids 1–20', () => {
    expect(JOB_AUTOFILL_SEEDS).toHaveLength(20)
    expect(JOB_AUTOFILL_SEEDS.map((s) => s.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
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
