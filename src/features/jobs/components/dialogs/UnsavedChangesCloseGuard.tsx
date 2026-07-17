import { Button, Dialog, Flex, Separator } from '@radix-ui/themes'

type Props = {
  open: boolean
  isSaving: boolean
  canSave?: boolean
  onKeepEditing: () => void
  onDiscard: () => void
  onSaveAndClose: () => void
}

/**
 * Confirmation dialog for unsaved editor changes.
 * Can only be dismissed via its buttons — not outside click or Escape.
 */
export function UnsavedChangesCloseGuard({
  open,
  isSaving,
  canSave = true,
  onKeepEditing,
  onDiscard,
  onSaveAndClose,
}: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Controlled only by parent button handlers; ignore dismiss gestures.
        if (next) return
      }}
    >
      <Dialog.Content
        maxWidth="480px"
        style={{ zIndex: 101 }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <Dialog.Title>Unsaved changes</Dialog.Title>
        <Separator my="3" />
        <Dialog.Description size="2">
          You have unsaved changes. Save them before closing, discard them, or
          keep editing.
        </Dialog.Description>
        <Flex gap="2" mt="4" justify="end" wrap="wrap">
          <Button variant="soft" onClick={onKeepEditing} disabled={isSaving}>
            Keep editing
          </Button>
          <Button
            variant="soft"
            color="red"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button onClick={onSaveAndClose} disabled={isSaving || !canSave}>
            {isSaving ? 'Saving…' : 'Save & close'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
