// src/features/jobs/components/dialogs/SelectExternalOwnerDialog.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Dialog, Flex } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { partnerCustomersQuery } from '@features/inventory/api/partners'

const schema = z.object({
  selectedOwnerId: z.string().min(1, 'Select a partner'),
})

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
  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId }),
    enabled: open,
  })

  const availablePartners = partners.filter(
    (p) => !excludeOwnerIds.includes(p.id),
  )

  const form = useAppForm({
    defaultValues: { selectedOwnerId: '' },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      const partner = partners.find((p) => p.id === value.selectedOwnerId)
      if (!partner) return
      onSelect(partner.id, partner.name)
      form.reset({ selectedOwnerId: '' })
      onOpenChange(false)
    },
  })

  React.useEffect(() => {
    if (open) form.reset({ selectedOwnerId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>Select partner</Dialog.Title>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="selectedOwnerId">
                {(field) => (
                  <field.Select
                    label="Partner"
                    placeholder="Select a partner…"
                    options={availablePartners.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                )}
              </form.AppField>

              <Flex gap="2" justify="end" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Select" pendingLabel="Select" />
              </Flex>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
