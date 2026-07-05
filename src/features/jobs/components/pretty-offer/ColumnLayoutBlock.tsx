import { Box, Grid, Text } from '@radix-ui/themes'
import {
  getColumnCount,
  parseColumnLayoutColumns,
} from '../../utils/columnLayoutStorage'
import { PrettyOfferBlockRenderer } from './PrettyOfferBlockRenderer'
import type { PrettyOfferModuleBlock } from '../../types'

export function ColumnLayoutBlock({
  block,
  startIndex = 0,
}: {
  block: PrettyOfferModuleBlock
  startIndex?: number
}) {
  const columnCount = getColumnCount(block)
  const columns = parseColumnLayoutColumns(block.items ?? [])
  const hasContent = columns.some((column) => column.blocks.length > 0)

  if (!block.text_content && !hasContent) return null

  let nestedIndex = startIndex

  return (
    <Box mb="4">
      {block.text_content && (
        <Text size="4" weight="medium" mb="3" as="div">
          {block.text_content}
        </Text>
      )}

      <Grid
        columns={{
          initial: '1',
          sm: String(Math.min(columnCount, 2)),
          md: String(columnCount),
        }}
        gap="4"
      >
        {columns.map((column) => {
          const columnBlocks = [...column.blocks].sort(
            (a, b) => a.sort_order - b.sort_order,
          )

          return (
            <Box key={column.id} style={{ minWidth: 0 }}>
              {columnBlocks.map((nestedBlock) => {
                const rendered = (
                  <PrettyOfferBlockRenderer
                    key={nestedBlock.id}
                    block={nestedBlock}
                    index={nestedIndex}
                  />
                )
                nestedIndex += 1
                return rendered
              })}
            </Box>
          )
        })}
      </Grid>
    </Box>
  )
}
