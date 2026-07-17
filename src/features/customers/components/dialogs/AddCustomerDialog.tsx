import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import { formatVATInput } from '@shared/lib/generalFunctions'

const defaultValues = {
  name: '',
  vat_number: '',
  address_line: '',
  zip_code: '',
  city: '',
  country: 'Norway',
  is_partner: false,
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  vat_number: z.string(),
  address_line: z.string(),
  zip_code: z.string(),
  city: z.string(),
  country: z.string(),
  is_partner: z.boolean(),
})

export default function AddCustomerDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded?: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success } = useToast()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const mut = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')

      const addressParts = [
        value.address_line,
        value.zip_code,
        value.city,
        value.country,
      ]
        .filter(Boolean)
        .join(', ')
      const addressString = addressParts || null

      const customerPayload = {
        company_id: companyId,
        name: value.name,
        vat_number: value.vat_number.trim() || null,
        address: addressString,
        is_partner: !!value.is_partner,
      }

      let customerId: string | undefined
      if (value.name.trim()) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert(customerPayload)
          .select('id')
          .single()
        if (customerError) throw customerError
        customerId = customerData.id
      }

      if (
        customerId &&
        value.address_line &&
        value.city &&
        value.zip_code &&
        value.country
      ) {
        const addressName = `${value.name}'s address`
        const { error: addressError } = await supabase
          .from('addresses')
          .insert({
            name: addressName,
            address_line: value.address_line,
            zip_code: value.zip_code,
            city: value.city,
            country: value.country,
            company_id: companyId,
            is_personal: false,
          })
        if (addressError) throw addressError
      }

      if (customerId) {
        try {
          const { logActivity } = await import('@features/latest/api/queries')
          await logActivity({
            companyId,
            activityType: 'customer_added',
            metadata: {
              customer_id: customerId,
              customer_name: value.name.trim(),
              is_partner: value.is_partner,
            },
            title: value.name.trim(),
          })
        } catch (logErr) {
          console.error('Failed to log activity:', logErr)
        }
      }

      return customerId
    },
    onSuccess: async () => {
      form.reset(defaultValues)
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-feed'],
        exact: false,
      })
      onOpenChange(false)
      onAdded?.()
      success('Success', 'Customer added')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Add customer</Dialog.Title>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label="Name"
                    placeholder="Company or customer name"
                  />
                )}
              </form.AppField>
              <form.AppField name="vat_number">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium">
                      VAT number
                    </Text>
                    <TextField.Root
                      value={field.state.value}
                      placeholder="e.g., 123 456 789"
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(formatVATInput(e.target.value))
                      }
                    />
                  </Flex>
                )}
              </form.AppField>
              <form.AppField name="address_line">
                {(field) => (
                  <field.TextField
                    label="Address line"
                    placeholder="Street and number"
                  />
                )}
              </form.AppField>
              <Flex gap="2" width="100%">
                <form.AppField name="zip_code">
                  {(field) => (
                    <Flex direction="column" gap="1">
                      <Text as="label" size="2" weight="medium">
                        ZIP
                      </Text>
                      <NorwayZipCodeField
                        value={field.state.value}
                        onChange={(val) => {
                          field.handleChange(val)
                        }}
                        autoCompleteCity={(city) =>
                          form.setFieldValue('city', city)
                        }
                      />
                    </Flex>
                  )}
                </form.AppField>
                <form.AppField name="city">
                  {(field) => (
                    <field.TextField
                      label="City"
                      placeholder="e.g., Oslo"
                      style={{ flex: 1 }}
                    />
                  )}
                </form.AppField>
              </Flex>
              <form.AppField name="country">
                {(field) => <field.TextField label="Country" />}
              </form.AppField>
              <form.AppField name="is_partner">
                {(field) => <field.Switch label="Partner" />}
              </form.AppField>
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton label="Create" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
