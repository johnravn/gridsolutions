import { describe, expect, it } from 'vitest'
import { arrayMove } from '@dnd-kit/sortable'
import type { LocalContentBlock } from '../dialogs/pretty-offer-editor/types'

describe('content block ordering', () => {
  const blocks: Array<LocalContentBlock> = [
    {
      id: 'a',
      module_id: 'm1',
      block_type: 'subtitle',
      sort_order: 0,
      text_content: 'A',
      url: null,
      link_title: null,
      caption: null,
      items: [],
    },
    {
      id: 'b',
      module_id: 'm1',
      block_type: 'description',
      sort_order: 1,
      text_content: 'B',
      url: null,
      link_title: null,
      caption: null,
      items: [],
    },
    {
      id: 'c',
      module_id: 'm1',
      block_type: 'simple_list',
      sort_order: 2,
      text_content: null,
      url: null,
      link_title: null,
      caption: null,
      items: [],
    },
  ]

  it('reorders blocks and normalizes sort_order', () => {
    const moved = arrayMove(blocks, 0, 2).map((block, index) => ({
      ...block,
      sort_order: index,
    }))
    expect(moved.map((b) => b.id)).toEqual(['b', 'c', 'a'])
    expect(moved.map((b) => b.sort_order)).toEqual([0, 1, 2])
  })
})
