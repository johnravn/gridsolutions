// src/features/jobs/components/tabs/MoneyItemsFilter.tsx
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

type Props = {
  showIncome: boolean
  showExpenses: boolean
  onShowIncomeChange: (v: boolean) => void
  onShowExpensesChange: (v: boolean) => void
}

export default function MoneyItemsFilter({
  showIncome,
  showExpenses,
  onShowIncomeChange,
  onShowExpensesChange,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const hiddenCount = (showIncome ? 0 : 1) + (showExpenses ? 0 : 1)
  const activeFiltersCount = hiddenCount

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
        <DropdownMenu.Label>Type</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowIncomeChange(!showIncome)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showIncome} />
            <Text>Income</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowExpensesChange(!showExpenses)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showExpenses} />
            <Text>Expenses</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
