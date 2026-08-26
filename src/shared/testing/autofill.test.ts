import { describe, expect, it } from 'vitest'
import {
  AUTOFILL_MIN_VARIATIONS,
  SHOW_AUTOFILL_BUTTONS,
  generateCustomerAutofill,
  generateGroupAutofill,
  generateGroupPartsAutofill,
  generateItemAutofill,
  generateVehicleAutofill,
} from './autofill'

describe('autofill generators', () => {
  it('keeps Auto-fill buttons hidden until the flag is flipped', () => {
    expect(SHOW_AUTOFILL_BUTTONS).toBe(false)
  })

  it('item autofill supports hundreds of name variations', () => {
    const names = new Set<string>()
    for (let i = 0; i < 400; i += 1) {
      names.add(generateItemAutofill().name)
    }
    expect(names.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('item autofill populates nicknames and pricing fields', () => {
    const sample = generateItemAutofill()
    expect(sample.name.length).toBeGreaterThan(0)
    expect(sample.brandName.length).toBeGreaterThan(0)
    expect(sample.model.length).toBeGreaterThan(0)
    expect(sample.notes.length).toBeGreaterThan(0)
    expect(sample.nicknames.length).toBeGreaterThan(0)
    expect(sample.price).toBeGreaterThan(0)
  })

  it('group autofill supports hundreds of name variations', () => {
    const names = new Set<string>()
    for (let i = 0; i < 400; i += 1) {
      names.add(generateGroupAutofill().name)
    }
    expect(names.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('group parts autofill picks from available picker items', () => {
    const pickerItems = [
      { id: 'a', name: 'Cable', type: 'item' as const, current_price: 10 },
      { id: 'b', name: 'Mic', type: 'item' as const, current_price: 20 },
      { id: 'c', name: 'Kit', type: 'group' as const, current_price: 100 },
    ]
    const parts = generateGroupPartsAutofill(pickerItems)
    expect(parts.length).toBeGreaterThanOrEqual(1)
    expect(parts.every((part) => part.quantity >= 1)).toBe(true)
  })

  it('vehicle autofill supports hundreds of registration variations', () => {
    const regs = new Set<string>()
    for (let i = 0; i < 400; i += 1) {
      regs.add(
        generateVehicleAutofill({ partners: [], crew: [] }).registrationNo,
      )
    }
    expect(regs.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('customer autofill supports hundreds of name variations', () => {
    const names = new Set<string>()
    for (let i = 0; i < 400; i += 1) {
      names.add(generateCustomerAutofill().name)
    }
    expect(names.size).toBeGreaterThanOrEqual(AUTOFILL_MIN_VARIATIONS)
  })

  it('customer autofill populates all fields', () => {
    const sample = generateCustomerAutofill()
    expect(sample.name.length).toBeGreaterThan(0)
    expect(sample.vatNumber).toMatch(/^\d{3} \d{3} \d{3}$/)
    expect(sample.addressLine.length).toBeGreaterThan(0)
    expect(sample.zipCode).toMatch(/^\d{4}$/)
    expect(sample.city.length).toBeGreaterThan(0)
    expect(sample.country).toBe('Norway')
    expect(typeof sample.isPartner).toBe('boolean')
  })
})
