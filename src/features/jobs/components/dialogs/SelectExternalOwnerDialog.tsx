// src/features/jobs/components/dialogs/SelectExternalOwnerDialog.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, Text } from '@radix-ui/themes'
import { partnerCustomersQuery } from '@features/inventory/api/partners'

export default function SelectExternalOwnerDialog({
  open,
  onOpenChange,
  companyId,
  onSelect,
  excludeOwnerIds = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
  onSelect: (ownerId: string, ownerName: string) => void
  excludeOwnerIds?: Array<string>
}) {
  const [selectedOwnerId, setSelectedOwnerId] = React.useState<string>('')

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId }),
    enabled: open,
  })

  // Filter out already selected owners
  const availablePartners = partners.filter(
    (p) => !excludeOwnerIds.includes(p.id),
  )

  const handleSelect = () => {
    if (!selectedOwnerId) return
    const partner = partners.find((p) => p.id === selectedOwnerId)
    if (partner) {
      onSelect(partner.id, partner.name)
      setSelectedOwnerId('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>Select partner</Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Select.Root
            value={selectedOwnerId}
            onValueChange={setSelectedOwnerId}
          >
            <Select.Trigger placeholder="Select a partner…" />
            <Select.Content style={{ zIndex: 10000 }}>
              {availablePartners.length === 0 ? (
                <Text size="2" color="gray" p="2">
                  No partners available
                </Text>
              ) : (
                availablePartners.map((p) => (
                  <Select.Item key={p.id} value={p.id}>
                    {p.name}
                  </Select.Item>
                ))
              )}
            </Select.Content>
          </Select.Root>

          <Flex gap="2" justify="end" mt="2">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="classic"
              onClick={handleSelect}
              disabled={!selectedOwnerId}
            >
              Select
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
