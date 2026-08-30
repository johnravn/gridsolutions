import * as React from 'react'
import { Button, Dialog, Flex, Separator, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import DateTimePicker from '@shared/ui/components/DateTimePicker'

export function getCopyJobInitialFormValues(input: {
  title: string | null
  startAt: string | null
}) {
  return {
    title: input.title ?? '',
    startAt: input.startAt ?? '',
  }
}

const defaultValues = {
  title: '',
  startAt: '',
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  startAt: z.string().min(1, 'Start time is required'),
})

export default function CopyJobDialog({
  open,
  onOpenChange,
  initialTitle,
  initialStartAt,
  onConfirm,
  isCopying,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTitle: string | null
  initialStartAt: string | null
  onConfirm: (payload: { title: string; startAt: string }) => void
  isCopying: boolean
}) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      onConfirm({
        title: value.title.trim(),
        startAt: value.startAt,
      })
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset(
      getCopyJobInitialFormValues({
        title: initialTitle,
        startAt: initialStartAt,
      }),
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, initialTitle, initialStartAt])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Copy job</Dialog.Title>
        <Dialog.Description>
          Choose a title and start time. Bookings keep their original duration
          and shift from this start.
        </Dialog.Description>
        <Separator my="3" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3">
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="Enter job title"
                  />
                )}
              </form.AppField>

              <form.AppField name="startAt">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <DateTimePicker
                      label="Start"
                      value={field.state.value}
                      onChange={field.handleChange}
                      invalid={field.state.meta.errors.length > 0}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <Text size="2" color="red">
                        Start time is required.
                      </Text>
                    )}
                  </Flex>
                )}
              </form.AppField>
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Button
                type="button"
                variant="soft"
                onClick={() => onOpenChange(false)}
                disabled={isCopying}
              >
                Cancel
              </Button>
              <form.SubmitButton
                label="Copy job"
                pendingLabel="Copying…"
                disabled={isCopying}
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
