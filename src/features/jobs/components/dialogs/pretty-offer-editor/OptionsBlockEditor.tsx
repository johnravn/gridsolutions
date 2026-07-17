import * as React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Plus, Trash } from 'iconoir-react'
import {
  createEmptyOptionEntry,
  createEmptyOptionGroup,
  parseOptionsGroups,
  serializeOptionsGroups,
} from '../../../utils/optionsBlockStorage'
import { ContentBlockListEditor } from './ContentBlockListEditor'
import { NESTED_OPTION_CONTENT_BLOCK_TYPES } from './types'
import type {
  OptionEntry,
  OptionGroup,
  OptionSelectionMode,
} from '../../../utils/optionsBlockStorage'
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

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

export function OptionsBlockEditor({
  block,
  moduleId,
  jobId,
  companyId,
  offerId,
  readOnly,
  onChange,
}: Props) {
  const groups = React.useMemo(
    () => parseOptionsGroups(block.items),
    [block.items],
  )

  const syncGroups = (nextGroups: Array<OptionGroup>) => {
    onChange({
      items: serializeOptionsGroups(block.id, nextGroups),
    })
  }

  const updateGroup = (groupIndex: number, patch: Partial<OptionGroup>) => {
    syncGroups(
      groups.map((group, index) =>
        index === groupIndex ? { ...group, ...patch } : group,
      ),
    )
  }

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<OptionEntry>,
  ) => {
    syncGroups(
      groups.map((group, index) => {
        if (index !== groupIndex) return group
        return {
          ...group,
          options: group.options.map((option, optIndex) =>
            optIndex === optionIndex ? { ...option, ...patch } : option,
          ),
        }
      }),
    )
  }

  const addGroup = (selectionMode: OptionSelectionMode) => {
    syncGroups([...groups, createEmptyOptionGroup(selectionMode)])
  }

  const removeGroup = (groupIndex: number) => {
    syncGroups(groups.filter((_, index) => index !== groupIndex))
  }

  const addOption = (groupIndex: number) => {
    syncGroups(
      groups.map((group, index) =>
        index === groupIndex
          ? { ...group, options: [...group.options, createEmptyOptionEntry()] }
          : group,
      ),
    )
  }

  const removeOption = (groupIndex: number, optionIndex: number) => {
    syncGroups(
      groups.map((group, index) => {
        if (index !== groupIndex) return group
        const nextOptions = group.options.filter(
          (_, optIndex) => optIndex !== optionIndex,
        )
        return {
          ...group,
          options:
            nextOptions.length > 0 ? nextOptions : [createEmptyOptionEntry()],
        }
      }),
    )
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
          placeholder="Optional heading above the options"
          onChange={(e) => onChange({ text_content: e.target.value || null })}
        />
      </Box>

      {groups.map((group, groupIndex) => (
        <Box
          key={group.id}
          p="3"
          style={{
            border: '1px dashed var(--gray-a6)',
            borderRadius: 8,
            background: 'var(--gray-a1)',
          }}
        >
          <Flex justify="between" align="start" gap="2" mb="3" wrap="wrap">
            <Box style={{ flex: 1, minWidth: 180 }}>
              <Text size="1" color="gray" mb="1" as="div">
                Group title (optional)
              </Text>
              <TextField.Root
                value={group.title ?? ''}
                disabled={readOnly}
                placeholder={
                  group.selectionMode === 'single'
                    ? 'e.g. PA package'
                    : 'e.g. Optional upgrades'
                }
                onChange={(e) =>
                  updateGroup(groupIndex, {
                    title: e.target.value.trim() ? e.target.value : null,
                  })
                }
              />
            </Box>
            <Box style={{ minWidth: 160 }}>
              <Text size="1" color="gray" mb="1" as="div">
                Selection
              </Text>
              <Select.Root
                value={group.selectionMode}
                disabled={readOnly}
                onValueChange={(value) =>
                  updateGroup(groupIndex, {
                    selectionMode: value as OptionSelectionMode,
                  })
                }
              >
                <Select.Trigger />
                <Select.Content style={{ zIndex: 10001 }}>
                  <Select.Item value="multiple">Checkboxes</Select.Item>
                  <Select.Item value="single">Radio (choose one)</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
            {!readOnly && groups.length > 1 && (
              <IconButton
                size="1"
                variant="ghost"
                color="red"
                aria-label="Remove group"
                onClick={() => removeGroup(groupIndex)}
              >
                <Trash width={14} height={14} />
              </IconButton>
            )}
          </Flex>

          <Flex direction="column" gap="3">
            {group.options.map((option, optionIndex) => (
              <Box
                key={option.id}
                p="2"
                style={{
                  border: '1px solid var(--gray-a5)',
                  borderRadius: 8,
                  background: 'var(--color-panel-solid)',
                }}
              >
                <Flex
                  justify="between"
                  align="start"
                  gap="2"
                  mb="2"
                  wrap="wrap"
                >
                  <Box style={{ flex: 1, minWidth: 160 }}>
                    <Text size="1" color="gray" mb="1" as="div">
                      Option label
                    </Text>
                    <TextField.Root
                      value={option.label}
                      disabled={readOnly}
                      placeholder="Option name"
                      onChange={(e) =>
                        updateOption(groupIndex, optionIndex, {
                          label: e.target.value,
                        })
                      }
                    />
                  </Box>
                  <Box style={{ width: 140 }}>
                    <Text size="1" color="gray" mb="1" as="div">
                      Price (excl. VAT)
                    </Text>
                    <TextField.Root
                      type="number"
                      min="0"
                      step="1"
                      value={String(option.price)}
                      disabled={readOnly}
                      onChange={(e) => {
                        const parsed = Number.parseFloat(e.target.value)
                        updateOption(groupIndex, optionIndex, {
                          price: Number.isFinite(parsed) ? parsed : 0,
                        })
                      }}
                    />
                  </Box>
                  <Flex align="center" gap="2" pt="4">
                    <Checkbox
                      checked={option.default_selected === true}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        updateOption(groupIndex, optionIndex, {
                          default_selected: checked === true,
                        })
                      }
                    />
                    <Text size="1" color="gray">
                      Selected by default
                    </Text>
                  </Flex>
                  {!readOnly && group.options.length > 1 && (
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="red"
                      aria-label="Remove option"
                      onClick={() => removeOption(groupIndex, optionIndex)}
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>

                {option.price > 0 && (
                  <Text size="1" color="gray" mb="2" as="div">
                    Customer sees {formatMoney(option.price)}
                  </Text>
                )}

                <Text size="1" weight="medium" color="gray" mb="1" as="div">
                  Option content
                </Text>
                <ContentBlockListEditor
                  moduleId={moduleId}
                  jobId={jobId}
                  companyId={companyId}
                  offerId={offerId}
                  blocks={option.blocks as Array<LocalContentBlock>}
                  readOnly={readOnly}
                  addableBlockTypes={NESTED_OPTION_CONTENT_BLOCK_TYPES}
                  emptyMessage="Add content shown when this option is selected."
                  onChange={(blocks) =>
                    updateOption(groupIndex, optionIndex, { blocks })
                  }
                />
              </Box>
            ))}
          </Flex>

          {!readOnly && (
            <Button
              size="1"
              variant="soft"
              mt="2"
              onClick={() => addOption(groupIndex)}
            >
              <Plus width={14} height={14} />
              Add option
            </Button>
          )}
        </Box>
      ))}

      {!readOnly && (
        <Flex gap="2" wrap="wrap">
          <Button size="1" variant="soft" onClick={() => addGroup('multiple')}>
            <Plus width={14} height={14} />
            Add checkbox group
          </Button>
          <Button size="1" variant="soft" onClick={() => addGroup('single')}>
            <Plus width={14} height={14} />
            Add radio group
          </Button>
        </Flex>
      )}
    </Flex>
  )
}
