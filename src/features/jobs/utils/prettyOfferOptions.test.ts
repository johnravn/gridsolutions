import { describe, expect, it } from 'vitest'
import {
  applyOptionsToOfferTotals,
  calculateOptionsSubtotal,
  collectOfferOptions,
  getSelectedOptionEntries,
  resolveDefaultSelectedOptionIds,
  validateOptionSelection,
} from './prettyOfferOptions'
import type { PrettyOfferModuleBlock } from '../types'

function optionsBlock(
  blockId: string,
  moduleId: string,
  groups: Array<{
    id: string
    title?: string
    mode: 'single' | 'multiple'
    options: Array<{
      id: string
      label: string
      price: number
      defaultSelected?: boolean
    }>
  }>,
): PrettyOfferModuleBlock {
  return {
    id: blockId,
    module_id: moduleId,
    block_type: 'options',
    sort_order: 0,
    text_content: null,
    url: null,
    link_title: null,
    caption: null,
    items: groups.map((group, index) => ({
      id: group.id,
      block_id: blockId,
      sort_order: index,
      label: group.title ?? '',
      summary: group.mode,
      detail: JSON.stringify({
        options: group.options.map((option) => ({
          id: option.id,
          label: option.label,
          price: option.price,
          default_selected: option.defaultSelected === true,
          blocks: [],
        })),
      }),
    })),
  }
}

describe('collectOfferOptions', () => {
  it('collects top-level and column-nested options', () => {
    const moduleId = 'module-1'
    const blocks: Array<PrettyOfferModuleBlock> = [
      optionsBlock('block-1', moduleId, [
        {
          id: 'group-1',
          mode: 'multiple',
          options: [{ id: 'opt-a', label: 'Lighting', price: 1000 }],
        },
      ]),
      {
        id: 'col-1',
        module_id: moduleId,
        block_type: 'column_layout',
        sort_order: 1,
        text_content: null,
        url: null,
        link_title: null,
        caption: '2',
        items: [
          {
            id: 'column-1',
            block_id: 'col-1',
            sort_order: 0,
            label: '',
            summary: null,
            detail: JSON.stringify({
              blocks: [
                optionsBlock('block-2', moduleId, [
                  {
                    id: 'group-2',
                    mode: 'single',
                    options: [{ id: 'opt-b', label: 'Small PA', price: 2000 }],
                  },
                ]),
              ],
            }),
          },
        ],
      },
    ]

    const options = collectOfferOptions([
      { id: moduleId, content_blocks: blocks },
    ])

    expect(options).toHaveLength(2)
    expect(options.map((option) => option.optionId).sort()).toEqual([
      'opt-a',
      'opt-b',
    ])
  })
})

describe('validateOptionSelection', () => {
  it('keeps only one selection for radio groups', () => {
    const options = collectOfferOptions([
      {
        id: 'module-1',
        content_blocks: [
          optionsBlock('block-1', 'module-1', [
            {
              id: 'group-1',
              mode: 'single',
              options: [
                { id: 'opt-a', label: 'A', price: 100 },
                { id: 'opt-b', label: 'B', price: 200 },
              ],
            },
          ]),
        ],
      },
    ])

    const validated = validateOptionSelection(['opt-a', 'opt-b'], options)
    expect([...validated]).toEqual(['opt-b'])
  })

  it('allows multiple checkbox selections', () => {
    const options = collectOfferOptions([
      {
        id: 'module-1',
        content_blocks: [
          optionsBlock('block-1', 'module-1', [
            {
              id: 'group-1',
              mode: 'multiple',
              options: [
                { id: 'opt-a', label: 'A', price: 100 },
                { id: 'opt-b', label: 'B', price: 200 },
              ],
            },
          ]),
        ],
      },
    ])

    const validated = validateOptionSelection(['opt-a', 'opt-b'], options)
    expect([...validated].sort()).toEqual(['opt-a', 'opt-b'])
  })
})

describe('calculateOptionsSubtotal', () => {
  it('sums selected option prices', () => {
    const options = collectOfferOptions([
      {
        id: 'module-1',
        content_blocks: [
          optionsBlock('block-1', 'module-1', [
            {
              id: 'group-1',
              mode: 'multiple',
              options: [
                { id: 'opt-a', label: 'A', price: 1000 },
                { id: 'opt-b', label: 'B', price: 2500 },
              ],
            },
          ]),
        ],
      },
    ])

    expect(calculateOptionsSubtotal(['opt-a', 'opt-b'], options)).toBe(3500)
    expect(calculateOptionsSubtotal(['opt-a'], options)).toBe(1000)
  })
})

describe('resolveDefaultSelectedOptionIds', () => {
  it('respects default flags per group mode', () => {
    const options = collectOfferOptions([
      {
        id: 'module-1',
        content_blocks: [
          optionsBlock('block-1', 'module-1', [
            {
              id: 'group-1',
              mode: 'multiple',
              options: [
                { id: 'opt-a', label: 'A', price: 100, defaultSelected: true },
                { id: 'opt-b', label: 'B', price: 200 },
              ],
            },
            {
              id: 'group-2',
              mode: 'single',
              options: [
                { id: 'opt-c', label: 'C', price: 300, defaultSelected: true },
                { id: 'opt-d', label: 'D', price: 400, defaultSelected: true },
              ],
            },
          ]),
        ],
      },
    ])

    expect([...resolveDefaultSelectedOptionIds(options)].sort()).toEqual([
      'opt-a',
      'opt-d',
    ])
  })
})

describe('applyOptionsToOfferTotals', () => {
  it('applies discount and VAT to combined subtotal', () => {
    const totals = applyOptionsToOfferTotals(10000, 2000, 25, 10)
    expect(totals.totalBeforeDiscount).toBe(12000)
    expect(totals.discountAmount).toBe(1200)
    expect(totals.totalAfterDiscount).toBe(10800)
    expect(totals.totalWithVat).toBe(13500)
  })
})

describe('getSelectedOptionEntries', () => {
  it('returns selected option metadata', () => {
    const options = collectOfferOptions([
      {
        id: 'module-1',
        content_blocks: [
          optionsBlock('block-1', 'module-1', [
            {
              id: 'group-1',
              mode: 'multiple',
              options: [{ id: 'opt-a', label: 'Lighting', price: 5000 }],
            },
          ]),
        ],
      },
    ])

    const entries = getSelectedOptionEntries(['opt-a'], options)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.label).toBe('Lighting')
    expect(entries[0]?.price).toBe(5000)
  })
})
