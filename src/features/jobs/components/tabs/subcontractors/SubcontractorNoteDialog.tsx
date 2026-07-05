import * as React from 'react'
import { Button, Dialog, Flex, Text, TextArea } from '@radix-ui/themes'

type Mode = 'add' | 'view' | 'edit'

export default function SubcontractorNoteDialog({
  open,
  onOpenChange,
  title,
  initialNote,
  mode: initialMode,
  onSave,
  isSaving,
  readOnly = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialNote: string | null
  mode: Mode
  onSave: (note: string | null) => void
  isSaving?: boolean
  readOnly?: boolean
}) {
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [note, setNote] = React.useState(initialNote ?? '')

  React.useEffect(() => {
    if (open) {
      setMode(initialMode)
      setNote(initialNote ?? '')
    }
  }, [open, initialMode, initialNote])

  const dialogTitle =
    mode === 'add'
      ? `Add note — ${title}`
      : mode === 'edit'
        ? `Edit note — ${title}`
        : `Note — ${title}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{dialogTitle}</Dialog.Title>
        {mode === 'view' || readOnly ? (
          <Flex direction="column" gap="3" mt="3">
            <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
              {initialNote || '—'}
            </Text>
            <Flex justify="end" gap="2">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Close
                </Button>
              </Dialog.Close>
              {!readOnly && (
                <Button onClick={() => setMode('edit')}>Edit note</Button>
              )}
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="3" mt="3">
            <TextArea
              value={note}
              rows={4}
              placeholder="Notes about this subcontractor on the job"
              onChange={(e) => setNote(e.target.value)}
            />
            <Flex justify="end" gap="2">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                disabled={isSaving}
                onClick={() => onSave(note.trim() || null)}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </Flex>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
