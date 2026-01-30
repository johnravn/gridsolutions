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
import type { ActivityType } from '../types'

const activityTypeLabels: Record<ActivityType, string> = {
  inventory_item_created: 'Inventory Items',
  inventory_item_deleted: 'Inventory Items',
  inventory_group_created: 'Inventory Groups',
  inventory_group_deleted: 'Inventory Groups',
  vehicle_added: 'Vehicles',
  vehicle_removed: 'Vehicles',
  customer_added: 'Customers',
  customer_removed: 'Customers',
  crew_added: 'Crew',
  crew_removed: 'Crew',
  job_created: 'Jobs',
  job_status_changed: 'Jobs',
  job_deleted: 'Jobs',
  announcement: 'Announcements',
}

const categoryGroups: Record<string, Array<ActivityType>> = {
  All: [],
  Inventory: [
    'inventory_item_created',
    'inventory_item_deleted',
    'inventory_group_created',
    'inventory_group_deleted',
  ],
  Vehicles: ['vehicle_added', 'vehicle_removed'],
  Customers: ['customer_added', 'customer_removed'],
  Crew: ['crew_added', 'crew_removed'],
  Jobs: ['job_created', 'job_status_changed', 'job_deleted'],
  Announcements: ['announcement'],
}

export default function ActivityFilter({
  selectedTypes,
  onTypesChange,
}: {
  selectedTypes: Array<ActivityType>
  onTypesChange: (types: Array<ActivityType>) => void
}) {
  const [open, setOpen] = React.useState(false)

  const toggleType = (type: ActivityType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type))
    } else {
      onTypesChange([...selectedTypes, type])
    }
  }

  const selectCategory = (category: string) => {
    if (category === 'All') {
      onTypesChange([])
    } else {
      const types = categoryGroups[category] || []
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
          <IconButton variant="soft" size="2">
            <Filter width={16} height={16} />
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
                fontSize: '10px',
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
        {Object.keys(categoryGroups).map((category) => {
          const types = categoryGroups[category]
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
          Object.entries(activityTypeLabels).reduce(
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
