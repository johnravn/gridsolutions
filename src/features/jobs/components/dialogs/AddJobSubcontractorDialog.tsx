import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { partnerCustomersQuery } from '@features/inventory/api/partners'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  addJobSubcontractor,
  jobSubcontractorsKey,
} from '../../api/subcontractorQueries'

const defaultValues = {
  customerId: '',
}

const schema = z.object({
  customerId: z.string().min(1, 'Select a partner'),
})

export default function AddJobSubcontractorDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  excludeCustomerIds = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  excludeCustomerIds?: Array<string>
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId }),
    enabled: open && !!companyId,
  })

  const availablePartners = partners.filter(
    (p) => !excludeCustomerIds.includes(p.id),
  )

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await addMutation.mutateAsync(value.customerId)
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const addMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await addJobSubcontractor({
        jobId,
        customerId,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: jobSubcontractorsKey(jobId) })
      success('Subcontractor added', 'Partner was added to this job')
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toastError('Could not add subcontractor', e.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Add subcontractor</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Choose a partner customer to use as a subcontractor on this job.
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3">
              <form.AppField name="customerId">
                {(field) => (
                  <Select.Root
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <Select.Trigger placeholder="Select partner…" />
                    <Select.Content style={{ zIndex: 10000 }}>
                      {availablePartners.length === 0 ? (
                        <Text
                          size="2"
                          color="gray"
                          as="div"
                          style={{ padding: 8 }}
                        >
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
                )}
              </form.AppField>

              <Flex gap="2" justify="end">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Add" pendingLabel="Adding…" />
              </Flex>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
