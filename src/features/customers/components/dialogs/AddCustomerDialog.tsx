import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Switch, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import { formatVATInput } from '@shared/lib/generalFunctions'

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
  const [form, setForm] = React.useState({
    name: '',
    vat_number: '',
    address_line: '',
    zip_code: '',
    city: '',
    country: 'Norway',
    is_partner: false,
  })
  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))
  const setAddr = (
    k: 'address_line' | 'zip_code' | 'city' | 'country',
    v: any,
  ) => setForm((s) => ({ ...s, [k]: v }))
  const { success } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')

      // Build address string from components for the customer.address field
      const addressParts = [
        form.address_line,
        form.zip_code,
        form.city,
        form.country,
      ]
        .filter(Boolean)
        .join(', ')
      const addressString = addressParts || null

      // 1) Create/update customer
      const customerPayload = {
        company_id: companyId,
        name: form.name,
        vat_number: form.vat_number.trim() || null,
        address: addressString,
        is_partner: !!form.is_partner,
      }

      let customerId: string | undefined
      if (form.name.trim()) {
        // Insert customer first to get the ID
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert(customerPayload)
          .select('id')
          .single()
        if (customerError) throw customerError
        customerId = customerData.id
      }

      // 2) Create address record if we have address data
      if (
        customerId &&
        form.address_line &&
        form.city &&
        form.zip_code &&
        form.country
      ) {
        const addressName = `${form.name}'s address`
        const { error: addressError } = await supabase
          .from('addresses')
          .insert({
            name: addressName,
            address_line: form.address_line,
            zip_code: form.zip_code,
            city: form.city,
            country: form.country,
            company_id: companyId,
            is_personal: false,
          })
        if (addressError) throw addressError
      }

      // Log activity for new customers
      if (customerId) {
        try {
          const { logActivity } = await import('@features/latest/api/queries')
          await logActivity({
            companyId,
            activityType: 'customer_added',
            metadata: {
              customer_id: customerId,
              customer_name: form.name.trim(),
              is_partner: form.is_partner,
            },
            title: form.name.trim(),
          })
        } catch (logErr) {
          console.error('Failed to log activity:', logErr)
          // Don't fail the whole operation if logging fails
        }
      }

      return customerId
    },
    onSuccess: async () => {
      // Reset form
      setForm({
        name: '',
        vat_number: '',
        address_line: '',
        zip_code: '',
        city: '',
        country: 'Norway',
        is_partner: false,
      })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-feed'],
        exact: false,
      })
      onOpenChange(false)
      onAdded?.()
      success('Success', 'Customer added')
      // (table invalidation is done by parent)
    },
  })

  const canSave = form.name.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Add customer</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Field label="Name">
            <TextField.Root
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Company or customer name"
              autoFocus
            />
          </Field>
          <Field label="VAT number">
            <TextField.Root
              value={form.vat_number}
              onChange={(e) =>
                set('vat_number', formatVATInput(e.target.value))
              }
              placeholder="e.g., 123 456 789"
            />
          </Field>
          <Field label="Address line">
            <TextField.Root
              value={form.address_line}
              onChange={(e) => setAddr('address_line', e.target.value)}
              placeholder="Street and number"
            />
          </Field>
          <FieldRow>
            <Flex gap={'2'} width={'100%'}>
              <Field label="ZIP">
                <NorwayZipCodeField
                  value={form.zip_code}
                  onChange={(val) => setAddr('zip_code', val)}
                  autoCompleteCity={(city) => setAddr('city', city)}
                />
              </Field>
              <Field label="City" style={{ flex: 1 }}>
                <TextField.Root
                  value={form.city}
                  onChange={(e) => setAddr('city', e.target.value)}
                  placeholder="e.g., Oslo"
                />
              </Field>
            </Flex>
          </FieldRow>
          <Field label="Country">
            <TextField.Root
              value={form.country}
              onChange={(e) => setAddr('country', e.target.value)}
            />
          </Field>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Partner
            </Text>
            <Switch
              checked={form.is_partner}
              onCheckedChange={(v) => set('is_partner', !!v)}
            />
          </Flex>
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending}
          >
            {mut.isPending ? 'Saving…' : 'Create'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
  maxWidth,
  style,
}: {
  label: string
  children: React.ReactNode
  maxWidth?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{ ...(maxWidth ? { maxWidth } : {}), ...style }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      {children}
    </Flex>
  )
}
