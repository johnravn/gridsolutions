import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Text,
} from '@radix-ui/themes'
import { MoreVert } from 'iconoir-react'
import type {
  JobSubcontractorRow,
  SubrentalBookingRow,
} from '../../../api/subcontractorQueries'

export function countUnassignedSubrentalItems(
  items: Array<SubrentalBookingRow>,
): number {
  return items.filter((row) => !row.subcontractor_id).length
}

export function allSubrentalItemsUnassigned(
  items: Array<SubrentalBookingRow>,
): boolean {
  return items.length > 0 && items.every((row) => !row.subcontractor_id)
}

export function subrentalItemsForSubcontractor(
  items: Array<SubrentalBookingRow>,
  customerId: string,
): Array<SubrentalBookingRow> {
  return items.filter((row) => row.subcontractor_id === customerId)
}

export default function SubrentalItemsList({
  items,
  subcontractors,
  selectedItemIds,
  selectionEnabled,
  onToggleItem,
  onClearSelection,
  onAssignSingle,
  isReadOnly,
  isAssigning,
}: {
  items: Array<SubrentalBookingRow>
  subcontractors: Array<JobSubcontractorRow>
  selectedItemIds: Set<string>
  selectionEnabled: boolean
  onToggleItem: (id: string) => void
  onClearSelection: () => void
  onAssignSingle: (
    reservedItemId: string,
    subcontractorId: string | null,
  ) => void
  isReadOnly: boolean
  isAssigning: boolean
}) {
  const selectionActive = selectionEnabled && selectedItemIds.size > 0

  if (items.length === 0) {
    return (
      <Text size="2" color="gray">
        No subrental equipment booked on this job yet.
      </Text>
    )
  }

  return (
    <Flex direction="column" gap="2">
      {selectionActive && !isReadOnly && (
        <Flex align="center" justify="between" gap="2">
          <Text size="2" color="gray">
            {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''}{' '}
            selected — assign using the buttons on subcontractor cards above.
          </Text>
          <Button size="1" variant="soft" onClick={onClearSelection}>
            Clear selection
          </Button>
        </Flex>
      )}

      {items.map((row) => {
        const isSelected = selectedItemIds.has(row.id)
        const isUnassigned = !row.subcontractor_id

        return (
          <Card
            key={row.id}
            size="1"
            style={{
              opacity: isUnassigned ? 1 : 0.95,
              borderLeft: isUnassigned
                ? '3px solid var(--orange-9)'
                : undefined,
            }}
          >
            <Flex align="center" justify="between" gap="2" p="2" wrap="wrap">
              <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
                {!isReadOnly && selectionEnabled && isUnassigned && (
                  <Checkbox
                    checked={isSelected}
                    disabled={isAssigning}
                    onCheckedChange={() => onToggleItem(row.id)}
                  />
                )}
                <Box style={{ minWidth: 0 }}>
                  <Text weight="medium" style={{ display: 'block' }}>
                    {row.item_name}
                  </Text>
                  <Text size="1" color="gray">
                    {row.period_title ?? 'Equipment period'}
                    {row.subcontractor_name
                      ? ` · ${row.subcontractor_name}`
                      : ' · Unassigned'}
                  </Text>
                </Box>
              </Flex>

              <Flex align="center" gap="2">
                <Badge variant="soft" size="1" color="gray">
                  x{row.quantity}
                </Badge>
                <Badge variant="soft" size="1">
                  {row.external_status ?? 'planned'}
                </Badge>
                {!isReadOnly && subcontractors.length > 0 && (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button
                        size="1"
                        variant="ghost"
                        color="gray"
                        disabled={isAssigning}
                        aria-label="Assign item"
                      >
                        <MoreVert width={16} height={16} />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content style={{ zIndex: 10000 }}>
                      <DropdownMenu.Label>Assign to</DropdownMenu.Label>
                      {subcontractors.map((sub) => (
                        <DropdownMenu.Item
                          key={sub.id}
                          onSelect={() =>
                            onAssignSingle(row.id, sub.customer_id)
                          }
                        >
                          {sub.customer.name}
                        </DropdownMenu.Item>
                      ))}
                      {row.subcontractor_id && (
                        <>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            color="orange"
                            onSelect={() => onAssignSingle(row.id, null)}
                          >
                            Unassign
                          </DropdownMenu.Item>
                        </>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                )}
              </Flex>
            </Flex>
          </Card>
        )
      })}
    </Flex>
  )
}
