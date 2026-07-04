import * as React from 'react'
import { Badge, Box, Flex, Text, TextField } from '@radix-ui/themes'

export type ItemSearchResult = {
  id: string
  name: string
  is_group: boolean
  on_hand: number | null
  price: number | null
  item_kind: 'stock' | 'subrental'
  brand_name: string | null
  model: string | null
}

export function ItemSearchField({
  searchTerm,
  onSearchChange,
  searchResults,
  onSelectItem,
  formatCurrency,
  compact,
}: {
  searchTerm: string
  onSearchChange: (term: string) => void
  searchResults: Array<ItemSearchResult>
  onSelectItem: (itemId: string) => void
  formatCurrency: (amount: number) => string
  compact?: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  // Update dropdown position when search term or results change
  React.useEffect(() => {
    if (!searchTerm || searchResults.length === 0) {
      setDropdownPosition(null)
      return
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const updatePosition = () => {
      if (containerRef.current) {
        const input = containerRef.current.querySelector('input')
        if (input) {
          const rect = input.getBoundingClientRect()
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
          })
        }
      }
    }

    // Try immediately, then with a small delay to ensure layout is ready
    updatePosition()
    const timer = setTimeout(updatePosition, 10)

    return () => clearTimeout(timer)
  }, [searchTerm, searchResults.length])

  return (
    <Box
      ref={containerRef}
      style={{ position: 'relative' }}
      mb={compact ? undefined : '3'}
    >
      <TextField.Root
        placeholder="Search items or groups to add..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {dropdownPosition && searchResults.length > 0 && (
        <Box
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 10000,
            backgroundColor: 'var(--color-panel-solid)',
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            maxHeight: 'min(400px, 50vh)',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {searchResults.map((item) => (
            <Box
              key={item.id}
              p="2"
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-4)',
                backgroundColor: 'transparent',
              }}
              onClick={() => onSelectItem(item.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Flex justify="between" align="center" gap="2">
                <Flex
                  direction="column"
                  gap="1"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                    <Text style={{ flex: 1, minWidth: 0 }}>{item.name}</Text>
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
                    {item.is_group
                      ? `Group | Qty: ${item.on_hand ?? 'N/A'}`
                      : `Brand: ${item.brand_name ?? 'N/A'} | Model: ${
                          item.model ?? 'N/A'
                        } | Qty: ${item.on_hand ?? 'N/A'}`}
                  </Text>
                </Flex>
                {item.price !== null && (
                  <Text size="2" color="gray" style={{ flexShrink: 0 }}>
                    {formatCurrency(item.price)}
                  </Text>
                )}
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
