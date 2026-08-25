import { Button, Dialog, Flex, Text } from '@radix-ui/themes'

export default function DeleteAccountingConfigDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Delete Accounting Configuration?</Dialog.Title>
        <Dialog.Description size="2">
          Are you sure you want to delete the entire accounting software
          configuration?
        </Dialog.Description>

        <Flex
          direction="column"
          gap="2"
          mt="4"
          p="3"
          style={{
            backgroundColor: 'var(--red-3)',
            borderRadius: 'var(--radius-2)',
          }}
        >
          <Text size="2" weight="medium" style={{ color: 'var(--red-11)' }}>
            ⚠️ Warning
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            This action will permanently:
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove the API key and all authentication credentials
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove the organization selection
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Disconnect all accounting software integrations
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Stop automatic data synchronization
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }} mt="2">
            You will need to reconfigure the integration from scratch if you
            want to reconnect later.
          </Text>
        </Flex>

        <Flex gap="3" justify="end" mt="4">
          <Dialog.Close>
            <Button type="button" variant="soft" disabled={isDeleting}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            type="button"
            variant="solid"
            color="red"
            disabled={isDeleting}
            onClick={() => {
              onConfirm()
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete Configuration'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
