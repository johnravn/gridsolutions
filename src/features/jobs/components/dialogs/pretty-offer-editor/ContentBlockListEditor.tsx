import * as React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight, Plus, Trash } from 'iconoir-react'
import {
  countOptionGroupsInBlock,
  countOptionsInBlock,
} from '../../../utils/optionsBlockStorage'
import { SortableContentBlock } from './sortable'
import { ColumnLayoutBlockEditor } from './ColumnLayoutBlockEditor'
import { OptionsBlockEditor } from './OptionsBlockEditor'
import { getColumnCount, parseColumnLayoutColumns } from './columnLayoutStorage'
import {
  BLOCK_TYPE_LABELS,
  COLUMN_LAYOUT_BLOCK_TYPES,
  FILE_UPLOAD_BLOCK_TYPES,
  GALLERY_BLOCK_TYPES,
  LIST_BLOCK_TYPES,
  MEDIA_BLOCK_TYPES,
  OPTIONS_BLOCK_TYPES,
  TEXT_BLOCK_TYPES,
  TOP_LEVEL_ADDABLE_BLOCK_TYPES,
  VIDEO_BLOCK_TYPES,
  createEmptyBlockItem,
  createEmptyContentBlock,
} from './types'
import { GalleryBlockEditor } from './GalleryBlockEditor'
import { FileUploadBlockEditor } from './FileUploadBlockEditor'
import { VideoBlockEditor } from './VideoBlockEditor'
import type { PrettyModuleBlockType } from '../../../types'
import type { LocalBlockItem, LocalContentBlock } from './types'

function getBlockSummary(block: LocalContentBlock): string | null {
  if (TEXT_BLOCK_TYPES.has(block.block_type)) {
    const text = block.text_content?.trim()
    return text ? text.slice(0, 80) + (text.length > 80 ? '…' : '') : null
  }

  if (block.block_type === 'simple_list') {
    const title = block.text_content?.trim()
    const count = block.items.length
    if (title && count > 0) return `${title} · ${count} items`
    if (title) return title
    if (count > 0) return `${count} item${count === 1 ? '' : 's'}`
    return null
  }

  if (block.block_type === 'interactive_list') {
    const title = block.text_content?.trim()
    const count = block.items.length
    if (title && count > 0) return `${title} · ${count} items`
    if (title) return title
    if (count > 0) return `${count} item${count === 1 ? '' : 's'}`
    return null
  }

  if (block.block_type === 'gallery') {
    const title = block.text_content?.trim()
    const count = block.items.filter((item) => item.url).length
    if (title && count > 0) return `${title} · ${count} images`
    if (title) return title
    if (count > 0) return `${count} image${count === 1 ? '' : 's'}`
    return null
  }

  if (block.block_type === 'file_upload') {
    const title = block.text_content?.trim()
    const count = block.items.filter((item) => item.url).length
    if (title && count > 0) return `${title} · ${count} files`
    if (title) return title
    if (count > 0) return `${count} file${count === 1 ? '' : 's'}`
    return null
  }

  if (block.block_type === 'column_layout') {
    const header = block.text_content?.trim()
    const count = getColumnCount(block)
    const nestedCount = parseColumnLayoutColumns(block.items).reduce(
      (sum, column) => sum + column.blocks.length,
      0,
    )
    const layoutLabel = `${count} columns · ${nestedCount} block${nestedCount === 1 ? '' : 's'}`
    return header ? `${header} · ${layoutLabel}` : layoutLabel
  }

  if (block.block_type === 'options') {
    const header = block.text_content?.trim()
    const groupCount = countOptionGroupsInBlock(block)
    const optionCount = countOptionsInBlock(block)
    const optionsLabel = `${groupCount} group${groupCount === 1 ? '' : 's'} · ${optionCount} option${optionCount === 1 ? '' : 's'}`
    return header ? `${header} · ${optionsLabel}` : optionsLabel
  }

  if (MEDIA_BLOCK_TYPES.has(block.block_type)) {
    return block.link_title?.trim() || block.url?.trim() || null
  }

  return null
}

