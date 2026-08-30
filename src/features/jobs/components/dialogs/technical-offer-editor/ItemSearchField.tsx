import * as React from 'react'
import { Badge, Flex, Text } from '@radix-ui/themes'
import {
  HighlightedText,
  SearchableSelect,
  type SearchableSelectOption,
} from '@shared/ui/components/SearchableSelect'

export type ItemSearchResult = {
  id: string
  name: string
  is_group: boolean
  on_hand: number | null
  price: number | null
  item_kind: 'stock' | 'subrental'
  brand_name: string | null
  model: string | null
  nicknames?: string | null
  category_name?: string | null
}

function itemDescription(item: ItemSearchResult) {
  return item.is_group
    ? `Group | Qty: ${item.on_hand ?? 'N/A'}`
    : `Brand: ${item.brand_name ?? 'N/A'} | Model: ${
        item.model ?? 'N/A'
      } | Qty: ${item.on_hand ?? 'N/A'}`
}

export function ItemSearchField({
  onSearchChange,
  searchResults,
  onSelectItem,
  formatCurrency,
  compact,
  loading,
}: {
  onSearchChange: (term: string) => void
  searchResults: Array<ItemSearchResult>
  onSelectItem: (itemId: string) => void
  formatCurrency: (amount: number) => string
  compact?: boolean
  loading?: boolean
}) {
  const resultsById = React.useMemo(
    () => new Map(searchResults.map((item) => [item.id, item])),
    [searchResults],
  )

  const options = React.useMemo<Array<SearchableSelectOption>>(
    () =>
      searchResults.map((item) => ({
        value: item.id,
        label: item.name,
        description: itemDescription(item),
        keywords: [
          item.nicknames,
          item.category_name,
          item.brand_name,
          item.model,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [searchResults],
  )

  return (
    <SearchableSelect
      options={options}
      value=""
      onValueChange={onSelectItem}
      onInputChange={onSearchChange}
      clearOnSelect
      filterLocally
      loading={loading}
      placeholder="Search items or groups to add..."
      emptyMessage="No matching items"
      dropdownMatchTriggerWidth
      dropdownMaxHeight={400}
      style={{
        width: '100%',
        maxWidth: 'none',
        marginBottom: compact ? undefined : 12,
      }}
      renderOption={(option, { query }) => {
        const item = resultsById.get(option.value)
        if (!item) return option.label
        return (
          <Flex justify="between" align="center" gap="2">
            <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
              <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                <Text style={{ flex: 1, minWidth: 0 }}>
                  <HighlightedText text={item.name} query={query} />
                </Text>
                {item.item_kind === 'stock' ? (
                  <Badge size="1" variant="soft" color="indigo">
                    Stock
                  </Badge>
                ) : (
                  <Badge size="1" variant="soft" color="amber">
                    Subrental
                  </Badge>
                )}
              </Flex>
              <Text size="1" color="gray">
                <HighlightedText
                  text={option.description ?? ''}
                  query={query}
                />
              </Text>
            </Flex>
            {item.price !== null && (
              <Text size="2" color="gray" style={{ flexShrink: 0 }}>
                {formatCurrency(item.price)}
              </Text>
            )}
          </Flex>
        )
      }}
    />
  )
}
