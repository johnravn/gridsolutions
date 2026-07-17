import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { formatVATInput } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import MapEmbed from '@shared/maps/MapEmbed'
import { supabase } from '@shared/api/supabase'
import { updateCompany } from '../../api/queries'
import type { CompanyDetail } from '../../api/queries'

function parseAddress(addr: string | null) {
  if (!addr) {
    return {
      address_line: '',
      zip_code: '',
      city: '',
      country: 'Norway',
    }
  }
  const parts = addr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 4) {
    return {
      address_line: parts[0] || '',
      zip_code: parts[1] || '',
      city: parts[2] || '',
      country: parts[3] || 'Norway',
    }
  }
  if (parts.length === 1) {
    return {
      address_line: parts[0] || '',
      zip_code: '',
      city: '',
      country: 'Norway',
    }
  }
  return {
    address_line: addr,
    zip_code: '',
    city: '',
    country: 'Norway',
  }
}

function buildDefaults(initial: CompanyDetail) {
  return {
    id: initial.id,
    name: initial.name,
    vat_number: initial.vat_number ? formatVATInput(initial.vat_number) : '',
    general_email: initial.general_email ?? '',
    contact_person_id: initial.contact_person_id ?? '',
    ...parseAddress(initial.address ?? null),
  }
}

const schema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Company name is required'),
  vat_number: z.string(),
  general_email: z.string(),
  contact_person_id: z.string(),
  address_line: z.string(),
  zip_code: z.string(),
  city: z.string(),
  country: z.string(),
})

export default function EditCompanyDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: CompanyDetail
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const { success, error } = useToast()

  const form = useAppForm({
    defaultValues: buildDefaults(initial),
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (open) form.reset(buildDefaults(initial), { keepDefaultValues: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens or initial changes
  }, [open, initial.id])

  const { data: companyUsers = [] } = useQuery({
    queryKey: ['company', companyId, 'contact-person-candidates'],
    enabled: open && !!companyId,
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID')
      const { data, error: queryError } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, phone, role')
        .eq('company_id', companyId)
        .in('role', ['employee', 'owner'])
        .order('display_name', { ascending: true })

      if (queryError) throw queryError
      return data as Array<{
        user_id: string
        display_name: string | null
        email: string
        phone: string | null
        role: string
      }>
    },
  })

  const mut = useMutation({
    mutationFn: async (value: ReturnType<typeof buildDefaults>) => {
      if (!companyId) throw new Error('No company selected')

      const mapQuery = [
        value.address_line,
        value.zip_code,
        value.city,
        value.country,
      ]
        .map((v) => v.trim())
        .filter(Boolean)
        .join(', ')

      return updateCompany({
        companyId,
        id: value.id,
        name: value.name.trim(),
        address: mapQuery || null,
        vat_number: value.vat_number
          ? value.vat_number.replace(/[\s-]/g, '') || null
          : null,
        general_email: value.general_email.trim() || null,
        contact_person_id: value.contact_person_id || null,
      })
    },
    onSuccess: () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Company data saved')
    },
    onError: (e: Error) => {
      error('Failed to save', e?.message ?? 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="520px"
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        <Dialog.Title>Edit company</Dialog.Title>

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
                {(field) => <field.TextField label="Company name" />}
              </form.AppField>

              <Separator size="4" />

              <Text as="div" size="2" weight="bold" mb="2">
                Address
              </Text>

              <form.AppField name="address_line">
                {(field) => (
                  <field.TextField
                    label="Address line"
                    placeholder="Street and number"
                  />
                )}
              </form.AppField>

              <Grid columns="2" gap="3">
                <form.AppField name="zip_code">
                  {(field) => (
                    <field.TextField
                      label="ZIP code"
                      placeholder="e.g., 0361"
                    />
                  )}
                </form.AppField>
                <form.AppField name="city">
                  {(field) => (
                    <field.TextField label="City" placeholder="e.g., Oslo" />
                  )}
                </form.AppField>
              </Grid>

              <form.AppField name="country">
                {(field) => (
                  <field.TextField label="Country" placeholder="e.g., Norway" />
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state) => [
                  state.values.address_line,
                  state.values.zip_code,
                  state.values.city,
                  state.values.country,
                ]}
              >
                {([addressLine, zipCode, city, country]) => {
                  const mapQuery = [addressLine, zipCode, city, country]
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .join(', ')
                  if (!mapQuery) return null
                  return (
                    <Box mt="2" style={{ maxWidth: 400 }}>
                      <Text as="div" size="1" color="gray" mb="2">
                        Map preview
                      </Text>
                      <MapEmbed query={mapQuery} zoom={15} />
                    </Box>
                  )
                }}
              </form.Subscribe>

              <Separator size="4" />

              <form.AppField name="vat_number">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium">
                      VAT number
                    </Text>
                    <TextField.Root
                      value={field.state.value}
                      placeholder="123 456 789"
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(formatVATInput(e.target.value))
                      }
                    />
                  </Flex>
                )}
              </form.AppField>

              <form.AppField name="general_email">
                {(field) => (
                  <field.TextField
                    label="General email"
                    type="email"
                    placeholder="company@example.com"
                  />
                )}
              </form.AppField>

              <form.AppField name="contact_person_id">
                {(field) => {
                  const selectedContactPerson = companyUsers.find(
                    (u) => u.user_id === field.state.value,
                  )
                  return (
                    <Flex direction="column" gap="1">
                      <Text as="label" size="2" weight="medium">
                        Contact person
                      </Text>
                      <Text as="div" size="1" color="gray" mb="1">
                        The person to contact from this company (for system
                        owner)
                      </Text>
                      <Select.Root
                        value={field.state.value || undefined}
                        onValueChange={(val) => field.handleChange(val)}
                      >
                        <Select.Trigger placeholder="Select contact person" />
                        <Select.Content style={{ zIndex: 10000 }}>
                          {companyUsers.map((u) => {
                            const extraParts = []
                            if (u.phone) {
                              extraParts.push(prettyPhone(u.phone))
                            }
                            if (u.email && u.display_name) {
                              extraParts.push(u.email)
                            }
                            const extra =
                              extraParts.length > 0
                                ? ` (${extraParts.join(', ')})`
                                : ''

                            return (
                              <Select.Item key={u.user_id} value={u.user_id}>
                                {u.display_name || u.email}
                                {extra}
                              </Select.Item>
                            )
                          })}
                        </Select.Content>
                      </Select.Root>
                      {selectedContactPerson && (
                        <Flex
                          direction="column"
                          gap="1"
                          mt="2"
                          style={{
                            padding: 8,
                            background: 'var(--gray-a2)',
                            borderRadius: 4,
                          }}
                        >
                          <Text size="2" weight="medium">
                            {selectedContactPerson.display_name || 'No name'}
                          </Text>
                          {selectedContactPerson.email && (
                            <Text size="1" color="gray">
                              Email:{' '}
                              <a
                                href={`mailto:${selectedContactPerson.email}`}
                                style={{ color: 'inherit' }}
                              >
                                {selectedContactPerson.email}
                              </a>
                            </Text>
                          )}
                          {selectedContactPerson.phone && (
                            <Text size="1" color="gray">
                              Phone:{' '}
                              <a
                                href={`tel:${selectedContactPerson.phone}`}
                                style={{ color: 'inherit' }}
                              >
                                {prettyPhone(selectedContactPerson.phone)}
                              </a>
                            </Text>
                          )}
                        </Flex>
                      )}
                    </Flex>
                  )
                }}
              </form.AppField>
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton label="Save" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
