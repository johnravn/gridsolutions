// src/features/super/components/CompanyDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import {
  SearchableSelect,
  preventDialogCloseOnSearchableSelect,
} from '@shared/ui/components/SearchableSelect'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'

type FormState = {
  name: string
  general_email: string
  address_line: string
  zip_code: string
  city: string
  country: string
  vat_number: string
  contact_person_id: string | null
}

type EditInitialData = {
  id: string
  name: string
  general_email: string | null
  address: string | null
  vat_number: string | null
  contact_person_id: string | null
}

export default function CompanyDialog({
  open,
  onOpenChange,
  mode = 'create',
  initialData,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode?: 'create' | 'edit'
  initialData?: EditInitialData
  onSaved?: () => void
}) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [searchTerm, setSearchTerm] = React.useState('')

  // Format VAT number on initial load
  const formatVATForInput = (vat: string | null | undefined): string => {
    if (!vat) return ''
    const formatted = fmtVAT(vat)
    return formatted === '—' ? '' : formatted
  }

  // Parse address string (format: "address_line, zip_code, city, country")
  const parseAddress = (
    addr: string | null | undefined,
  ): {
    address_line: string
    zip_code: string
    city: string
    country: string
  } => {
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

  const [form, setForm] = React.useState<FormState>({
    name: '',
    general_email: '',
    address_line: '',
    zip_code: '',
    city: '',
    country: 'Norway',
    vat_number: '',
    contact_person_id: null,
  })

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const setAddr = (
    k: 'address_line' | 'zip_code' | 'city' | 'country',
    v: string,
  ) => setForm((s) => ({ ...s, [k]: v }))

  // Load users for contact person selection with search
  const { data: profiles = [], isFetching: profilesLoading } = useQuery({
    queryKey: [
      'profiles',
      'contact-person-search',
      searchTerm,
      form.contact_person_id,
    ],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, display_name, email, first_name, last_name')
        .limit(20)

      if (searchTerm.trim()) {
        // Search mode: filter by search term
        q = q.or(
          `display_name.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%,first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%`,
        )
      } else if (form.contact_person_id) {
        // Show selected person when no search
        q = q.eq('user_id', form.contact_person_id)
      }

      const { data, error } = await q.order('display_name', { ascending: true })
      if (error) throw error
      return data.map((p) => ({
        id: p.user_id,
        label:
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(' ') ||
          p.email,
        email: p.email,
        display_name: p.display_name,
        first_name: p.first_name,
        last_name: p.last_name,
      }))
    },
    staleTime: 30_000,
  })

  const contactPersonOptions = React.useMemo(
    () => [
      { value: '', label: 'None' },
      ...profiles.map((p) => ({
        value: p.id,
        label: p.label,
        description: p.display_name ? p.email : undefined,
      })),
    ],
    [profiles],
  )

  // Prefill form on edit
  React.useEffect(() => {
    if (!open) {
      setForm({
        name: '',
        general_email: '',
        address_line: '',
        zip_code: '',
        city: '',
        country: 'Norway',
        vat_number: '',
        contact_person_id: null,
      })
      setSearchTerm('')
      return
    }

    if (mode === 'edit' && initialData) {
      const parsedAddr = parseAddress(initialData.address)
      setForm({
        name: initialData.name || '',
        general_email: initialData.general_email || '',
        address_line: parsedAddr.address_line,
        zip_code: parsedAddr.zip_code,
        city: parsedAddr.city,
        country: parsedAddr.country,
        vat_number: formatVATForInput(initialData.vat_number),
        contact_person_id: initialData.contact_person_id || null,
      })
      setSearchTerm('')
    } else if (mode === 'create') {
      setForm({
        name: '',
        general_email: '',
        address_line: '',
        zip_code: '',
        city: '',
        country: 'Norway',
        vat_number: '',
        contact_person_id: null,
      })
      setSearchTerm('')
    }
  }, [open, mode, initialData?.id])

  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      // Build address string from components
      const addressParts = [f.address_line, f.zip_code, f.city, f.country]
        .filter(Boolean)
        .join(', ')
      const addressString = addressParts || null

      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: f.name.trim(),
          general_email: f.general_email.trim() || null,
          address: addressString,
          // Strip spaces before saving to DB
          vat_number: f.vat_number
            ? f.vat_number.replace(/[\s-]/g, '') || null
            : null,
          contact_person_id: f.contact_person_id || null,
          accent_color: 'indigo', // Default theme color
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      onOpenChange(false)
      success('Success!', 'Company was created')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create company', e?.message ?? 'Please try again.')
    },
  })

  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!initialData?.id) throw new Error('Missing company id')

      // Build address string from components
      const addressParts = [f.address_line, f.zip_code, f.city, f.country]
        .filter(Boolean)
        .join(', ')
      const addressString = addressParts || null

      const { error } = await supabase
        .from('companies')
        .update({
          name: f.name.trim(),
          general_email: f.general_email.trim() || null,
          address: addressString,
          // Strip spaces before saving to DB
          vat_number: f.vat_number
            ? f.vat_number.replace(/[\s-]/g, '') || null
            : null,
          contact_person_id: f.contact_person_id || null,
        })
        .eq('id', initialData.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({
        queryKey: ['company', initialData!.id],
      })
      onOpenChange(false)
      success('Success!', 'Company was updated')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to update company', e?.message ?? 'Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'create') {
      createMutation.mutate(form)
    } else {
      editMutation.mutate(form)
    }
  }

  const isLoading = createMutation.isPending || editMutation.isPending

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="600px"
        onPointerDownOutside={preventDialogCloseOnSearchableSelect}
        onInteractOutside={preventDialogCloseOnSearchableSelect}
      >
        <Dialog.Title>
          {mode === 'create' ? 'Create Company' : 'Edit Company'}
        </Dialog.Title>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3" mt="3">
            <Field
              label={
                <>
                  Name <Text color="red">*</Text>
                </>
              }
            >
              <TextField.Root
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Company name"
                required
                disabled={isLoading}
              />
            </Field>

            <Field label="General Email">
              <TextField.Root
                type="email"
                value={form.general_email}
                onChange={(e) => set('general_email', e.target.value)}
                placeholder="info@company.com"
                disabled={isLoading}
              />
            </Field>

            <Field label="Address line">
              <TextField.Root
                value={form.address_line}
                onChange={(e) => setAddr('address_line', e.target.value)}
                placeholder="Street and number"
                disabled={isLoading}
              />
            </Field>

            <FieldRow>
              <Flex gap={'2'} width={'100%'}>
                <Field label="ZIP">
                  <TextField.Root
                    value={form.zip_code}
                    onChange={(e) => setAddr('zip_code', e.target.value)}
                    placeholder="e.g., 0361"
                    disabled={isLoading}
                  />
                </Field>
                <Field label="City" style={{ flex: 1 }}>
                  <TextField.Root
                    value={form.city}
                    onChange={(e) => setAddr('city', e.target.value)}
                    placeholder="e.g., Oslo"
                    disabled={isLoading}
                  />
                </Field>
              </Flex>
            </FieldRow>

            <Field label="Country">
              <TextField.Root
                value={form.country}
                onChange={(e) => setAddr('country', e.target.value)}
                disabled={isLoading}
              />
            </Field>

            <Field label="VAT Number">
              <TextField.Root
                value={form.vat_number}
                onChange={(e) => {
                  const input = e.target.value.replace(/[\s-]/g, '')
                  // Only allow digits, max 9 digits
                  if (input === '' || /^\d{0,9}$/.test(input)) {
                    // Format as "xxx xxx xxx" as user types
                    const formatted =
                      input.length <= 3
                        ? input
                        : input.length <= 6
                          ? `${input.slice(0, 3)} ${input.slice(3)}`
                          : `${input.slice(0, 3)} ${input.slice(3, 6)} ${input.slice(6)}`
                    set('vat_number', formatted)
                  }
                }}
                placeholder="123 456 789"
                disabled={isLoading}
              />
            </Field>

            <Field label="Contact Person">
              <SearchableSelect
                options={contactPersonOptions}
                value={form.contact_person_id ?? ''}
                onValueChange={(v) => set('contact_person_id', v || null)}
                onInputChange={setSearchTerm}
                filterLocally={false}
                loading={profilesLoading}
                placeholder="Search by name or email…"
                disabled={isLoading}
                style={{ maxWidth: 'none' }}
              />
            </Field>

            <Flex gap="3" justify="end" mt="4">
              <Dialog.Close>
                <Button type="button" variant="soft" disabled={isLoading}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? mode === 'create'
                    ? 'Creating…'
                    : 'Saving…'
                  : mode === 'create'
                    ? 'Create'
                    : 'Save'}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string | React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
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
