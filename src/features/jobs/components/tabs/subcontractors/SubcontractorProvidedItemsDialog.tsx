import { Badge, Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import type { SubrentalBookingRow } from '../../../api/subcontractorQueries'

export default function SubcontractorProvidedItemsDialog({
  open,
  onOpenChange,
  subcontractorName,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subcontractorName: string
  items: Array<SubrentalBookingRow>
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Items provided by {subcontractorName}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Subrental equipment assigned to this subcontractor on the job.
        </Dialog.Description>

        {items.length === 0 ? (
          <Text size="2" color="gray">
            No subrental items assigned to this subcontractor yet.
          </Text>
        ) : (
          <Flex direction="column" gap="2">
            {items.map((row) => (
              <Box
                key={row.id}
                p="2"
                style={{
                  borderRadius: 'var(--radius-2)',
                  background: 'var(--gray-a2)',
                }}
              >
                <Text weight="medium" size="2" style={{ display: 'block' }}>
                  {row.item_name}
                </Text>
                <Flex align="center" gap="2" mt="1" wrap="wrap">
                  <Text size="1" color="gray">
                    {row.period_title ?? 'Equipment period'}
                  </Text>
                  <Badge variant="soft" size="1" color="gray">
                    x{row.quantity}
                  </Badge>
                  <Badge variant="soft" size="1">
                    {row.external_status ?? 'planned'}
                  </Badge>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}

        <Flex justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
