import * as React from 'react'
import { Box, Checkbox, Flex, RadioGroup, Text } from '@radix-ui/themes'
import { formatPublicOfferCurrency } from '../../hooks/usePublicOfferResponse'
import { parseOptionsGroups } from '../../utils/optionsBlockStorage'
import { PrettyOfferBlockRenderer } from './PrettyOfferBlockRenderer'
import { usePrettyOfferOptions } from './PrettyOfferOptionsContext'
import type { OptionEntry } from '../../utils/optionsBlockStorage'
import type { PrettyOfferModuleBlock } from '../../types'

type Props = {
  block: PrettyOfferModuleBlock
  index: number
}

function OptionContent({
  option,
  selected,
}: {
  option: OptionEntry
  selected: boolean
}) {
  if (!selected || option.blocks.length === 0) return null

  return (
    <Box mt="3" pl="4" className="pretty-deck-option-content">
      {option.blocks.map((nestedBlock, nestedIndex) => (
        <PrettyOfferBlockRenderer
          key={nestedBlock.id}
          block={nestedBlock}
          index={nestedIndex}
        />
      ))}
    </Box>
  )
}

export function OptionsBlock({ block }: Props) {
  const optionsContext = usePrettyOfferOptions()
  const groups = React.useMemo(
    () => parseOptionsGroups(block.items),
    [block.items],
  )

  if (groups.length === 0) return null

  return (
    <Box className="pretty-deck-options-block" mb="4">
      {block.text_content?.trim() && (
        <Text size="4" weight="medium" mb="3" as="div">
          {block.text_content.trim()}
        </Text>
      )}

      <Flex direction="column" gap="4">
        {groups.map((group) => {
          const groupKey = `${block.id}:${group.id}`
          const groupLabel =
            group.title?.trim() ||
            (group.selectionMode === 'single'
              ? 'Choose one'
              : 'Optional add-ons')

          if (group.selectionMode === 'single') {
            const selectedId =
              group.options.find((option) =>
                optionsContext?.isOptionSelected(option.id),
              )?.id ?? ''

            return (
              <Box key={group.id} className="pretty-deck-options-group">
                <Text size="2" weight="medium" mb="2" as="div">
                  {groupLabel}
                </Text>
                <RadioGroup.Root
                  value={selectedId}
                  disabled={optionsContext?.isFrozen}
                  onValueChange={(value) =>
                    optionsContext?.selectRadioOption(groupKey, value)
                  }
                >
                  <Flex direction="column" gap="2">
                    {group.options.map((option) => (
                      <Box
                        key={option.id}
                        className={[
                          'pretty-deck-option-card',
                          selectedId === option.id
                            ? 'pretty-deck-option-card--selected'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <Text as="label" size="2">
                          <Flex align="center" justify="between" gap="3">
                            <Flex align="center" gap="2">
                              <RadioGroup.Item value={option.id} />
                              <Text weight="medium">
                                {option.label || 'Untitled option'}
                              </Text>
                            </Flex>
                            {option.price > 0 && (
                              <Text
                                size="2"
                                weight="bold"
                                className="pretty-deck-option-price"
                              >
                                +{formatPublicOfferCurrency(option.price)}
                              </Text>
                            )}
                          </Flex>
                        </Text>
                        <OptionContent
                          option={option}
                          selected={selectedId === option.id}
                        />
                      </Box>
                    ))}
                  </Flex>
                </RadioGroup.Root>
              </Box>
            )
          }

          return (
            <Box key={group.id} className="pretty-deck-options-group">
              <Text size="2" weight="medium" mb="2" as="div">
                {groupLabel}
              </Text>
              <Flex direction="column" gap="2">
                {group.options.map((option) => {
                  const selected =
                    optionsContext?.isOptionSelected(option.id) ?? false

                  return (
                    <Box
                      key={option.id}
                      className={[
                        'pretty-deck-option-card',
                        selected ? 'pretty-deck-option-card--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <Text as="label" size="2">
                        <Flex align="center" justify="between" gap="3">
                          <Flex align="center" gap="2">
                            <Checkbox
                              checked={selected}
                              disabled={optionsContext?.isFrozen}
                              onCheckedChange={() =>
                                optionsContext?.toggleOption(option.id)
                              }
                            />
                            <Text weight="medium">
                              {option.label || 'Untitled option'}
                            </Text>
                          </Flex>
                          {option.price > 0 && (
                            <Text
                              size="2"
                              weight="bold"
                              className="pretty-deck-option-price"
                            >
                              +{formatPublicOfferCurrency(option.price)}
                            </Text>
                          )}
                        </Flex>
                      </Text>
                      <OptionContent option={option} selected={selected} />
                    </Box>
                  )
                })}
              </Flex>
            </Box>
          )
        })}
      </Flex>
    </Box>
  )
}
