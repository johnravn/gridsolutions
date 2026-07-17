import * as React from 'react'
import { Box, Button, Dialog, Flex, TextArea } from '@radix-ui/themes'
import { Check, Sparks } from 'iconoir-react'
import { z } from 'zod'
import { useAppForm } from '@shared/form'

const defaultValues = {
  message: '',
  useGeneric: true,
}

const schema = z.object({
  message: z.string(),
  useGeneric: z.boolean(),
})

export default function SendInviteDialog({
  open,
  onOpenChange,
  crewName,
  jobTitle,
  roleTitle,
  onSend,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  crewName: string
  jobTitle: string
  roleTitle: string
  onSend: (message: string | null) => void
  isPending?: boolean
}) {
  const generateGenericMessage = React.useCallback(() => {
    const greeting = crewName.includes('crew members')
      ? 'Hi all'
      : `Hi ${crewName}`
    return `${greeting},\n\nYou have been invited to work on "${jobTitle}" as ${roleTitle}. Please review the details and let us know if you can accept this invitation.\n\nLooking forward to working with you!`
  }, [crewName, jobTitle, roleTitle])

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      if (value.useGeneric || value.message.trim()) {
        onSend(
          value.useGeneric
            ? generateGenericMessage()
            : value.message.trim() || null,
        )
      }
    },
  })

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog closes
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 600 }}>
        <Dialog.Title>Send Invitation</Dialog.Title>
        <Dialog.Description>
          Add a personal message{' '}
          {crewName.includes('crew members')
            ? 'to all crew members'
            : `to ${crewName}`}{' '}
          (optional)
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Box my="4">
              <form.Subscribe selector={(state) => state.values.useGeneric}>
                {(useGeneric) => (
                  <Flex gap="2" mb="3">
                    <Button
                      type="button"
                      variant={useGeneric ? 'soft' : 'outline'}
                      onClick={() => {
                        form.setFieldValue('useGeneric', true)
                        form.setFieldValue('message', generateGenericMessage())
                      }}
                      style={{ flex: 1 }}
                    >
                      <Sparks width={16} height={16} /> Use generic message
                    </Button>
                    <Button
                      type="button"
                      variant={!useGeneric ? 'soft' : 'outline'}
                      onClick={() => form.setFieldValue('useGeneric', false)}
                      style={{ flex: 1 }}
                    >
                      Write custom message
                    </Button>
                  </Flex>
                )}
              </form.Subscribe>

              <form.AppField name="message">
                {(field) => (
                  <form.Subscribe selector={(state) => state.values.useGeneric}>
                    {(useGeneric) => (
                      <TextArea
                        placeholder={
                          useGeneric
                            ? 'Generic message will be generated...'
                            : 'Write your personal message here...'
                        }
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onFocus={() => form.setFieldValue('useGeneric', false)}
                        rows={6}
                        disabled={useGeneric}
                        style={{ minHeight: 120 }}
                      />
                    )}
                  </form.Subscribe>
                )}
              </form.AppField>
            </Box>

            <Flex gap="2" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft" disabled={isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isPending}>
                <Check width={16} height={16} />{' '}
                {isPending ? 'Sending...' : 'Send invitation'}
              </Button>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
