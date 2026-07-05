import { createTempId } from './types'
import type { LocalBlockItem, LocalContentBlock } from './types'

export type ColumnLayoutColumn = {
  id: string
  blocks: Array<LocalContentBlock>
}

export function getColumnCount(
  block: Pick<LocalContentBlock, 'caption'>,
): number {
  const parsed = Number.parseInt(block.caption ?? '2', 10)
  if (parsed >= 2 && parsed <= 4) return parsed
  return 2
}

export function parseColumnLayoutColumns(
  items: Array<LocalBlockItem>,
): Array<ColumnLayoutColumn> {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      let blocks: Array<LocalContentBlock> = []
      if (item.detail) {
        try {
          const parsed = JSON.parse(item.detail) as {
            blocks?: Array<LocalContentBlock>
          }
          blocks = (parsed.blocks ?? []).map((nestedBlock) => ({
            ...nestedBlock,
            items: nestedBlock.items ?? [],
          }))
        } catch {
          blocks = []
        }
      }
      return { id: item.id, blocks }
    })
}

export function serializeColumnLayoutColumns(
  blockId: string,
  columns: Array<ColumnLayoutColumn>,
): Array<LocalBlockItem> {
  return columns.map((column, index) => ({
    id: column.id,
    block_id: blockId,
    sort_order: index,
    label: '',
    summary: null,
    detail: JSON.stringify({ blocks: column.blocks }),
  }))
}

export function createEmptyColumnLayoutColumns(
  columnCount: number,
): Array<ColumnLayoutColumn> {
  return Array.from({ length: columnCount }, () => ({
    id: createTempId('column'),
    blocks: [],
  }))
}

export function resizeColumnLayoutColumns(
  current: Array<ColumnLayoutColumn>,
  columnCount: number,
): Array<ColumnLayoutColumn> {
  if (current.length === columnCount) return current
  if (current.length < columnCount) {
    return [
      ...current,
      ...createEmptyColumnLayoutColumns(columnCount - current.length),
    ]
  }
  return current.slice(0, columnCount)
}

export function createColumnLayoutItems(
  blockId: string,
  columnCount: number,
): Array<LocalBlockItem> {
  return serializeColumnLayoutColumns(
    blockId,
    createEmptyColumnLayoutColumns(columnCount),
  )
}
