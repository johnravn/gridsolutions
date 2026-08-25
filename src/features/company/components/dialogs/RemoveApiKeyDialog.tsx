import { Button, Dialog, Flex, Text } from '@radix-ui/themes'

export default function RemoveApiKeyDialog({
  open,
  onOpenChange,
  onConfirm,
  isRemoving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
  isRemoving: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Remove API Key?</Dialog.Title>
        <Dialog.Description size="2">
          Are you sure you want to remove the API key?
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
            This action will:
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove the API key and all authentication credentials
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove the organization selection
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Stop automatic data synchronization
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }} mt="2">
            You will need to enter a new API key to restore the connection.
          </Text>
        </Flex>

        <Flex gap="3" justify="end" mt="4">
          <Dialog.Close>
            <Button type="button" variant="soft" disabled={isRemoving}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            type="button"
            variant="solid"
            color="red"
            disabled={isRemoving}
            onClick={() => {
              onConfirm()
            }}
          >
            {isRemoving ? 'Removing…' : 'Remove API Key'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
