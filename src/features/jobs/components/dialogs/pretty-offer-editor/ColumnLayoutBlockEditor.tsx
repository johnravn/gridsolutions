import * as React from 'react'
import { Box, Flex, Select, Text, TextField } from '@radix-ui/themes'
import { ContentBlockListEditor } from './ContentBlockListEditor'
import {
  getColumnCount,
  parseColumnLayoutColumns,
  resizeColumnLayoutColumns,
  serializeColumnLayoutColumns,
} from './columnLayoutStorage'
import { NESTED_ADDABLE_BLOCK_TYPES } from './types'
import type { LocalContentBlock } from './types'

type Props = {
  block: LocalContentBlock
  moduleId: string
  jobId: string
  companyId: string
  offerId: string
  readOnly: boolean
  onChange: (patch: Partial<LocalContentBlock>) => void
}

export function ColumnLayoutBlockEditor({
  block,
  moduleId,
  jobId,
  companyId,
  offerId,
  readOnly,
  onChange,
}: Props) {
  const columnCount = getColumnCount(block)
  const columns = React.useMemo(() => {
    const parsed = parseColumnLayoutColumns(block.items)
    return resizeColumnLayoutColumns(parsed, columnCount)
  }, [block.items, columnCount])

  const syncColumns = (
    nextColumns: ReturnType<typeof parseColumnLayoutColumns>,
  ) => {
    onChange({
      items: serializeColumnLayoutColumns(block.id, nextColumns),
    })
  }

  const setColumnCount = (count: number) => {
    const nextColumns = resizeColumnLayoutColumns(columns, count).map(
      (column, index) => ({
        ...column,
        id: columns[index]?.id ?? column.id,
      }),
    )
    onChange({
      caption: String(count),
      items: serializeColumnLayoutColumns(block.id, nextColumns),
    })
  }

  return (
    <Flex direction="column" gap="3">
      <Box>
        <Text size="1" color="gray" mb="1" as="div">
          Section header (optional)
        </Text>
        <TextField.Root
          value={block.text_content ?? ''}
          disabled={readOnly}
          placeholder="Optional heading above the columns"
          onChange={(e) => onChange({ text_content: e.target.value || null })}
        />
      </Box>

      <Box style={{ maxWidth: 160 }}>
        <Text size="1" color="gray" mb="1" as="div">
          Columns
        </Text>
        <Select.Root
          value={String(columnCount)}
          disabled={readOnly}
          onValueChange={(value) => setColumnCount(Number(value))}
        >
          <Select.Trigger />
          <Select.Content style={{ zIndex: 10001 }}>
            <Select.Item value="2">2 columns</Select.Item>
            <Select.Item value="3">3 columns</Select.Item>
            <Select.Item value="4">4 columns</Select.Item>
          </Select.Content>
        </Select.Root>
      </Box>

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {columns.map((column, columnIndex) => (
          <Box
            key={column.id}
            p="2"
            style={{
              border: '1px dashed var(--gray-a6)',
              borderRadius: 8,
              background: 'var(--gray-a1)',
              minWidth: 0,
            }}
          >
            <Text size="1" weight="medium" color="gray" mb="2" as="div">
              Column {columnIndex + 1}
            </Text>
            <ContentBlockListEditor
              moduleId={moduleId}
              jobId={jobId}
              companyId={companyId}
              offerId={offerId}
              blocks={column.blocks}
              readOnly={readOnly}
              addableBlockTypes={NESTED_ADDABLE_BLOCK_TYPES}
              emptyMessage="Add blocks to this column."
              onChange={(blocks) => {
                const nextColumns = columns.map((entry, index) =>
                  index === columnIndex ? { ...entry, blocks } : entry,
                )
                syncColumns(nextColumns)
              }}
            />
          </Box>
        ))}
      </Box>
    </Flex>
  )
}
