import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { formatVATInput } from '@shared/lib/generalFunctions'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import { crewPricingLevelsQuery } from '@features/company/api/queries'
import {
  CustomerBrandColorsFields,
  normalizeAccentColor,
  normalizeCustomHex,
  sanitizeCustomHexInput,
} from '../CustomerBrandColorsFields'
import { upsertCustomer } from '../../api/queries'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

const STANDARD_PRICING_LEVEL = '__standard__'

type Initial = {
  id: string
  name: string
  vat_number: string
  address: string
  is_partner: boolean
  logo_path?: string | null
  accent_color?: string | null
  accent_color_custom?: string | null
  crew_pricing_level_id?: string | null
}

function parseAddress(addr: string | null) {
  if (!addr)
    return { address_line: '', zip_code: '', city: '', country: 'Norway' }
  const parts = addr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    address_line: parts[0] || '',
    zip_code: parts[1] || '',
    city: parts[2] || '',
    country: parts[3] || 'Norway',
  }
}

function buildDefaults(initial: Initial) {
  return {
    id: initial.id,
    name: initial.name,
    logo_path: initial.logo_path ?? null,
    crew_pricing_level_id:
      initial.crew_pricing_level_id ?? STANDARD_PRICING_LEVEL,
    accent_color: normalizeAccentColor(initial.accent_color),
    accent_color_custom: normalizeCustomHex(initial.accent_color_custom),
    vat_number: initial.vat_number ? formatVATInput(initial.vat_number) : '',
    is_partner: initial.is_partner,
    ...parseAddress(initial.address),
  }
}

const schema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Name is required'),
  logo_path: z.string().nullable(),
  crew_pricing_level_id: z.string(),
  accent_color: z.custom<RadixAccentColor>(),
  accent_color_custom: z.string(),
  vat_number: z.string(),
  is_partner: z.boolean(),
  address_line: z.string(),
  zip_code: z.string(),
  city: z.string(),
  country: z.string(),
})

export default function EditCustomerDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Initial
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const { success } = useToast()

  const { data: levels = [] } = useQuery({
    ...crewPricingLevelsQuery(companyId ?? ''),
    enabled: !!companyId && open,
  })

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
  }, [
    open,
    initial.id,
    initial.name,
    initial.vat_number,
    initial.address,
    initial.is_partner,
    initial.logo_path,
    initial.accent_color,
    initial.accent_color_custom,
    initial.crew_pricing_level_id,
  ])

  const mut = useMutation({
    mutationFn: async (value: ReturnType<typeof buildDefaults>) => {
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

      return upsertCustomer({
        id: value.id,
        company_id: companyId,
        name: value.name,
        vat_number: value.vat_number.trim() || null,
        address: addressString,
        is_partner: !!value.is_partner,
        logo_path: value.logo_path ?? null,
        crew_pricing_level_id:
          value.crew_pricing_level_id === STANDARD_PRICING_LEVEL
            ? null
            : value.crew_pricing_level_id,
        accent_color: value.accent_color,
        accent_color_custom: sanitizeCustomHexInput(value.accent_color_custom),
      })
    },
    onSuccess: () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Customer data saved')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit customer</Dialog.Title>
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
                {(field) => <field.TextField label="Name" />}
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
                        onChange={(val) => field.handleChange(val)}
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
              <form.AppField name="crew_pricing_level_id">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium">
                      Crew pricing level
                    </Text>
                    <Select.Root
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <Select.Trigger placeholder="Standard" />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value={STANDARD_PRICING_LEVEL}>
                          Standard
                        </Select.Item>
                        {levels.map((level) => (
                          <Select.Item key={level.id} value={level.id}>
                            {level.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                )}
              </form.AppField>
              <form.AppField name="accent_color">
                {(accentColorField) => (
                  <form.AppField name="accent_color_custom">
                    {(accentColorCustomField) => (
                      <CustomerBrandColorsFields
                        accentColor={accentColorField.state.value}
                        accentColorCustom={accentColorCustomField.state.value}
                        onAccentColorChange={accentColorField.handleChange}
                        onAccentColorCustomChange={
                          accentColorCustomField.handleChange
                        }
                      />
                    )}
                  </form.AppField>
                )}
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
              <form.SubmitButton label="Save" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
