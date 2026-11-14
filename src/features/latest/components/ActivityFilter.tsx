// src/features/latest/components/ActivityFilter.tsx
import * as React from 'react'
import {
  Box,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { Filter } from 'iconoir-react'
import {
  ACTIVITY_CATEGORY_GROUPS,
  ACTIVITY_TYPE_LABELS,
} from '../utils/activityCategories'
import type { ActivityType } from '../types'

export default function ActivityFilter({
  selectedTypes,
  onTypesChange,
}: {
  selectedTypes: Array<ActivityType>
  onTypesChange: (types: Array<ActivityType>) => void
}) {
  const [open, setOpen] = React.useState(false)

  const selectCategory = (category: string) => {
    if (category === 'All') {
      onTypesChange([])
    } else {
      const types = ACTIVITY_CATEGORY_GROUPS[category] || []
      // Toggle: if all types in category are selected, deselect them; otherwise select all
      const allSelected = types.every((t) => selectedTypes.includes(t))
      if (allSelected) {
        onTypesChange(selectedTypes.filter((t) => !types.includes(t)))
      } else {
        const newTypes = [...new Set([...selectedTypes, ...types])]
        onTypesChange(newTypes)
      }
    }
  }

  const activeFiltersCount = selectedTypes.length

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger>
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <IconButton
            className="split-header-icon-button"
            variant="ghost"
            size="3"
          >
            <Filter width={22} height={22} />
          </IconButton>
          {activeFiltersCount > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-9)',
                color: 'white',
                fontSize: 'var(--font-size-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeFiltersCount}
            </Box>
          )}
        </Box>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="end" style={{ minWidth: 200 }}>
        <DropdownMenu.Label>Filter by Category</DropdownMenu.Label>
        {Object.keys(ACTIVITY_CATEGORY_GROUPS).map((category) => {
          const types = ACTIVITY_CATEGORY_GROUPS[category]
          const isCategorySelected =
            category === 'All'
              ? selectedTypes.length === 0
              : types.length > 0 &&
                types.every((t) => selectedTypes.includes(t))

          return (
            <DropdownMenu.Item
              key={category}
              onClick={() => selectCategory(category)}
            >
              <Flex align="center" gap="2">
                <Checkbox checked={isCategorySelected} />
                <Text>{category}</Text>
              </Flex>
            </DropdownMenu.Item>
          )
        })}

        <DropdownMenu.Separator />

        <DropdownMenu.Label>Filter by Type</DropdownMenu.Label>
        {Object.entries(
          Object.entries(ACTIVITY_TYPE_LABELS).reduce(
            (acc, [type, label]) => {
              if (!acc[label]) {
                acc[label] = []
              }
              acc[label].push(type as ActivityType)
              return acc
            },
            {} as Record<string, Array<ActivityType>>,
          ),
        ).map(([label, types]) => {
          const isSelected = types.every((t) => selectedTypes.includes(t))
          return (
            <DropdownMenu.Item
              key={label}
              onClick={() => {
                // If all types are selected, deselect all; otherwise select all
                if (isSelected) {
                  onTypesChange(selectedTypes.filter((t) => !types.includes(t)))
                } else {
                  const newTypes = [...new Set([...selectedTypes, ...types])]
                  onTypesChange(newTypes)
                }
              }}
            >
              <Flex align="center" gap="2">
                <Checkbox checked={isSelected} />
                <Text>{label}</Text>
              </Flex>
            </DropdownMenu.Item>
          )
        })}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