type Props = {
  moduleId: string
  jobId: string
  companyId: string
  offerId: string
  blocks: Array<LocalContentBlock>
  readOnly: boolean
  onChange: (blocks: Array<LocalContentBlock>) => void
  addableBlockTypes?: Array<PrettyModuleBlockType>
  emptyMessage?: string
  showAddControl?: boolean
  showTitle?: boolean
  title?: string
}

export function ContentBlockListEditor({
  moduleId,
  jobId,
  companyId,
  offerId,
  blocks,
  readOnly,
  onChange,
  addableBlockTypes = TOP_LEVEL_ADDABLE_BLOCK_TYPES,
  emptyMessage = 'Add subtitle, description, lists, image galleries, videos, links, file uploads, or column layouts.',
  showAddControl = true,
  showTitle = false,
  title = 'Content blocks',
}: Props) {
  const [collapsedBlockIds, setCollapsedBlockIds] = React.useState<Set<string>>(
    () => new Set(),
  )

  const toggleBlockCollapsed = (blockId: string) => {
    setCollapsedBlockIds((current) => {
      const next = new Set(current)
      if (next.has(blockId)) {
        next.delete(blockId)
      } else {
        next.add(blockId)
      }
      return next
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)

  const updateBlocks = (next: Array<LocalContentBlock>) => {
    onChange(
      next.map((block, index) => ({
        ...block,
        sort_order: index,
      })),
    )
  }

  const addBlock = (blockType: PrettyModuleBlockType) => {
    const newBlock = createEmptyContentBlock(moduleId, sorted.length, blockType)
    updateBlocks([...sorted, newBlock])
    setCollapsedBlockIds((current) => {
      const next = new Set(current)
      next.delete(newBlock.id)
      return next
    })
  }

  const removeBlock = (blockId: string) => {
    updateBlocks(sorted.filter((block) => block.id !== blockId))
  }

  const updateBlock = (blockId: string, patch: Partial<LocalContentBlock>) => {
    updateBlocks(
      sorted.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block,
      ),
    )
  }

  const updateBlockItem = (
    blockId: string,
    itemId: string,
    patch: Partial<LocalBlockItem>,
  ) => {
    updateBlocks(
      sorted.map((block) => {
        if (block.id !== blockId) return block
        return {
          ...block,
          items: block.items.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item,
          ),
        }
      }),
    )
  }

  const addBlockItem = (blockId: string) => {
    updateBlocks(
      sorted.map((block) => {
        if (block.id !== blockId) return block
        return {
          ...block,
          items: [
            ...block.items,
            createEmptyBlockItem(blockId, block.items.length),
          ],
        }
      }),
    )
  }

  const removeBlockItem = (blockId: string, itemId: string) => {
    updateBlocks(
      sorted.map((block) => {
        if (block.id !== blockId) return block
        return {
          ...block,
          items: block.items.filter((item) => item.id !== itemId),
        }
      }),
    )
  }

  return (
    <Box>
      {(showTitle || (showAddControl && !readOnly)) && (
        <Flex justify="between" align="center" mb="2">
          {showTitle ? (
            <Text size="2" weight="medium">
              {title}
            </Text>
          ) : (
            <Box />
          )}
          {showAddControl && !readOnly && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button size="1" variant="soft">
                  <Plus width={14} height={14} />
                  Add block
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content style={{ zIndex: 10000 }}>
                {addableBlockTypes.map((blockType) => (
                  <DropdownMenu.Item
                    key={blockType}
                    onSelect={() => addBlock(blockType)}
                  >
                    {BLOCK_TYPE_LABELS[blockType]}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>
      )}

      {sorted.length === 0 ? (
        <Text size="2" color="gray">
          {emptyMessage}
        </Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return
            const oldIndex = sorted.findIndex((b) => b.id === active.id)
            const newIndex = sorted.findIndex((b) => b.id === over.id)
            if (oldIndex < 0 || newIndex < 0) return
            updateBlocks(arrayMove(sorted, oldIndex, newIndex))
          }}
        >
          <SortableContext
            items={sorted.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <Flex direction="column" gap="2">
              {sorted.map((block) => {
                const isCollapsed = collapsedBlockIds.has(block.id)
                const summary = getBlockSummary(block)

                return (
                  <SortableContentBlock
                    key={block.id}
                    id={block.id}
                    disabled={readOnly}
                  >
                    {({ handle }) => (
                      <Box
                        p="3"
                        style={{
                          border: '1px solid var(--gray-a5)',
                          borderRadius: 8,
                        }}
                      >
                        <Flex justify="between" align="center" gap="2">
                          <Flex
                            align="center"
                            gap="2"
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            {handle}
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="gray"
                              aria-label={
                                isCollapsed ? 'Expand block' : 'Collapse block'
                              }
                              onClick={() => toggleBlockCollapsed(block.id)}
                            >
                              {isCollapsed ? (
                                <NavArrowRight width={14} height={14} />
                              ) : (
                                <NavArrowDown width={14} height={14} />
                              )}
                            </IconButton>
                            <Badge>{BLOCK_TYPE_LABELS[block.block_type]}</Badge>
                            {isCollapsed && summary && (
                              <Text size="2" color="gray" truncate>
                                {summary}
                              </Text>
                            )}
                          </Flex>
                          {!readOnly && (
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="red"
                              onClick={() => removeBlock(block.id)}
                            >
                              <Trash width={14} height={14} />
                            </IconButton>
                          )}
                        </Flex>

                        {!isCollapsed && (
                          <Box mt="2">
                            {COLUMN_LAYOUT_BLOCK_TYPES.has(
                              block.block_type,
                            ) && (
                              <ColumnLayoutBlockEditor
                                block={block}
                                moduleId={moduleId}
                                jobId={jobId}
                                companyId={companyId}
                                offerId={offerId}
                                readOnly={readOnly}
                                onChange={(updates) =>
                                  updateBlock(block.id, updates)
                                }
                              />
                            )}

                            {OPTIONS_BLOCK_TYPES.has(block.block_type) && (
                              <OptionsBlockEditor
                                block={block}
                                moduleId={moduleId}
                                jobId={jobId}
                                companyId={companyId}
                                offerId={offerId}
                                readOnly={readOnly}
                                onChange={(updates) =>
                                  updateBlock(block.id, updates)
                                }
                              />
                            )}

                            {TEXT_BLOCK_TYPES.has(block.block_type) && (
                              <TextArea
                                value={block.text_content ?? ''}
                                disabled={readOnly}
                                rows={block.block_type === 'subtitle' ? 2 : 4}
                                placeholder={
                                  block.block_type === 'subtitle'
                                    ? 'Subtitle text'
                                    : 'Description text'
                                }
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    text_content: e.target.value || null,
                                  })
                                }
                              />
                            )}

                            {LIST_BLOCK_TYPES.has(block.block_type) && (
                              <Flex direction="column" gap="2">
                                <TextField.Root
                                  value={block.text_content ?? ''}
                                  disabled={readOnly}
                                  placeholder="List title (optional)"
                                  onChange={(e) =>
                                    updateBlock(block.id, {
                                      text_content: e.target.value || null,
                                    })
                                  }
                                />
                                {block.items.map((item) => (
                                  <Box
                                    key={item.id}
                                    p="2"
                                    style={{
                                      background: 'var(--gray-a2)',
                                      borderRadius: 6,
                                    }}
                                  >
                                    <Flex gap="2" align="start">
                                      <Flex
                                        direction="column"
                                        gap="2"
                                        style={{ flex: 1 }}
                                      >
                                        <TextField.Root
                                          value={item.label}
                                          disabled={readOnly}
                                          placeholder="Label"
                                          onChange={(e) =>
                                            updateBlockItem(block.id, item.id, {
                                              label: e.target.value,
                                            })
                                          }
                                        />
                                        {block.block_type === 'simple_list' ? (
                                          <TextField.Root
                                            value={item.summary ?? ''}
                                            disabled={readOnly}
                                            placeholder="Summary (optional)"
                                            onChange={(e) =>
                                              updateBlockItem(
                                                block.id,
                                                item.id,
                                                {
                                                  summary:
                                                    e.target.value || null,
                                                },
                                              )
                                            }
                                          />
                                        ) : (
                                          <TextArea
                                            value={item.detail ?? ''}
                                            disabled={readOnly}
                                            rows={2}
                                            placeholder="Detail (shown on hover or tap)"
                                            onChange={(e) =>
                                              updateBlockItem(
                                                block.id,
                                                item.id,
                                                {
                                                  detail:
                                                    e.target.value || null,
                                                },
                                              )
                                            }
                                          />
                                        )}
                                      </Flex>
                                      {!readOnly && block.items.length > 1 && (
                                        <IconButton
                                          size="1"
                                          variant="ghost"
                                          color="red"
                                          onClick={() =>
                                            removeBlockItem(block.id, item.id)
                                          }
                                        >
                                          <Trash width={14} height={14} />
                                        </IconButton>
                                      )}
                                    </Flex>
                                  </Box>
                                ))}
                                {!readOnly && (
                                  <Button
                                    size="1"
                                    variant="soft"
                                    onClick={() => addBlockItem(block.id)}
                                  >
                                    <Plus width={14} height={14} />
                                    Add item
                                  </Button>
                                )}
                              </Flex>
                            )}

                            {GALLERY_BLOCK_TYPES.has(block.block_type) && (
                              <GalleryBlockEditor
                                block={block}
                                companyId={companyId}
                                offerId={offerId}
                                readOnly={readOnly}
                                onChange={(updates) =>
                                  updateBlock(block.id, updates)
                                }
                              />
                            )}

                            {FILE_UPLOAD_BLOCK_TYPES.has(block.block_type) && (
                              <FileUploadBlockEditor
                                block={block}
                                companyId={companyId}
                                offerId={offerId}
                                readOnly={readOnly}
                                onChange={(updates) =>
                                  updateBlock(block.id, updates)
                                }
                              />
                            )}

                            {VIDEO_BLOCK_TYPES.has(block.block_type) && (
                              <VideoBlockEditor
                                block={block}
                                companyId={companyId}
                                offerId={offerId}
                                readOnly={readOnly}
                                onChange={(updates) =>
                                  updateBlock(block.id, updates)
                                }
                              />
                            )}

                            {MEDIA_BLOCK_TYPES.has(block.block_type) &&
                              block.block_type === 'link' && (
                                <Flex direction="column" gap="2">
                                  <TextField.Root
                                    value={block.url ?? ''}
                                    disabled={readOnly}
                                    placeholder="https://..."
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        url: e.target.value || null,
                                      })
                                    }
                                  />
                                  <TextField.Root
                                    value={block.link_title ?? ''}
                                    disabled={readOnly}
                                    placeholder="Button / link title"
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        link_title: e.target.value || null,
                                      })
                                    }
                                  />
                                  <TextField.Root
                                    value={block.caption ?? ''}
                                    disabled={readOnly}
                                    placeholder="Caption (optional)"
                                    onChange={(e) =>
                                      updateBlock(block.id, {
                                        caption: e.target.value || null,
                                      })
                                    }
                                  />
                                </Flex>
                              )}
                          </Box>
                        )}
                      </Box>
                    )}
                  </SortableContentBlock>
                )
              })}
            </Flex>
          </SortableContext>
        </DndContext>
      )}
    </Box>
  )
}
