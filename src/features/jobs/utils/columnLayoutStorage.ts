import type {
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
} from '../types'

export type ColumnLayoutColumn = {
  id: string
  blocks: Array<PrettyOfferModuleBlock>
}

export function getColumnCount(
  block: Pick<PrettyOfferModuleBlock, 'caption'>,
): number {
  const parsed = Number.parseInt(block.caption ?? '2', 10)
  if (parsed >= 2 && parsed <= 4) return parsed
  return 2
}

export function parseColumnLayoutColumns(
  items: Array<PrettyOfferModuleBlockItem> = [],
): Array<ColumnLayoutColumn> {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      let blocks: Array<PrettyOfferModuleBlock> = []
      if (item.detail) {
        try {
          const parsed = JSON.parse(item.detail) as {
            blocks?: Array<PrettyOfferModuleBlock>
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

function createColumnId(): string {
  return `temp-column-${crypto.randomUUID()}`
}

export function createEmptyColumnLayoutColumns(
  columnCount: number,
): Array<ColumnLayoutColumn> {
  return Array.from({ length: columnCount }, () => ({
    id: createColumnId(),
    blocks: [],
  }))
}

export function resizeColumnLayoutColumns(
  current: Array<ColumnLayoutColumn>,
  columnCount: number,
): Array<ColumnLayoutColumn> {
  if (current.length === columnCount) return current
  if (current.length < columnCount) {
    const extra = createEmptyColumnLayoutColumns(columnCount - current.length)
    return [...current, ...extra]
  }
  return current.slice(0, columnCount)
}
